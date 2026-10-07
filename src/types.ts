export const MOODS = [
  "开心",
  "平静",
  "怀念",
  "孤独",
  "兴奋",
  "失落",
  "治愈",
  "期待",
] as const;
export type Mood = (typeof MOODS)[number];
export type Location = {
  lat: number;
  lng: number;
  city: string;
  placeName: string;
  address?: string;
  poiId?: string;
  precision: "poi" | "manual" | "device" | "demo";
  coordinateSystem?: "WGS84" | "GCJ02";
  accuracyMeters?: number;
};
export type QQMusic = {
  title: string;
  artist: string;
  shareUrl: string;
  mid?: string;
};
export type EchoRecord = {
  id: string;
  userId: string;
  anonymous: boolean;
  displayName: string;
  occurredAt: string;
  createdAt: string;
  location: Location;
  moods: Mood[];
  tags: string[];
  text?: string;
  imageFileId?: string;
  imageUrl?: string;
  drawingFileId?: string;
  drawingUrl?: string;
  audioFileId?: string;
  audioUrl?: string;
  audioAuthorized?: boolean;
  qqMusic?: QQMusic;
  visibility: "public" | "private";
  status: "pending" | "approved" | "removed";
  demo?: boolean;
  demoTone?: boolean;
  title?: string;
};
export type PublicEcho = Omit<EchoRecord, "userId">;
export type PostInput = Omit<
  EchoRecord,
  "id" | "userId" | "createdAt" | "status" | "demo" | "demoTone"
>;
export type MediaFiles = { image?: File; drawing?: File; audio?: File };
export interface DataProvider {
  readonly mode: "demo" | "cloudbase";
  listPublicPosts(): Promise<PublicEcho[]>;
  listMyPosts(): Promise<EchoRecord[]>;
  createPost(
    post: PostInput,
    files: MediaFiles,
    onProgress: (n: number) => void,
  ): Promise<EchoRecord>;
  deletePost(id: string): Promise<void>;
  setVisibility(id: string, visibility: "public" | "private"): Promise<void>;
  getFavorites(): Promise<string[]>;
  setFavorite(id: string, saved: boolean): Promise<void>;
}
export interface MoodSuggestionProvider {
  suggest(text: string): Promise<Mood[]>;
}
export function publicEcho(post: EchoRecord): PublicEcho {
  const { userId: _owner, ...safe } = post;
  return { ...safe, displayName: post.anonymous ? "" : safe.displayName };
}
export function isQQUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      ["y.qq.com", "c.y.qq.com", "i.y.qq.com", "music.qq.com"].includes(
        u.hostname,
      )
    );
  } catch {
    return false;
  }
}
export function validatePost(post: PostInput, files: MediaFiles) {
  for (const [kind, file] of Object.entries(files)) {
    if (!file) continue;
    const limit = kind === "audio" ? 20 : 10;
    if (file.size > limit * 1024 * 1024)
      throw new Error(`文件过大，最多 ${limit} MB。`);
    if (
      kind === "audio"
        ? !file.type.startsWith("audio/")
        : !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new Error("文件格式不支持。");
  }
  if (
    !post.location.city.trim() ||
    !post.location.placeName.trim() ||
    !Number.isFinite(post.location.lat) ||
    !Number.isFinite(post.location.lng) ||
    Math.abs(post.location.lat) > 90 ||
    Math.abs(post.location.lng) > 180
  )
    throw new Error("请确认地点名称、城市和有效经纬度。");
  if (
    !post.moods.length ||
    post.moods.length > 3 ||
    post.moods.some((m) => !MOODS.includes(m))
  )
    throw new Error("请选择 1 至 3 个心情。");
  if (!Number.isFinite(Date.parse(post.occurredAt)))
    throw new Error("请选择有效的记忆日期。");
  if (!post.anonymous && !post.displayName.trim())
    throw new Error("请填写昵称，或选择匿名。");
  if (files.audio && !post.audioAuthorized)
    throw new Error("请确认音频的公开分享授权。");
  if (
    post.qqMusic &&
    (!post.qqMusic.title.trim() ||
      !post.qqMusic.artist.trim() ||
      !isQQUrl(post.qqMusic.shareUrl))
  )
    throw new Error("请填写歌曲标题、歌手和 HTTPS QQ 音乐官方分享链接。");
}
