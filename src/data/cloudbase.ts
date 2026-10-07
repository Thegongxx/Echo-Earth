import type {
  DataProvider,
  EchoRecord,
  PublicEcho,
  PostInput,
  MediaFiles,
} from "../types";
import { validatePost } from "../types";
import { localFavorites } from "./demo";
type BrowserUpload = (options: {
  cloudPath: string;
  filePath: File;
  onUploadProgress: (event: { loaded: number; total: number }) => void;
}) => Promise<{ fileID: string }>;
export class CloudBaseProvider implements DataProvider {
  readonly mode = "cloudbase" as const;
  private appPromise = this.initialize();
  private async initialize() {
    const { default: cloudbase } = await import("@cloudbase/js-sdk");
    const app = cloudbase.init({ env: import.meta.env.VITE_CLOUDBASE_ENV_ID });
    const auth = app.auth({ persistence: "local" });
    if (!(await auth.getLoginState()))
      await auth.anonymousAuthProvider().signIn();
    return app;
  }
  private async call<T>(action: string, data: Record<string, unknown> = {}) {
    const app = await this.appPromise;
    const { result } = await app.callFunction({
      name: import.meta.env.VITE_CLOUDBASE_FUNCTION || "echo-api",
      data: { action, ...data },
    });
    if (!result?.ok)
      throw new Error(
        result?.error || "云端请求失败，请检查登录、域名与云函数配置。",
      );
    return result.data as T;
  }
  listPublicPosts() {
    return this.call<PublicEcho[]>("listPublicPosts");
  }
  listMyPosts() {
    return this.call<EchoRecord[]>("listMyPosts");
  }
  async createPost(
    post: PostInput,
    files: MediaFiles,
    onProgress: (n: number) => void,
  ) {
    validatePost(post, files);
    const app = await this.appPromise;
    const draft = { ...post };
    const media = Object.entries(files).filter(([, f]) => f) as [
      keyof MediaFiles,
      File,
    ][];
    const uploaded: string[] = [];
    let submitted = false;
    let uploadToken: string | undefined;
    try {
      if (media.length) {
        const ticket = await this.call<{ token: string; prefix: string }>(
          "prepareUpload",
        );
        uploadToken = ticket.token;
        // SDK v2 声明将浏览器 File 误写为 string，浏览器上传 API 实际接收 File。
        const upload = app.uploadFile.bind(app) as unknown as BrowserUpload;
        for (let i = 0; i < media.length; i++) {
          const [k, file] = media[i];
          const ext =
            file.name
              .split(".")
              .pop()
              ?.replace(/[^a-zA-Z0-9]/g, "")
              .slice(0, 8) || "bin";
          const res = await upload({
            cloudPath: ticket.prefix + "/" + k + "." + ext,
            filePath: file,
            onUploadProgress: (event) =>
              onProgress(
                Math.round(
                  ((i + (event.total ? event.loaded / event.total : 0)) /
                    media.length) *
                    90,
                ),
              ),
          });
          draft[`${k}FileId`] = res.fileID;
          uploaded.push(res.fileID);
        }
      }
      submitted = true;
      const p = await this.call<EchoRecord>("createPost", {
        post: draft,
        uploadToken,
      });
      onProgress(100);
      return p;
    } catch (error) {
      if (!submitted && uploaded.length)
        await app.deleteFile({ fileList: uploaded }).catch(() => undefined);
      throw error;
    }
  }
  async deletePost(id: string) {
    await this.call("deletePost", { id });
    await localFavorites.set(id, false);
  }
  async setVisibility(id: string, visibility: "public" | "private") {
    await this.call("setVisibility", { id, visibility });
  }
  getFavorites() {
    return localFavorites.get();
  }
  setFavorite(id: string, saved: boolean) {
    return localFavorites.set(id, saved);
  }
}
