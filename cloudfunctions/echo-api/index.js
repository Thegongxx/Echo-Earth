const cloudbase = require("@cloudbase/node-sdk");
const { randomUUID } = require("node:crypto");
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const MOODS = ["开心", "平静", "怀念", "孤独", "兴奋", "失落", "治愈", "期待"];
const fields = [
  "id",
  "anonymous",
  "displayName",
  "occurredAt",
  "createdAt",
  "location",
  "moods",
  "tags",
  "text",
  "imageFileId",
  "drawingFileId",
  "audioFileId",
  "audioAuthorized",
  "qqMusic",
  "visibility",
  "status",
];
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const text = (s, max = 1000) =>
  typeof s === "string" ? s.trim().slice(0, max) : "";
function validate(input) {
  const p = input || {},
    l = p.location || {};
  assert(
    typeof l.lat === "number" &&
      Number.isFinite(l.lat) &&
      Math.abs(l.lat) <= 90 &&
      typeof l.lng === "number" &&
      Number.isFinite(l.lng) &&
      Math.abs(l.lng) <= 180,
    "地点经纬度无效。",
  );
  assert(text(l.city, 50) && text(l.placeName, 120), "请填写城市与地点名称。");
  assert(
    ["poi", "manual", "device", "demo"].includes(l.precision),
    "地点精度类型无效。",
  );
  assert(
    Array.isArray(p.moods) &&
      p.moods.length >= 1 &&
      p.moods.length <= 3 &&
      new Set(p.moods).size === p.moods.length &&
      p.moods.every((m) => MOODS.includes(m)),
    "请选择 1 至 3 个固定心情。",
  );
  assert(
    typeof p.occurredAt === "string" &&
      Number.isFinite(Date.parse(p.occurredAt)) &&
      p.occurredAt.length <= 40,
    "记忆日期无效。",
  );
  assert(typeof p.anonymous === "boolean", "匿名方式无效。");
  assert(p.anonymous || text(p.displayName, 24), "请填写昵称。");
  assert(["public", "private"].includes(p.visibility), "可见范围无效。");
  assert(
    !p.audioFileId || p.audioAuthorized === true,
    "未确认授权的音频不可上传发布。",
  );
  const result = {
    anonymous: p.anonymous,
    displayName: p.anonymous ? "" : text(p.displayName, 24),
    occurredAt: p.occurredAt,
    location: {
      lat: l.lat,
      lng: l.lng,
      city: text(l.city, 50),
      placeName: text(l.placeName, 120),
      address: text(l.address, 240),
      poiId: text(l.poiId, 80),
      precision: l.precision,
      coordinateSystem: l.coordinateSystem === "GCJ02" ? "GCJ02" : "WGS84",
    },
    moods: p.moods,
    tags: Array.isArray(p.tags)
      ? p.tags
          .filter((t) => typeof t === "string")
          .slice(0, 6)
          .map((t) => text(t, 24))
          .filter(Boolean)
      : [],
    text: text(p.text),
    audioAuthorized: p.audioAuthorized === true,
    visibility: p.visibility,
  };
  if (
    typeof l.accuracyMeters === "number" &&
    Number.isFinite(l.accuracyMeters) &&
    l.accuracyMeters >= 0
  )
    result.location.accuracyMeters = l.accuracyMeters;
  if (p.qqMusic) {
    const q = p.qqMusic;
    let u;
    try {
      u = new URL(q.shareUrl);
    } catch {
      throw new Error("QQ 音乐分享链接无效。");
    }
    assert(
      u.protocol === "https:" &&
        ["y.qq.com", "c.y.qq.com", "i.y.qq.com", "music.qq.com"].includes(
          u.hostname,
        ),
      "请使用 HTTPS QQ 音乐官方分享链接。",
    );
    assert(text(q.title, 100) && text(q.artist, 100), "请填写歌曲标题和歌手。");
    result.qqMusic = {
      title: text(q.title, 100),
      artist: text(q.artist, 100),
      shareUrl: u.href,
      mid: text(q.mid, 100),
    };
  }
  for (const kind of ["image", "drawing", "audio"])
    if (p[`${kind}FileId`]) result[`${kind}FileId`] = p[`${kind}FileId`];
  return result;
}
async function find(id) {
  assert(
    typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id),
    "回声 ID 无效。",
  );
  const { data } = await db.collection("echoPosts").doc(id).get();
  return data[0];
}
async function list(where, sort) {
  let posts = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const { data } = await db
      .collection("echoPosts")
      .where(where)
      .orderBy(sort, "desc")
      .skip(offset)
      .limit(100)
      .get();
    posts.push(...data);
    if (data.length < 100) break;
  }
  return posts;
}
async function serialize(posts, includeOwner = false) {
  const safe = posts.map((p) =>
    Object.fromEntries(
      [...fields, ...(includeOwner ? ["userId"] : [])]
        .filter((k) => p[k] !== undefined)
        .map((k) => [k, p[k]]),
    ),
  );
  const files = [
    ...new Set(
      safe.flatMap((p) =>
        [
          p.imageFileId,
          p.drawingFileId,
          p.audioAuthorized ? p.audioFileId : undefined,
        ].filter(Boolean),
      ),
    ),
  ];
  const urls = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const result = await app.getTempFileURL({
      fileList: files
        .slice(i, i + 50)
        .map((fileID) => ({ fileID, maxAge: 600 })),
    });
    for (const f of result.fileList || [])
      if (f.tempFileURL) urls.set(f.fileID, f.tempFileURL);
  }
  return safe.map((p) => {
    for (const kind of ["image", "drawing", "audio"]) {
      if (kind === "audio" && !p.audioAuthorized) continue;
      const url = urls.get(p[`${kind}FileId`]);
      if (url) p[`${kind}Url`] = url;
    }
    return p;
  });
}
exports.main = async (event) => {
  try {
    const userId = app.auth().getUserInfo().uid;
    assert(userId, "请先登录 CloudBase。");
    let data;
    switch (event.action) {
      case "listPublicPosts":
        data = await serialize(
          await list({ visibility: "public", status: "approved" }, "createdAt"),
        );
        break;
      case "listMyPosts":
        data = await serialize(
          (await list({ userId }, "occurredAt")).filter(
            (p) => p.status !== "removed",
          ),
          true,
        );
        break;
      case "prepareUpload": {
        const token = randomUUID();
        await db
          .collection("echoUploadTickets")
          .add({ _id: token, userId, expiresAt: Date.now() + 30 * 60 * 1000 });
        data = { token, prefix: `echo-media/${token}` };
        break;
      }
      case "createPost": {
        const post = validate(event.post);
        const fileIds = ["image", "drawing", "audio"]
          .map((k) => post[`${k}FileId`])
          .filter(Boolean);
        let id = randomUUID();
        if (fileIds.length) {
          const token = event.uploadToken;
          assert(
            typeof token === "string" && /^[a-f0-9-]{36}$/.test(token),
            "上传凭证无效。",
          );
          const ticket = (
            await db.collection("echoUploadTickets").doc(token).get()
          ).data[0];
          assert(
            ticket && ticket.userId === userId && ticket.expiresAt > Date.now(),
            "上传凭证已失效，请重新选择媒体。",
          );
          assert(
            fileIds.every(
              (fid) =>
                typeof fid === "string" &&
                fid.startsWith("cloud://") &&
                fid
                  .split("/")
                  .slice(3)
                  .join("/")
                  .startsWith(`echo-media/${token}/`),
            ),
            "媒体引用不属于当前上传。",
          );
          id = token;
          const existing = await find(id);
          if (existing) {
            assert(existing.userId === userId, "回声归属无效。");
            data = (await serialize([existing], true))[0];
            break;
          }
        }
        const record = {
          ...post,
          id,
          userId,
          createdAt: new Date().toISOString(),
          status: post.visibility === "public" ? "pending" : "approved",
        };
        await db.collection("echoPosts").add({ ...record, _id: id });
        data = (await serialize([record], true))[0];
        break;
      }
      case "setVisibility": {
        const post = await find(event.id);
        assert(
          post && post.userId === userId && post.status !== "removed",
          "只能修改自己的回声。",
        );
        assert(
          ["public", "private"].includes(event.visibility),
          "可见范围无效。",
        );
        await db
          .collection("echoPosts")
          .doc(post.id)
          .update({
            visibility: event.visibility,
            status: event.visibility === "public" ? "pending" : post.status,
          });
        data = { id: post.id };
        break;
      }
      case "deletePost": {
        const post = await find(event.id);
        assert(post && post.userId === userId, "只能删除自己的回声。");
        await db
          .collection("echoPosts")
          .doc(post.id)
          .update({ status: "removed", visibility: "private" });
        const files = [
          post.imageFileId,
          post.drawingFileId,
          post.audioFileId,
        ].filter(Boolean);
        if (files.length) {
          try {
            const result = await app.deleteFile({ fileList: files });
            const failed = (result.fileList || []).some(
              (f) => f.code && f.code !== "SUCCESS",
            );
            if (failed)
              await db
                .collection("echoPosts")
                .doc(post.id)
                .update({ cleanupPending: true });
          } catch {
            await db
              .collection("echoPosts")
              .doc(post.id)
              .update({ cleanupPending: true });
          }
        }
        data = { id: post.id };
        break;
      }
      default:
        throw new Error("未知操作。");
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "云端请求失败。",
    };
  }
};
