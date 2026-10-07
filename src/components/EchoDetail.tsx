import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  ExternalLink,
  MapPin,
  Music2,
  Pause,
  Play,
  VolumeX,
  X,
} from "lucide-react";
import type { PublicEcho } from "../types";
import { isQQUrl } from "../types";
import { playDemoTone, stopTone } from "../lib/audio";
export const memoryDate = (date: string) =>
  date.slice(0, 10).replaceAll("-", ".");
export const titleOf = (p: PublicEcho) =>
  p.title ||
  (p.text ? p.text.slice(0, 18) : p.qqMusic?.title || "一封静默回声");
export default function EchoDetail({
  post,
  saved,
  onFavorite,
  onClose,
  onSimilar,
}: {
  post: PublicEcho;
  saved: boolean;
  onFavorite: () => void;
  onClose: () => void;
  onSimilar: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    setPlaying(false);
    setError("");
    return () => {
      stopTone();
      audio.current?.pause();
    };
  }, [post.id]);
  const silent =
    !post.text &&
    !post.imageUrl &&
    !post.drawingUrl &&
    !post.audioUrl &&
    !post.qqMusic &&
    !post.demoTone;
  async function play() {
    if (playing) {
      stopTone();
      setPlaying(false);
      return;
    }
    try {
      setPlaying(true);
      await playDemoTone(() => setPlaying(false));
    } catch {
      setPlaying(false);
      setError("此浏览器未能开启演示音频，请再次点击试听。");
    }
  }
  return (
    <article className="echo-detail">
      <div className="detail-top">
        <span className="eyebrow">
          {post.demo ? "FICTIONAL DEMO ECHO" : "A LITTLE ECHO"}
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="关闭回声详情"
        >
          <X size={18} />
        </button>
      </div>
      {post.imageUrl && (
        <div className="detail-image">
          <img
            src={post.imageUrl}
            alt={`${post.location.city}回声的${post.demo ? "原创演示插画" : "照片"}`}
          />
          <span>{post.demo ? "原创插画 · 虚构样例" : "记忆里的画面"}</span>
        </div>
      )}
      {post.drawingUrl && (
        <img
          className="drawing-image"
          src={post.drawingUrl}
          alt="回声中的绘画"
        />
      )}
      {silent && (
        <div className="silent-visual">
          <VolumeX size={30} />
          <span>有些心情，不需要声音。</span>
        </div>
      )}
      <div className="detail-body">
        <div className="detail-location">
          <MapPin size={13} />
          {post.location.city} · {post.location.placeName}
        </div>
        {post.location.precision === "demo" && (
          <p className="detail-coordinate-note">演示坐标 · 不代表精确 POI</p>
        )}
        <h2>{titleOf(post)}</h2>
        <div className="tag-row">
          {post.moods.map((m) => (
            <span key={m} className="mood-tag">
              {m}
            </span>
          ))}
          {post.tags.slice(0, 2).map((t) => (
            <span key={t} className="plain-tag">
              #{t}
            </span>
          ))}
        </div>
        {post.text && <p className="echo-text">{post.text}</p>}
        {post.demoTone && (
          <div className="music-card">
            <button
              className="play-button"
              aria-label={playing ? "停止演示音色" : "播放演示音色"}
              onClick={() => void play()}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div>
              <strong>风的八个音符</strong>
              <small>Web Audio 原创演示音色 · 约 6 秒</small>
            </div>
            <div className={`waveform ${playing ? "playing" : ""}`}>
              {[1, 3, 2, 4, 2, 3, 1].map((n, i) => (
                <i
                  key={i}
                  style={{
                    height: `${n * 5}px`,
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {post.audioUrl && post.audioAuthorized && (
          <div className="uploaded-audio">
            <span>
              <Music2 size={15} /> 用户确认授权的上传音频
            </span>
            <audio
              ref={audio}
              controls
              src={post.audioUrl}
              preload="metadata"
            />
          </div>
        )}
        {post.audioUrl && !post.audioAuthorized && (
          <p className="muted small">此音频尚未确认公开分享授权，无法播放。</p>
        )}
        {post.qqMusic && (
          <div className="qq-card">
            <Music2 size={20} />
            <div>
              <strong>{post.qqMusic.title}</strong>
              <small>{post.qqMusic.artist}</small>
            </div>
            {isQQUrl(post.qqMusic.shareUrl) ? (
              <a
                className="qq-link"
                href={post.qqMusic.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开 QQ 音乐听
                <ExternalLink size={12} />
              </a>
            ) : (
              <small className="error">分享链接无效</small>
            )}
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="detail-meta">
          <span>
            {post.anonymous ? "匿名的旅人" : post.displayName}
            {post.demo && " · 虚构样例"}
          </span>
          <span>记忆发生于 {memoryDate(post.occurredAt)}</span>
          <span>
            发布于{" "}
            {new Date(post.createdAt).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
          {post.visibility === "private" && <span>私密 · 仅自己可见</span>}
          {post.status === "pending" && <span>待审核 · 未出现在公开星球</span>}
        </div>
        <div className="detail-actions">
          <button className="secondary" onClick={onFavorite}>
            {saved ? <Check size={15} /> : <Bookmark size={15} />}{" "}
            {saved ? "已收藏" : "收藏回声"}
          </button>
          <button className="text-button" onClick={onSimilar}>
            发现相似回声<span>↗</span>
          </button>
        </div>
      </div>
    </article>
  );
}
