import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Globe2,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import type { PublicEcho } from "../types";
import type { Coordinate } from "../lib/coordinates";
import { asWgs } from "../lib/coordinates";
import { Globe } from "./Globe";
import type { GlobeHandle } from "./Globe";
import type { StreetMapHandle } from "./StreetMap";
const StreetMap = lazy(() => import("./StreetMap"));
export type ExplorerHandle = { reset: () => void };
type Props = {
  posts: PublicEcho[];
  selectedId?: string;
  route?: PublicEcho[];
  onSelect: (p: PublicEcho, expanded: boolean) => void;
  rotating: boolean;
  onRotationChange: (v: boolean) => void;
  flightId?: string;
};
export default forwardRef<ExplorerHandle, Props>(function EarthExplorer(
  { posts, selectedId, route, onSelect, rotating, onRotationChange, flightId },
  ref,
) {
  const [view, setView] = useState<"globe" | "map">("globe");
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<Coordinate>({ lat: 30, lng: 120 });
  const [initialZoom, setInitialZoom] = useState(12);
  const globe = useRef<GlobeHandle>(null);
  const map = useRef<StreetMapHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const back = useCallback(() => {
    globe.current?.reset();
    setView("globe");
    setZoom(1);
  }, []);
  useImperativeHandle(ref, () => ({ reset: back }), [back]);
  useEffect(() => {
    if (!expanded) return;
    const old = document.body.style.overflow;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    function escape(e: KeyboardEvent) {
      if (document.querySelector('.modal-backdrop [role="dialog"]')) return;
      if (e.key === "Escape") setExpanded(false);
      if (e.key === "Tab") {
        const nodes = root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === root.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", escape);
      previous?.focus();
    };
  }, [expanded]);
  useEffect(() => {
    if (flightId) back();
  }, [flightId, back]);
  const enterMap = useCallback((c: Coordinate, z = 5) => {
    setCenter(c);
    setInitialZoom(z);
    setZoom(z);
    setView("map");
  }, []);
  function cityMap() {
    const p = posts.find((p) => p.id === selectedId) || posts[0];
    enterMap(p ? asWgs(p.location) : globe.current?.getCenter() || center, 14);
  }
  function adjust(n: number) {
    if (view === "globe") globe.current?.zoom(n);
    else map.current?.zoom(n);
  }
  function setLevel(z: number) {
    if (z <= 2) {
      back();
      return;
    }
    if (view === "globe") {
      const p = posts.find((p) => p.id === selectedId);
      enterMap(
        z >= 9 && p ? asWgs(p.location) : globe.current?.getCenter() || center,
        z,
      );
    } else map.current?.setZoom(z);
  }
  const scope =
    view === "globe"
      ? "全球视图"
      : zoom >= 16
        ? "街道视图"
        : zoom >= 11
          ? "城市视图"
          : zoom >= 7
            ? "区域视图"
            : "大陆视图";
  return (
    <div
      ref={root}
      role={expanded ? "dialog" : "group"}
      aria-modal={expanded ? true : undefined}
      aria-label="地球与街区探索"
      tabIndex={-1}
      className={`earth-explorer ${view === "map" ? "explorer-map" : ""} ${expanded ? "explorer-expanded" : ""}`}
    >
      <div className="explorer-viewport">
        {view === "globe" ? (
          <Globe
            ref={globe}
            posts={posts}
            selectedId={selectedId}
            route={route}
            onSelect={(p) => onSelect(p, expanded)}
            rotating={rotating}
            flightId={flightId}
            onMapRequest={(c) => enterMap(c, 5)}
          />
        ) : (
          <Suspense
            fallback={<div className="map-loading">正在准备街道视图…</div>}
          >
            <StreetMap
              ref={map}
              posts={posts}
              selectedId={selectedId}
              route={route}
              center={center}
              initialZoom={initialZoom}
              onSelect={(p) => onSelect(p, expanded)}
              onZoomChange={setZoom}
              onReturn={back}
            />
          </Suspense>
        )}
      </div>
      {expanded && (
        <div className="expanded-heading">
          <span>
            <Globe2 size={20} />
            回声地球<small>从世界，走进一个具体的地方</small>
          </span>
          <button
            className="explorer-round"
            aria-label="关闭全屏探索"
            onClick={() => setExpanded(false)}
          >
            <X size={19} />
          </button>
        </div>
      )}
      <div
        className="explorer-view-switch"
        role="group"
        aria-label="地球和地图视图"
      >
        <button className={view === "globe" ? "active" : ""} onClick={back}>
          <Globe2 size={13} />
          地球
        </button>
        <button className={view === "map" ? "active" : ""} onClick={cityMap}>
          <Layers size={13} />
          街区
        </button>
      </div>
      <button
        className="explorer-expand explorer-round"
        aria-label={expanded ? "退出全屏探索" : "全屏探索地球"}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      <div className="explorer-zoom">
        <button
          className="explorer-round"
          aria-label="放大地图与地球"
          onClick={() => adjust(1)}
          disabled={view === "map" && zoom >= 19}
        >
          <Plus size={18} />
        </button>
        <div className="zoom-track">
          <input
            aria-label="从全球到街道缩放"
            type="range"
            min="1"
            max="19"
            value={zoom}
            onChange={(e) => setLevel(Number(e.target.value))}
          />
        </div>
        <button
          className="explorer-round"
          aria-label="缩小地图与地球"
          onClick={() => adjust(-1)}
        >
          <Minus size={18} />
        </button>
      </div>
      <div className="explorer-bottom">
        <span>
          <i />
          {scope}
          <small>
            {view === "globe"
              ? "继续放大，走进真实街区"
              : `${zoom} 级 · 拖动或双指缩放`}
          </small>
        </span>
        <div>
          {view === "globe" ? (
            <button
              className="explorer-round"
              onClick={() => onRotationChange(!rotating)}
              aria-label={rotating ? "暂停地球自转" : "开启地球自转"}
              aria-pressed={!rotating}
            >
              {rotating ? <Pause size={15} /> : <RotateCcw size={15} />}
            </button>
          ) : (
            <button
              className="explorer-round"
              onClick={() => map.current?.all()}
              aria-label="在地图显示全部回声"
            >
              <Maximize2 size={15} />
            </button>
          )}
          <button
            className="explorer-round"
            aria-label="返回全球视角"
            onClick={back}
          >
            <Globe2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});
