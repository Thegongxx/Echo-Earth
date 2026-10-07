import { useEffect, useState } from "react";
import { ImagePlus, Music2, Paintbrush, X } from "lucide-react";
import type { MediaFiles } from "../types";
const slots = [
  {
    key: "image",
    title: "一张照片",
    hint: "JPG / PNG / WebP · ≤ 10 MB",
    icon: ImagePlus,
    accept: "image/jpeg,image/png,image/webp",
  },
  {
    key: "drawing",
    title: "一幅绘画",
    hint: "JPG / PNG / WebP · ≤ 10 MB",
    icon: Paintbrush,
    accept: "image/jpeg,image/png,image/webp",
  },
  {
    key: "audio",
    title: "一段原创声音",
    hint: "音频文件 · ≤ 20 MB",
    icon: Music2,
    accept: "audio/*",
  },
] as const;
function Preview({ file, kind }: { file: File; kind: keyof MediaFiles }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return kind === "audio" ? (
    <audio controls src={url} preload="metadata" />
  ) : (
    <img src={url} alt={kind === "image" ? "上传照片预览" : "上传绘画预览"} />
  );
}
export default function MediaUploader({
  files,
  onChange,
  authorized,
  onAuthorized,
}: {
  files: MediaFiles;
  onChange: (files: MediaFiles) => void;
  authorized: boolean;
  onAuthorized: (v: boolean) => void;
}) {
  const [error, setError] = useState("");
  function select(key: keyof MediaFiles, file?: File) {
    if (!file) return;
    const max = key === "audio" ? 20 : 10;
    if (file.size > max * 1024 * 1024) {
      setError(
        `文件过大，${key === "audio" ? "音频" : "图片"}最多 ${max} MB。`,
      );
      return;
    }
    if (
      key === "audio"
        ? !file.type.startsWith("audio/")
        : !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("文件格式不支持，请选择常见的图片或音频格式。");
      return;
    }
    setError("");
    onChange({ ...files, [key]: file });
  }
  return (
    <>
      <div className="upload-grid">
        {slots.map(({ key, title, hint, icon: Icon, accept }) => (
          <div
            className={`upload-slot ${files[key] ? "has-file" : ""}`}
            key={key}
          >
            {files[key] ? (
              <>
                <Preview file={files[key]!} kind={key} />
                <span className="filename">{files[key]!.name}</span>
                <button
                  className="icon-button remove-file"
                  aria-label={`移除${title}`}
                  onClick={() => {
                    const next = { ...files };
                    delete next[key];
                    onChange(next);
                    if (key === "audio") onAuthorized(false);
                  }}
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <label className="upload-target">
                <Icon size={23} />
                <strong>{title}</strong>
                <small>{hint}</small>
                <input
                  type="file"
                  accept={accept}
                  onChange={(e) => select(key, e.target.files?.[0])}
                />
              </label>
            )}
          </div>
        ))}
      </div>
      {files.audio && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => onAuthorized(e.target.checked)}
          />
          <span>
            此音频为我的原创，或我拥有公开分享授权。未经许可的商业歌曲不可上传或公开播放。
          </span>
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
