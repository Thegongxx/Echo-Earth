import assert from "node:assert/strict";
import { build } from "esbuild";
import { indexedDB } from "fake-indexeddb";
globalThis.indexedDB = indexedDB;
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};
async function load(path, fragment = "") {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64") +
      fragment
  );
}
const types = await load("src/types.ts");
const { SEED_POSTS, DEMO_LOCATIONS } = await load("src/data/seeds.ts");
const rules = await load("src/domain/themes.ts");
const geo = await load("src/lib/coordinates.ts");
const { DemoProvider } = await load("src/data/demo.ts");
const silent = {
  anonymous: true,
  displayName: "不应显示的昵称",
  occurredAt: "2024-06-20T22:10:00+08:00",
  location: DEMO_LOCATIONS[0],
  moods: ["平静"],
  tags: [],
  visibility: "public",
};
assert.doesNotThrow(() => types.validatePost(silent, {}));
assert.throws(() => types.validatePost({ ...silent, moods: [] }, {}));
assert.throws(() =>
  types.validatePost(
    { ...silent, moods: ["平静", "开心", "治愈", "期待"] },
    {},
  ),
);
assert.throws(() =>
  types.validatePost(
    { ...silent, location: { ...silent.location, lat: 999 } },
    {},
  ),
);
assert.equal(types.isQQUrl("https://y.qq.com/n/ryqq/songDetail/demo"), true);
assert.equal(types.isQQUrl("https://y.qq.com.attacker.invalid/song"), false);
assert.equal(types.isQQUrl("javascript:alert(1)"), false);
assert.throws(() =>
  types.validatePost(
    { ...silent, audioAuthorized: false },
    { audio: new File(["tone"], "original.wav", { type: "audio/wav" }) },
  ),
);
for (const t of rules.THEMES) {
  const route = rules.themeRoute(SEED_POSTS, t);
  assert.ok(route.length >= 3 && route.length <= 5);
  assert.ok(route.every((p) => rules.matchesTheme(p, t)));
  assert.deepEqual(
    route.map((p) => p.id),
    rules.themeRoute(SEED_POSTS, t).map((p) => p.id),
  );
  assert.ok(route.every((p) => rules.matchReason(p, t).length));
}
const midnight = rules.themeRoute(SEED_POSTS, rules.THEMES[1]);
assert.ok(
  midnight.every((p) => {
    const hour = Number(p.occurredAt.slice(11, 13));
    return hour >= 20 || hour < 6;
  }),
);
const coordinate = { lat: 30.25, lng: 120.15 };
const restored = geo.gcjToWgs(geo.wgsToGcj(coordinate));
assert.ok(
  Math.abs(restored.lat - coordinate.lat) < 1e-7 &&
    Math.abs(restored.lng - coordinate.lng) < 1e-7,
);
assert.deepEqual(geo.wgsToGcj({ lat: 48.85, lng: 2.29 }), {
  lat: 48.85,
  lng: 2.29,
});
const provider = new DemoProvider();
let progress = 0;
const post = await provider.createPost(silent, {}, (p) => (progress = p));
assert.equal(progress, 100);
assert.equal(post.displayName, "");
assert.notEqual(post.createdAt, post.occurredAt);
let publicPosts = await provider.listPublicPosts();
assert.equal(publicPosts.length, 13);
assert.ok(publicPosts.every((p) => !Object.hasOwn(p, "userId")));
assert.ok(publicPosts.find((p) => p.id === post.id));
await provider.setVisibility(post.id, "private");
assert.ok(!(await provider.listPublicPosts()).some((p) => p.id === post.id));
assert.ok((await provider.listMyPosts()).some((p) => p.id === post.id));
await provider.setFavorite(post.id, true);
assert.ok((await provider.getFavorites()).includes(post.id));
assert.ok(
  (await new DemoProvider().listMyPosts()).some((p) => p.id === post.id),
);
const image = new File([new Uint8Array([137, 80, 78, 71])], "sample.png", {
  type: "image/png",
});
const mediaPost = await provider.createPost(
  { ...silent, text: "隔离媒体验收" },
  { image },
  () => {},
);
assert.ok(mediaPost.imageFileId);
assert.ok(mediaPost.imageUrl.startsWith("blob:"));
assert.equal(
  (await fetch(mediaPost.imageUrl).then((r) => r.blob())).size,
  image.size,
);
const owner = post.userId;
storage.set("echo-atlas-owner", "different-owner");
const alternate = await load("src/data/demo.ts", "#another-browser");
const other = new alternate.DemoProvider();
assert.equal((await other.listMyPosts()).length, 0);
await assert.rejects(other.deletePost(post.id));
await assert.rejects(other.setVisibility(post.id, "public"));
storage.set("echo-atlas-owner", owner);
await provider.deletePost(mediaPost.id);
await provider.deletePost(post.id);
assert.equal((await provider.listMyPosts()).length, 0);
assert.equal((await provider.listPublicPosts()).length, 12);
assert.ok(!(await provider.getFavorites()).includes(post.id));
console.log(
  "PASS: 静默发布、内容校验、QQ 官方域名、匿名字段、确定性主题与夜间排序、坐标转换、IndexedDB 重读与媒体引用、私密隔离、所有者权限、收藏和删除。",
);
