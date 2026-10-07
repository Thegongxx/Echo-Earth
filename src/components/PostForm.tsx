import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Headphones,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
  VolumeX,
} from "lucide-react";
import type {
  EchoRecord,
  Location,
  MediaFiles,
  Mood,
  PostInput,
} from "../types";
import { MOODS, validatePost } from "../types";
import { provider } from "../data/provider";
import { fixedMoodSuggestions } from "../domain/themes";
import LocationPicker from "./LocationPicker";
import MediaUploader from "./MediaUploader";
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateWithOffset(date: string, time: string) {
  const d = new Date(`${date}T${time || "12:00"}:00`);
  const offset = -d.getTimezoneOffset();
  return `${date}T${time || "12:00"}:00${offset >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
}
export default function PostForm({
  onPublished,
}: {
  onPublished: (p: EchoRecord) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const formCard = useRef<HTMLElement>(null);
  const stepBody = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (step === previousStep.current) return;
    previousStep.current = step;
    formCard.current?.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    stepBody.current?.focus({ preventScroll: true });
  }, [step]);
  const [location, setLocation] = useState<Location>();
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState("18:00");
  const [moods, setMoods] = useState<Mood[]>([]);
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<MediaFiles>({});
  const [authorized, setAuthorized] = useState(false);
  const [hasSong, setHasSong] = useState(false);
  const [song, setSong] = useState({
    title: "",
    artist: "",
    shareUrl: "",
    mid: "",
  });
  const [anonymous, setAnonymous] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<Mood[]>([]);
  const silent =
    !text.trim() && !Object.values(files).some(Boolean) && !hasSong;
  const steps = ["选择地点", "日期与心情", "添加内容", "选择身份", "确认投递"];
  function next() {
    setError("");
    if (step === 0 && !location) {
      setError("请先选点，并点击“确认地点，继续”。");
      return;
    }
    if (step === 1 && (!date || !moods.length)) {
      setError("请选择记忆日期和至少一种心情。");
      return;
    }
    if (step === 2 && files.audio && !authorized) {
      setError("请勾选音频公开分享授权确认。");
      return;
    }
    if (step === 2 && hasSong) {
      try {
        new URL(song.shareUrl);
      } catch {
        setError("请填写有效的 QQ 音乐官方分享链接。");
        return;
      }
    }
    if (step === 3 && !anonymous && !displayName.trim()) {
      setError("请填写昵称，或选择匿名。");
      return;
    }
    setStep(Math.min(step + 1, 4));
  }
  function toggleMood(mood: Mood) {
    setError("");
    if (moods.includes(mood)) setMoods(moods.filter((m) => m !== mood));
    else if (moods.length < 3) setMoods([...moods, mood]);
    else setError("最多选择 3 种心情。");
  }
  async function publish() {
    if (!location) return;
    setError("");
    const post: PostInput = {
      anonymous,
      displayName: anonymous ? "" : displayName.trim(),
      occurredAt: dateWithOffset(date, time),
      location,
      moods,
      tags: tags
        .split(/[，,]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6),
      text: text.trim(),
      qqMusic: hasSong ? song : undefined,
      audioAuthorized: authorized,
      visibility,
    };
    try {
      validatePost(post, files);
      setBusy(true);
      const result = await provider.createPost(post, files, setProgress);
      await onPublished(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "投递失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="inner-page delivery-page" id="main-content">
      <div className="page-heading">
        <span className="eyebrow">LEAVE A LITTLE ECHO</span>
        <h1>把这一刻，留在那个地方。</h1>
        <p>一个地点，一种心情。其它的，都可以慢慢来。</p>
      </div>
      <div className="delivery-layout">
        <section className="form-card" ref={formCard}>
          <ol className="steps">
            {steps.map((s, i) => (
              <li
                className={i === step ? "active" : i < step ? "complete" : ""}
                key={s}
              >
                <span>{i < step ? <Check size={13} /> : i + 1}</span>
                <small>{s}</small>
              </li>
            ))}
          </ol>
          <div
            className="step-body"
            key={step}
            ref={stepBody}
            tabIndex={-1}
            role="group"
            aria-label={steps[step]}
          >
            {step === 0 && (
              <>
                <h2>记忆发生在哪里？</h2>
                <LocationPicker
                  value={location}
                  onChange={setLocation}
                  onConfirmed={() => {
                    setError("");
                    setStep(1);
                  }}
                />
              </>
            )}
            {step === 1 && (
              <>
                <h2>那一天，你的心情是什么？</h2>
                <p className="muted">
                  记忆可以来自过去。发布时间会在投递时单独记录。
                </p>
                <div className="field-grid">
                  <label>
                    记忆日期
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    记忆当地时间
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </label>
                </div>
                <label className="field-title">
                  选择 1–3 种心情 <small>{moods.length} / 3</small>
                </label>
                <div className="mood-picker">
                  {MOODS.map((m, i) => (
                    <button
                      key={m}
                      className={
                        moods.includes(m)
                          ? "mood-choice selected"
                          : "mood-choice"
                      }
                      onClick={() => toggleMood(m)}
                      aria-pressed={moods.includes(m)}
                    >
                      <span>{["☀", "≈", "◷", "☾", "✧", "☁", "❋", "↗"][i]}</span>
                      {m}
                    </button>
                  ))}
                </div>
                <div className="quiet-note">
                  <VolumeX size={19} />
                  <div>
                    <strong>不必有故事，心情本身就是回声。</strong>
                    <p>只选地点和心情，也可以投递一封「静默回声」。</p>
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h2>为记忆留一点线索。</h2>
                <p className="muted">
                  所有内容都可以跳过；照片、绘画、文字、音乐可自由组合。
                </p>
                <button className="text-button skip-content" onClick={next}>
                  {silent ? "跳过内容，留下静默回声" : "完成内容，继续"}
                  <ArrowRight size={15} />
                </button>
                <label>
                  想说的话 <small>可选 · {text.length}/1000</small>
                  <textarea
                    maxLength={1000}
                    rows={4}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="那天的风、一个人、或者一首听了很久的歌…"
                  />
                </label>
                <button
                  className="text-button suggestion-button"
                  disabled={!text.trim()}
                  onClick={async () =>
                    setSuggestions(await fixedMoodSuggestions.suggest(text))
                  }
                >
                  <Sparkles size={14} /> 根据关键词建议心情
                </button>
                {suggestions.length > 0 && (
                  <div className="suggestions">
                    <small>固定关键词规则 · 未使用 AI</small>
                    {suggestions.map((m) => (
                      <button
                        className="chip"
                        key={m}
                        onClick={() => toggleMood(m)}
                      >
                        {moods.includes(m) ? "✓ " : "+ "}
                        {m}
                      </button>
                    ))}
                  </div>
                )}
                <MediaUploader
                  files={files}
                  onChange={setFiles}
                  authorized={authorized}
                  onAuthorized={setAuthorized}
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={hasSong}
                    onChange={(e) => setHasSong(e.target.checked)}
                  />
                  <span>
                    关联一首 QQ 音乐歌曲 <small>只保存信息与官方分享链接</small>
                  </span>
                </label>
                {hasSong && (
                  <div className="song-fields field-grid">
                    <label>
                      歌曲标题
                      <input
                        value={song.title}
                        onChange={(e) =>
                          setSong({ ...song, title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      歌手
                      <input
                        value={song.artist}
                        onChange={(e) =>
                          setSong({ ...song, artist: e.target.value })
                        }
                      />
                    </label>
                    <label className="full-field">
                      官方分享链接
                      <input
                        type="url"
                        value={song.shareUrl}
                        onChange={(e) =>
                          setSong({ ...song, shareUrl: e.target.value })
                        }
                        placeholder="https://y.qq.com/…"
                      />
                    </label>
                    <label className="full-field">
                      歌曲 ID / MID（可选）
                      <input
                        value={song.mid}
                        onChange={(e) =>
                          setSong({ ...song, mid: e.target.value })
                        }
                      />
                    </label>
                    <p className="muted full-field small">
                      关联后通过「打开 QQ 音乐听」访问官方页面，本站不储存 QQ
                      音乐音源。
                    </p>
                  </div>
                )}
                <label>
                  主题标签 <small>可选，使用逗号分隔，最多 6 个</small>
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="例如：毕业，校园，雨天"
                  />
                </label>
              </>
            )}
            {step === 3 && (
              <>
                <h2>让世界怎样认识你？</h2>
                <p className="muted">
                  匿名也有内部归属，你可以随时管理自己投递的回声。
                </p>
                <div className="identity-options">
                  <button
                    className={anonymous ? "identity selected" : "identity"}
                    aria-pressed={anonymous}
                    onClick={() => setAnonymous(true)}
                  >
                    <span>☾</span>
                    <strong>匿名的旅人</strong>
                    <small>只留下记忆，不显示昵称</small>
                  </button>
                  <button
                    className={!anonymous ? "identity selected" : "identity"}
                    aria-pressed={!anonymous}
                    onClick={() => setAnonymous(false)}
                  >
                    <span>✧</span>
                    <strong>留下我的昵称</strong>
                    <small>让回声有一个名字</small>
                  </button>
                </div>
                {!anonymous && (
                  <label>
                    昵称
                    <input
                      maxLength={24}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="希望大家怎样称呼你？"
                    />
                  </label>
                )}
                <label className="field-title">谁可以看到？</label>
                <div className="segmented">
                  <button
                    className={visibility === "public" ? "active" : ""}
                    aria-pressed={visibility === "public"}
                    onClick={() => setVisibility("public")}
                  >
                    公开 · 出现在星球
                  </button>
                  <button
                    className={visibility === "private" ? "active" : ""}
                    aria-pressed={visibility === "private"}
                    onClick={() => setVisibility("private")}
                  >
                    私密 · 只留给自己
                  </button>
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <h2>
                  {silent
                    ? "一封安静的回声，准备出发。"
                    : "你的回声，准备出发。"}
                </h2>
                <p className="muted">
                  确认这份记忆的坐标与心情，然后轻轻投递。
                </p>
                <div className="publish-summary">
                  <MapPin size={22} />
                  <div>
                    <strong>
                      {location?.city} · {location?.placeName}
                    </strong>
                    <p>
                      {date} {time} · 记忆发生时间
                    </p>
                    <div className="tag-row">
                      {moods.map((m) => (
                        <span className="mood-tag" key={m}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {text && <blockquote>{text}</blockquote>}
                <div className="summary-line">
                  <span>内容</span>
                  <strong>
                    {silent
                      ? "静默回声"
                      : [
                          text && "文字",
                          files.image && "照片",
                          files.drawing && "绘画",
                          files.audio && "授权音频",
                          hasSong && "QQ 音乐链接",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </strong>
                </div>
                <div className="summary-line">
                  <span>展示方式</span>
                  <strong>
                    {anonymous ? "匿名的旅人" : displayName} ·{" "}
                    {visibility === "public" ? "公开" : "私密"}
                  </strong>
                </div>
                <div className="quiet-note">
                  <ShieldCheck size={20} />
                  <p>
                    {provider.mode === "demo"
                      ? "本地演示模式：保存到此浏览器，不会上传到云端。刷新后保留；清理浏览器数据会移除记录。"
                      : "CloudBase 模式：公开帖子提交后进入待审核，审核通过并重新读取后显示在公开星球。"}
                  </p>
                </div>
                {busy && (
                  <div className="progress-wrap" aria-live="polite">
                    <div className="progress">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <small>正在保存回声 {progress}%</small>
                  </div>
                )}
              </>
            )}
          </div>
          {error && (
            <p className="error form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            {step > 0 ? (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setStep(step - 1);
                }}
              >
                <ArrowLeft size={16} />
                上一步
              </button>
            ) : (
              <span className="muted small">
                核对地图标记后，点击“确认地点，继续”。
              </span>
            )}
            {step === 0 ? null : step < 4 ? (
              <button
                className="primary"
                disabled={step === 0 && !location}
                onClick={next}
              >
                {step === 0 && !location ? "请先确认地点" : "继续"}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void publish()}
              >
                <Send size={16} />
                {busy ? "正在投递…" : "投递这份回声"}
              </button>
            )}
          </div>
        </section>
        <aside className="form-aside">
          <div className="delivery-location-symbol">
            <MapPin size={52} strokeWidth={1} />
            <span>让记忆有一个位置</span>
          </div>
          <span className="eyebrow">A MEMORY, A COORDINATE</span>
          <h3>
            世界很大，
            <br />
            你的记忆有一个位置。
          </h3>
          <p>
            即使只是一段无声的心情，
            <br />
            也有人会在某个瞬间与你共鸣。
          </p>
          <div className="preview-note">
            <MapPin size={16} />
            <span>
              {location
                ? `${location.city} · ${location.placeName}`
                : "等待一个坐标"}
            </span>
          </div>
          <div className="preview-note">
            <Headphones size={16} />
            <span>{silent ? "静默，也是一种回声" : "你的记忆正在成形"}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
