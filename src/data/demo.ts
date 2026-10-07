import { publicEcho, validatePost } from "../types";
import type { DataProvider, EchoRecord, MediaFiles, PostInput } from "../types";
import { SEED_POSTS } from "./seeds";
import { createLocalId } from "../lib/id";
const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("echo-atlas-v1", 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("posts", { keyPath: "id" });
    request.result.createObjectStore("media");
    request.result.createObjectStore("settings");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () =>
    reject(new Error("本地存储无法打开。请允许此浏览器使用 IndexedDB。"));
});
async function read<T>(store: string, key?: string): Promise<T> {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = key
      ? db.transaction(store).objectStore(store).get(key)
      : db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}
async function write(
  store: string,
  value: unknown,
  key?: string,
  remove = false,
) {
  const db = await dbPromise;
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    if (remove) s.delete(key!);
    else if (key) s.put(value, key);
    else s.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
let owner: string;
function userId() {
  if (!owner) {
    owner = localStorage.getItem("echo-atlas-owner") || createLocalId();
    localStorage.setItem("echo-atlas-owner", owner);
  }
  return owner;
}
const urls = new Map<string, string>();
async function hydrate(post: EchoRecord): Promise<EchoRecord> {
  const p = { ...post };
  for (const kind of ["image", "drawing", "audio"] as const) {
    const id = p[`${kind}FileId`];
    if (id) {
      let url = urls.get(id);
      if (!url) {
        const blob = await read<Blob | undefined>("media", id);
        if (blob) {
          url = URL.createObjectURL(blob);
          urls.set(id, url);
        }
      }
      p[`${kind}Url`] = url;
    }
  }
  return p;
}
export const localFavorites = {
  async get() {
    return (await read<string[] | undefined>("settings", "favorites")) || [];
  },
  async set(id: string, saved: boolean) {
    const ids = await this.get();
    await write(
      "settings",
      saved ? Array.from(new Set([...ids, id])) : ids.filter((x) => x !== id),
      "favorites",
    );
  },
};
export class DemoProvider implements DataProvider {
  readonly mode = "demo" as const;
  async listPublicPosts() {
    const local = await read<EchoRecord[]>("posts");
    return Promise.all(
      [...local, ...SEED_POSTS]
        .filter((p) => p.visibility === "public" && p.status === "approved")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(async (p) => publicEcho(await hydrate(p))),
    );
  }
  async listMyPosts() {
    return Promise.all(
      (await read<EchoRecord[]>("posts"))
        .filter((p) => p.userId === userId() && p.status !== "removed")
        .map(hydrate),
    );
  }
  async createPost(
    post: PostInput,
    files: MediaFiles,
    onProgress: (n: number) => void,
  ) {
    validatePost(post, files);
    onProgress(5);
    const id = createLocalId();
    const record: EchoRecord = {
      ...post,
      id,
      userId: userId(),
      createdAt: new Date().toISOString(),
      status: "approved",
      displayName: post.anonymous ? "" : post.displayName.trim(),
    };
    const entries = Object.entries(files).filter(([, f]) => f) as [
      keyof MediaFiles,
      File,
    ][];
    const added: string[] = [];
    try {
      for (let i = 0; i < entries.length; i++) {
        const [k, file] = entries[i];
        const fileId = `local/${id}/${k}`;
        await write("media", file, fileId);
        record[`${k}FileId`] = fileId;
        added.push(fileId);
        onProgress(10 + Math.round(((i + 1) / entries.length) * 75));
      }
      await write("posts", record);
      onProgress(100);
      return hydrate(record);
    } catch (e) {
      await Promise.all(added.map((id) => write("media", null, id, true)));
      throw e;
    }
  }
  async deletePost(id: string) {
    const post = await read<EchoRecord | undefined>("posts", id);
    if (!post || post.userId !== userId())
      throw new Error("只能删除自己的回声。");
    await write("posts", null, id, true);
    for (const k of ["image", "drawing", "audio"] as const) {
      const fid = post[`${k}FileId`];
      if (fid) {
        await write("media", null, fid, true);
        const url = urls.get(fid);
        if (url) URL.revokeObjectURL(url);
        urls.delete(fid);
      }
    }
    await localFavorites.set(id, false);
  }
  async setVisibility(id: string, visibility: "public" | "private") {
    const p = await read<EchoRecord | undefined>("posts", id);
    if (!p || p.userId !== userId()) throw new Error("只能修改自己的回声。");
    await write("posts", { ...p, visibility });
  }
  getFavorites() {
    return localFavorites.get();
  }
  setFavorite(id: string, saved: boolean) {
    return localFavorites.set(id, saved);
  }
}
