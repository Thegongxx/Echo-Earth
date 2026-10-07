import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe2,
  Headphones,
  MapPin,
  Minus,
  Pause,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Waves,
  X,
  EyeOff,
  Eye,
  CheckCircle2,
} from "lucide-react";
import type { EchoRecord, Mood, PublicEcho } from "./types";
import { MOODS } from "./types";
import { provider, configError } from "./data/provider";
import { THEMES, matchReason, matchesTheme, themeRoute } from "./domain/themes";
import EarthExplorer from "./components/EarthExplorer";
import type { ExplorerHandle } from "./components/EarthExplorer";
import EchoDetail, { memoryDate, titleOf } from "./components/EchoDetail";
import ThemeArtwork from "./components/ThemeArtwork";
import { usePageMotion } from "./lib/usePageMotion";
const PostForm = lazy(() => import("./components/PostForm"));
import Dialog from "./components/Dialog";
type Page = "planet" | "roam" | "deliver" | "mine";
const NAV = [
  { id: "planet", title: "星球", icon: Globe2 },
  { id: "roam", title: "主题漫游", icon: Compass },
  { id: "deliver", title: "投递回声", icon: Send },
  { id: "mine", title: "我的回声", icon: UserRound },
] as const;
function EchoCard({
  post,
  onClick,
  highlightMood,
}: {
  post: PublicEcho;
  onClick: () => void;
  highlightMood?: Mood;
}) {
  return (
    <button className="echo-card" data-reveal onClick={onClick}>
      <div className="echo-card-image">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt="" />
        ) : (
          <div className="quiet-card">
            <Waves size={25} />
          </div>
        )}
        <span>
          {post.demo
            ? "虚构样例"
            : provider.mode === "demo"
              ? "本机回声"
              : "公开回声"}
        </span>
      </div>
      <div className="echo-card-body">
        <span className="card-location">
          <MapPin size={11} />
          {post.location.city}
          <small>{highlightMood || post.moods[0]}</small>
        </span>
        <h3>{titleOf(post)}</h3>
        <div className="card-meta">
          <span>记忆 {memoryDate(post.occurredAt)}</span>
          <span>
            {post.demo ? "示例发布" : "发布"} {memoryDate(post.createdAt)}
          </span>
        </div>
      </div>
      <ChevronRight className="card-arrow" size={17} />
    </button>
  );
}
export default function App() {
  const [page, setPage] = useState<Page>("planet");
  const [posts, setPosts] = useState<PublicEcho[]>([]);
  const [mine, setMine] = useState<EchoRecord[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [modalPost, setModalPost] = useState<PublicEcho>();
  const [mood, setMood] = useState<Mood | "">("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [activeTheme, setActiveTheme] = useState<string>();
  const [rotating, setRotating] = useState(
    !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [flightId, setFlightId] = useState<string>();
  const [toast, setToast] = useState("");
  const [myTab, setMyTab] = useState<"created" | "saved">("created");
  const [deleteTarget, setDeleteTarget] = useState<EchoRecord>();
  const [mutation, setMutation] = useState(false);
  usePageMotion(page, !loading, activeTheme);
  const globe = useRef<ExplorerHandle>(null);
  const reload = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [publicPosts, myPosts, saved] = await Promise.all([
        provider.listPublicPosts(),
        provider.listMyPosts(),
        provider.getFavorites(),
      ]);
      setPosts(publicPosts);
      setMine(myPosts);
      setFavorites(saved);
      setSelectedId((id) => id || publicPosts[0]?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "回声加载失败，请重试。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const theme = THEMES.find((t) => t.id === activeTheme);
  const route = useMemo(
    () => (theme ? themeRoute(posts, theme) : []),
    [posts, theme],
  );
  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (!mood || p.moods.includes(mood)) &&
          (!city ||
            `${p.location.city}${p.location.placeName}`.includes(city)) &&
          (!date || p.occurredAt.startsWith(date)) &&
          (!themeFilter ||
            matchesTheme(
              p,
              THEMES.find((t) => t.id === themeFilter)!,
            )),
      ),
    [posts, mood, city, date, themeFilter],
  );
  const selected = posts.find((p) => p.id === selectedId);
  useEffect(() => {
    if (
      page === "planet" &&
      selectedId &&
      !filtered.some((p) => p.id === selectedId)
    ) {
      setSelectedId(filtered[0]?.id);
      setDetailOpen(false);
    }
  }, [filtered, selectedId, page]);
  useEffect(() => {
    if (flightId) {
      const t = setTimeout(() => setFlightId(undefined), 2200);
      return () => clearTimeout(t);
    }
  }, [flightId]);
  const shownMine =
    myTab === "created"
      ? mine
      : posts
          .filter((p) => favorites.includes(p.id))
          .concat(
            mine.filter(
              (p) => p.visibility === "private" && favorites.includes(p.id),
            ),
          );
  const cities = new Set(posts.map((p) => p.location.city));
  function navigate(p: Page) {
    setPage(p);
    setDetailOpen(false);
    setModalPost(undefined);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function choose(p: PublicEcho) {
    setSelectedId(p.id);
    setDetailOpen(true);
    if (matchMedia("(max-width: 1180px)").matches) setModalPost(p);
  }
  async function favorite(p: PublicEcho) {
    try {
      const saved = !favorites.includes(p.id);
      await provider.setFavorite(p.id, saved);
      setFavorites((ids) =>
        saved ? [...ids, p.id] : ids.filter((id) => id !== p.id),
      );
      setToast(saved ? "回声已放进你的收藏。" : "已取消收藏。");
    } catch {
      setToast("收藏未能保存，请检查本地存储。");
    }
  }
  function similar(p: PublicEcho) {
    const related = THEMES.find((t) => matchesTheme(p, t));
    if (related) {
      setActiveTheme(related.id);
      navigate("roam");
      setSelectedId(p.id);
    } else {
      setMood(p.moods[0]);
      setCity("");
      setDate("");
      setThemeFilter("");
      navigate("planet");
      setSelectedId(p.id);
      setToast(`已筛选共同心情：${p.moods[0]}`);
    }
  }
  async function published(p: EchoRecord) {
    await reload();
    setMood("");
    setCity("");
    setDate("");
    setThemeFilter("");
    if (p.visibility === "public" && p.status === "approved") {
      setSelectedId(p.id);
      setFlightId(p.id);
      navigate("planet");
      setDetailOpen(true);
      setToast("投递成功！你的回声已抵达地球。");
    } else {
      navigate("mine");
      setMyTab("created");
      setToast(
        p.visibility === "private"
          ? "私密回声已保存，只有你能看到。"
          : "回声已提交，审核通过后会出现在地球。",
      );
    }
  }
  async function visibility(p: EchoRecord) {
    try {
      setMutation(true);
      await provider.setVisibility(
        p.id,
        p.visibility === "public" ? "private" : "public",
      );
      await reload();
      setToast(
        p.visibility === "public"
          ? "已取消公开，回声保留在你的时间线。"
          : "已设为公开。",
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : "修改失败");
    } finally {
      setMutation(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    try {
      setMutation(true);
      await provider.deletePost(deleteTarget.id);
      setDeleteTarget(undefined);
      await reload();
      setToast("这封回声已删除。");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "删除失败");
    } finally {
      setMutation(false);
    }
  }
  const closeModal = useCallback(() => setModalPost(undefined), []);
  const closeDelete = useCallback(() => setDeleteTarget(undefined), []);
  const detail = selected ? (
    <EchoDetail
      key={selected.id}
      post={selected}
      saved={favorites.includes(selected.id)}
      onFavorite={() => void favorite(selected)}
      onClose={() => {
        setDetailOpen(false);
        setSelectedId(undefined);
      }}
      onSimilar={() => similar(selected)}
    />
  ) : (
    <div className="empty-selection">
      <Headphones size={29} />
      <h3>听见一个远方。</h3>
      <p>
        点击地球上的光点，
        <br />
        打开一段音乐记忆。
      </p>
    </div>
  );
  return (
    <div className="app atlas-design">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => navigate("planet")}
          aria-label="回声地球首页"
        >
          <span className="brand-mark">
            <Waves size={21} />
          </span>
          <span>
            回声地球<small>ECHO ATLAS</small>
          </span>
        </button>
        <nav className="top-nav" aria-label="主导航">
          {NAV.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={15} />
              {title}
            </button>
          ))}
        </nav>
        <div className="header-end">
          <span className="mode-badge">
            <span className="status-dot" />
            {provider.mode === "demo" ? "本地演示模式" : "CloudBase 模式"}
          </span>
          <button className="header-create" onClick={() => navigate("deliver")}>
            <Plus size={16} />
            留下回声
          </button>
        </div>
      </header>
      {(configError || error) && (
        <div className="global-error" role="alert">
          {error || configError}
          {error && (
            <button className="text-button" onClick={() => void reload()}>
              重新读取
            </button>
          )}
        </div>
      )}
      {page === "planet" && (
        <main className="planet-page" id="main-content">
          <div className="planet-heading">
            <div>
              <span className="eyebrow">
                <span className="tiny-spark">✦</span> A WORLD OF MEMORIES
              </span>
              <span className="intro-subtitle">一个以音乐连接记忆的星球</span>
            </div>
            <p>
              <span className="intro-line" /> 音乐 · 地点 · 记忆
            </p>
          </div>
          <div className="planet-layout">
            <aside className="hero-copy" data-reveal>
              <span className="chapter-label">01 — LISTEN TO THE WORLD</span>
              <h1>
                让音乐，
                <br />
                <span>有处可回。</span>
              </h1>
              <p>
                一首歌，一个地点，
                <br />
                一段不想忘记的心情。
                <br />
                留下此刻，也听见远方。
              </p>
              <button className="primary" onClick={() => navigate("deliver")}>
                <Plus size={16} />
                留下我的回声
                <ArrowRight size={16} />
              </button>
              <button
                className="hero-roam text-button"
                onClick={() => navigate("roam")}
              >
                <Compass size={16} />
                跟着心情，去漫游 <ArrowRight size={16} />
              </button>
              <div className="hero-stats">
                <div>
                  <strong>
                    {posts.length.toString().padStart(2, "0")}
                    <i> ✦</i>
                  </strong>
                  <small>可探索回声</small>
                </div>
                <div>
                  <strong>{cities.size.toString().padStart(2, "0")}</strong>
                  <small>记忆坐标</small>
                </div>
              </div>
              <div className="demo-caption">
                <Radio size={13} />
                {provider.mode === "demo"
                  ? "包含 12 条虚构样例与本机新增回声"
                  : "仅展示审核通过的公开回声"}
              </div>
            </aside>
            <section className="earth-stage">
              <div className="earth-filter">
                <label>
                  <span>心情</span>
                  <select
                    aria-label="按心情筛选"
                    value={mood}
                    onChange={(e) => setMood(e.target.value as Mood | "")}
                  >
                    <option value="">所有心情</option>
                    {MOODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <span className="filter-divider" />
                <label className="city-search">
                  <Search size={13} />
                  <input
                    aria-label="按城市或地点筛选"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="城市 / 地点"
                    list="cities"
                  />
                  <datalist id="cities">
                    {[...cities].map((c) => (
                      <option value={c} key={c} />
                    ))}
                  </datalist>
                </label>
              </div>
              <EarthExplorer
                ref={globe}
                posts={filtered}
                selectedId={selectedId}
                onSelect={(p, expanded) => {
                  choose(p);
                  if (expanded) setModalPost(p);
                }}
                rotating={rotating}
                onRotationChange={setRotating}
                flightId={flightId}
              />
              {!loading && filtered.length === 0 && (
                <div className="globe-empty">
                  <p>这些条件下，还没有回声。</p>
                  <button
                    className="secondary"
                    onClick={() => {
                      setMood("");
                      setCity("");
                      setDate("");
                      setThemeFilter("");
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </section>
            <aside
              data-reveal
              className={`detail-wrap ${detailOpen ? "is-open" : ""}`}
            >
              <div className="selected-caption">
                <span className="tiny-spark">✦</span>来自地球的一封信
              </div>
              {detail}
            </aside>
          </div>
          <section className="recent-section" data-reveal>
            <div className="mood-discovery">
              <div>
                <span className="eyebrow">FIND YOUR FREQUENCY</span>
                <h2>此刻，你与哪种心情共鸣？</h2>
              </div>
              <div
                className="mood-discovery-options"
                role="group"
                aria-label="快捷心情筛选"
              >
                {(["", "平静", "怀念", "治愈", "期待"] as const).map((m) => (
                  <button
                    key={m}
                    className={mood === m ? "active" : ""}
                    aria-pressed={mood === m}
                    onClick={() => setMood(m)}
                  >
                    {m || "全部回声"}
                    {m && <span aria-hidden="true">↗</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="section-head">
              <div>
                <span className="eyebrow">RECENT ECHOES</span>
                <h2>
                  最近发布的回声
                  <span aria-live="polite">{filtered.length} 条回声</span>
                </h2>
              </div>
              <div className="extra-filters">
                <label>
                  <select
                    aria-label="按主题筛选"
                    value={themeFilter}
                    onChange={(e) => setThemeFilter(e.target.value)}
                  >
                    <option value="">所有主题</option>
                    {THEMES.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="date"
                    aria-label="按记忆发生日期筛选"
                    title="按记忆发生日期筛选"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                {(mood || city || date || themeFilter) && (
                  <button
                    className="icon-button"
                    onClick={() => {
                      setMood("");
                      setCity("");
                      setDate("");
                      setThemeFilter("");
                    }}
                    aria-label="清除所有筛选"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <div className="cards-loading" role="status">
                正在拾起世界各地的回声…
              </div>
            ) : (
              <div className="recent-grid">
                {filtered.slice(0, 4).map((p) => (
                  <EchoCard
                    key={p.id}
                    post={p}
                    highlightMood={mood || undefined}
                    onClick={() => {
                      choose(p);
                      setModalPost(p);
                    }}
                  />
                ))}
              </div>
            )}
            <div className="recent-foot">
              <span>
                按实际发布时间排列 · 卡片另列记忆日期
                {provider.mode === "demo" ? " · 虚构样例并非实时上传" : ""}
              </span>
              <button className="text-button" onClick={() => navigate("roam")}>
                沿着心情去旅行
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
        </main>
      )}
      {page === "roam" && (
        <main className="inner-page roam-page" id="main-content">
          <div className="page-heading" data-reveal>
            <span className="eyebrow">FOLLOW A FEELING</span>
            <h1>{theme ? theme.routeTitle : "不必有目的地，跟着心情走。"}</h1>
            <p>
              {theme
                ? "几段相似的记忆，串成一场温柔的旅行。"
                : "沿着同一种心情，听见世界另一端的回声。"}
            </p>
          </div>
          {!theme ? (
            <>
              <div className="theme-grid">
                {THEMES.map((t, i) => {
                  const count = themeRoute(posts, t).length;
                  return (
                    <button
                      className={`theme-card theme-${i}`}
                      style={
                        { "--theme-color": t.color } as React.CSSProperties
                      }
                      key={t.id}
                      data-reveal
                      onClick={() => {
                        setActiveTheme(t.id);
                        setSelectedId(themeRoute(posts, t)[0]?.id);
                      }}
                    >
                      <span className="theme-number">
                        0{i + 1} / A LITTLE JOURNEY
                      </span>
                      <div className="theme-art">
                        <ThemeArtwork variant={i} />
                      </div>
                      <span className="theme-label">{t.label}</span>
                      <h2>{t.title}</h2>
                      <p>{t.subtitle}</p>
                      <div className="theme-card-footer">
                        <span>{count} 站回声 · 固定规则匹配</span>
                        <ArrowRight size={19} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="rule-notice">
                <Sparkles size={14} />
                主题路线按固定心情与标签匹配，未调用 AI
                服务。每一站都会告诉你被选中的原因。
              </p>
            </>
          ) : (
            <>
              <button
                className="text-button back-themes"
                onClick={() => setActiveTheme(undefined)}
              >
                <ChevronLeft size={15} />
                返回全部主题
              </button>
              <div className="route-layout">
                <div className="route-earth">
                  <EarthExplorer
                    ref={globe}
                    posts={route}
                    route={route}
                    selectedId={selectedId}
                    onSelect={(p) => {
                      setSelectedId(p.id);
                      setModalPost(p);
                    }}
                    rotating={rotating}
                    onRotationChange={setRotating}
                  />
                  <div className="route-earth-caption">
                    <Compass size={18} />
                    {route.length} 个坐标，一段共同的心情
                  </div>
                </div>
                <section className="route-list">
                  <div className="route-rule">
                    <span className="eyebrow">YOUR ITINERARY</span>
                    <h2>
                      {theme.title} · {route.length} 站
                    </h2>
                    <p>{theme.rule}</p>
                  </div>
                  {route.length === 0 ? (
                    <div className="empty-state">
                      <Compass size={30} />
                      <h3>这条路线还在等待回声。</h3>
                      <button
                        className="primary"
                        onClick={() => navigate("deliver")}
                      >
                        留下第一份记忆
                      </button>
                    </div>
                  ) : (
                    route.map((p, i) => (
                      <button
                        className={`route-stop ${selectedId === p.id ? "active" : ""}`}
                        key={p.id}
                        onClick={() => {
                          setSelectedId(p.id);
                          setModalPost(p);
                        }}
                      >
                        <span className="stop-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          {p.imageUrl && <img src={p.imageUrl} alt="" />}
                          <span className="route-stop-content">
                            <small>
                              {p.location.city} · {memoryDate(p.occurredAt)}
                            </small>
                            <strong>{titleOf(p)}</strong>
                            <em>{matchReason(p, theme)}</em>
                          </span>
                        </div>
                        <ArrowRight size={16} />
                      </button>
                    ))
                  )}
                  {route.length > 0 && (
                    <button
                      className="primary route-begin"
                      onClick={() => {
                        setSelectedId(route[0].id);
                        setModalPost(route[0]);
                      }}
                    >
                      <Headphones size={16} />
                      从第一站开始听
                    </button>
                  )}
                  {route.length > 0 && route.length < 3 && (
                    <p className="muted small">
                      当前只有 {route.length}{" "}
                      条匹配的公开回声；不添加不符合规则的内容。
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      )}
      {page === "deliver" && (
        <Suspense
          fallback={
            <main className="inner-page" id="main-content">
              <div className="cards-loading" role="status">
                正在准备投递表单…
              </div>
            </main>
          }
        >
          <PostForm onPublished={published} />
        </Suspense>
      )}
      {page === "mine" && (
        <main className="inner-page my-page" id="main-content">
          <div className="page-heading" data-reveal>
            <span className="eyebrow">MY LITTLE UNIVERSE</span>
            <h1>属于你的，记忆星图。</h1>
            <p>
              {provider.mode === "demo"
                ? "这里保存着此浏览器创建和收藏的回声。"
                : "管理你的云端回声与此浏览器收藏。"}
              按记忆发生日期排列。
            </p>
          </div>
          <div className="my-toolbar">
            <div className="segmented">
              <button
                className={myTab === "created" ? "active" : ""}
                onClick={() => setMyTab("created")}
              >
                <Send size={15} />
                我的投递 <span>{mine.length}</span>
              </button>
              <button
                className={myTab === "saved" ? "active" : ""}
                onClick={() => setMyTab("saved")}
              >
                <Bookmark size={15} />
                我的收藏 <span>{favorites.length}</span>
              </button>
            </div>
            <button className="primary" onClick={() => navigate("deliver")}>
              <Plus size={16} />
              投递新回声
            </button>
          </div>
          {loading ? (
            <div className="empty-state">正在读取你的回声…</div>
          ) : shownMine.length === 0 ? (
            <div className="empty-state">
              <div className="empty-orbit">
                <Waves size={34} />
              </div>
              <h2>
                {myTab === "created"
                  ? "你的第一份记忆，从这里开始。"
                  : "遇见喜欢的回声，就把它收藏。"}
              </h2>
              <p>
                {myTab === "created"
                  ? "不需要照片或一整段故事。一个地点，一种心情就够了。"
                  : "打开回声详情，点击“收藏回声”，它就会留在这里。"}
              </p>
              <button
                className="secondary"
                onClick={() =>
                  navigate(myTab === "created" ? "deliver" : "planet")
                }
              >
                {myTab === "created" ? "留下我的回声" : "去星球看看"}
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="timeline">
              {[...shownMine]
                .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                .map((p) => (
                  <article className="timeline-item" key={p.id}>
                    <div className="timeline-date">
                      <strong>
                        {p.occurredAt.slice(5, 10).replace("-", " / ")}
                      </strong>
                      <span>{p.occurredAt.slice(0, 4)}</span>
                    </div>
                    <div className="timeline-point" />
                    <div className="timeline-card">
                      <button
                        className="timeline-main"
                        onClick={() => setModalPost(p)}
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" />
                        ) : (
                          <span className="timeline-silent">
                            <Waves size={25} />
                          </span>
                        )}
                        <span>
                          <small>
                            <MapPin size={12} />
                            {p.location.city} · {p.location.placeName}
                          </small>
                          <strong>{titleOf(p)}</strong>
                          <span className="tag-row">
                            {p.moods.map((m) => (
                              <i className="mood-tag" key={m}>
                                {m}
                              </i>
                            ))}
                          </span>
                          <em>
                            发布时间{" "}
                            {new Date(p.createdAt).toLocaleString("zh-CN")} ·{" "}
                            {p.demo
                              ? "虚构样例"
                              : p.visibility === "private"
                                ? "私密"
                                : p.status === "pending"
                                  ? "待审核"
                                  : "公开"}
                          </em>
                        </span>
                      </button>
                      <div className="timeline-actions">
                        {myTab === "created" ? (
                          <>
                            <button
                              className="text-button"
                              disabled={mutation}
                              onClick={() => void visibility(p as EchoRecord)}
                            >
                              {p.visibility === "public" ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}{" "}
                              {p.visibility === "public"
                                ? "取消公开"
                                : "设为公开"}
                            </button>
                            <button
                              className="text-button danger"
                              disabled={mutation}
                              onClick={() => setDeleteTarget(p as EchoRecord)}
                            >
                              <Trash2 size={14} />
                              删除
                            </button>
                          </>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() => void favorite(p)}
                          >
                            <Bookmark size={14} />
                            取消收藏
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          )}
          {myTab === "saved" &&
            favorites.some((id) => !shownMine.some((p) => p.id === id)) && (
              <p className="muted small">
                部分收藏已被设为私密或删除，无法继续公开访问。
              </p>
            )}
        </main>
      )}
      <footer className="site-footer">
        <div className="footer-wordmark">
          ECHO<span>ATLAS</span>
          <Waves size={34} strokeWidth={1} />
        </div>
        <div className="footer-caption">
          <span>让每一份记忆，在世界上有回响。</span>
          <small>腾讯音乐 Build With AI · 高校 AI Hackathon 作品原型</small>
        </div>
        <button
          className="text-button footer-top"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            })
          }
        >
          回到顶部 <ArrowRight size={16} />
        </button>
      </footer>
      <nav className="bottom-nav" aria-label="手机主导航">
        {NAV.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            aria-current={page === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{title}</span>
          </button>
        ))}
      </nav>
      {modalPost && (
        <Dialog label="回声详情" onClose={closeModal}>
          <EchoDetail
            key={modalPost.id}
            post={modalPost}
            saved={favorites.includes(modalPost.id)}
            onFavorite={() => void favorite(modalPost)}
            onClose={closeModal}
            onSimilar={() => similar(modalPost)}
          />
          {page === "roam" &&
            theme &&
            route.some((p) => p.id === modalPost.id) && (
              <div className="route-modal-nav">
                <button
                  className="secondary"
                  disabled={route.findIndex((p) => p.id === modalPost.id) <= 0}
                  onClick={() => {
                    const index = route.findIndex((p) => p.id === modalPost.id);
                    setModalPost(route[index - 1]);
                    setSelectedId(route[index - 1].id);
                  }}
                >
                  <ChevronLeft size={14} />
                  上一站
                </button>
                <small>
                  {route.findIndex((p) => p.id === modalPost.id) + 1} /{" "}
                  {route.length}
                </small>
                <button
                  className="secondary"
                  disabled={
                    route.findIndex((p) => p.id === modalPost.id) >=
                    route.length - 1
                  }
                  onClick={() => {
                    const index = route.findIndex((p) => p.id === modalPost.id);
                    setModalPost(route[index + 1]);
                    setSelectedId(route[index + 1].id);
                  }}
                >
                  下一站
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
        </Dialog>
      )}
      {deleteTarget && (
        <Dialog label="确认删除回声" onClose={closeDelete}>
          <div className="delete-dialog">
            <Trash2 size={26} />
            <h2>删除这封回声？</h2>
            <p>
              「{titleOf(deleteTarget)}
              」及关联本机媒体将被移除，此操作无法撤销。
            </p>
            <div>
              <button
                className="secondary"
                disabled={mutation}
                onClick={closeDelete}
              >
                再留一会儿
              </button>
              <button
                className="primary danger-button"
                disabled={mutation}
                onClick={() => void remove()}
              >
                {mutation ? "正在删除…" : "确认删除"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
