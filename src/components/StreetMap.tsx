import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicEcho } from "../types";
import { asWgs, asTencent } from "../lib/coordinates";
import type { Coordinate } from "../lib/coordinates";
import { loadTMap } from "../lib/tmap";
export type StreetMapHandle = {
  zoom: (direction: number) => void;
  setZoom: (zoom: number) => void;
  all: () => void;
};
type Props = {
  posts: PublicEcho[];
  selectedId?: string;
  route?: PublicEcho[];
  center: Coordinate;
  initialZoom: number;
  onSelect: (p: PublicEcho) => void;
  onZoomChange: (z: number) => void;
  onReturn: () => void;
};
export default forwardRef<StreetMapHandle, Props>(function StreetMap(
  {
    posts,
    selectedId,
    route = [],
    center,
    initialZoom,
    onSelect,
    onZoomChange,
    onReturn,
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tmap = useRef<any>(null);
  const markers = useRef<any>(null);
  const lines = useRef<any>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const postsRef = useRef(posts);
  const lastSelected = useRef(selectedId);
  const callbacks = useRef({ onSelect, onZoomChange, onReturn });
  postsRef.current = posts;
  callbacks.current = { onSelect, onZoomChange, onReturn };
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [source, setSource] = useState(
    import.meta.env.VITE_TMAP_KEY ? "腾讯地图" : "OpenStreetMap",
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  useImperativeHandle(
    ref,
    () => ({
      zoom(d) {
        const m = map.current || tmap.current;
        if (!m) return;
        const z = m.getZoom();
        if (d < 0 && z <= 3) {
          callbacks.current.onReturn();
          return;
        }
        if (map.current) map.current.setZoom(Math.max(2, Math.min(19, z + d)));
        else tmap.current.setZoom(Math.max(3, Math.min(19, z + d)));
      },
      setZoom(z) {
        map.current?.setZoom(z);
        tmap.current?.setZoom(z);
      },
      all() {
        const coordinates = postsRef.current.map((p) => asWgs(p.location));
        if (!coordinates.length) return;
        if (map.current)
          map.current.fitBounds(
            coordinates.map((p) => [p.lat, p.lng]),
            { padding: [45, 45], maxZoom: 14, animate: !reduced },
          );
        else if (tmap.current) {
          const T = window.TMap;
          const b = new T.LatLngBounds();
          postsRef.current.forEach((p) => {
            const l = asTencent(p.location);
            b.extend(new T.LatLng(l.lat, l.lng));
          });
          tmap.current.fitBounds(b, { padding: 45 });
        }
      },
    }),
    [reduced],
  );
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const target = host.current;
    async function initialize() {
      try {
        if (import.meta.env.VITE_TMAP_KEY) {
          const T = await loadTMap();
          if (disposed) return;
          const c = asTencent(center);
          tmap.current = new T.Map(target, {
            center: new T.LatLng(c.lat, c.lng),
            zoom: initialZoom,
            minZoom: 3,
            maxZoom: 19,
            pitch: 0,
            rotation: 0,
          });
          markers.current = new T.MultiMarker({
            map: tmap.current,
            styles: {
              echo: new T.MarkerStyle({
                width: 25,
                height: 35,
                anchor: { x: 12, y: 35 },
              }),
            },
            geometries: [],
          });
          lines.current = new T.MultiPolyline({
            map: tmap.current,
            styles: {
              route: new T.PolylineStyle({ color: "#aa875b", width: 3 }),
            },
            geometries: [],
          });
          markers.current.on("click", (event: any) => {
            const post = postsRef.current.find(
              (p) => p.id === event.geometry.id,
            );
            if (post) callbacks.current.onSelect(post);
          });
          tmap.current.on("zoom_changed", () =>
            callbacks.current.onZoomChange(Math.round(tmap.current.getZoom())),
          );
          setLoading(false);
        } else {
          const m = L.map(target, {
            center: [center.lat, center.lng],
            zoom: initialZoom,
            minZoom: 2,
            maxZoom: 19,
            zoomControl: false,
            attributionControl: true,
            worldCopyJump: true,
            scrollWheelZoom: true,
            zoomAnimation: !reduced,
            fadeAnimation: !reduced,
            markerZoomAnimation: !reduced,
          });
          map.current = m;
          group.current = L.layerGroup().addTo(m);
          L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);
          const layer = L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
              maxZoom: 19,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
              keepBuffer: 1,
              updateWhenIdle: true,
            },
          ).addTo(m);
          let goodTiles = 0;
          layer.on("tileload", () => {
            goodTiles++;
            if (!disposed) {
              setLoading(false);
              setError("");
            }
          });
          layer.on("tileerror", () => {
            if (!disposed && goodTiles === 0) {
              setLoading(false);
              setError(
                "公开地图底图暂时无法加载。回声点位仍可点击，或返回地球视图。",
              );
            }
          });
          m.on("zoomend", () => {
            callbacks.current.onZoomChange(m.getZoom());
            if (m.getZoom() <= 2) callbacks.current.onReturn();
          });
          observer = new ResizeObserver(() =>
            m.invalidateSize({ animate: false }),
          );
          observer.observe(target);
        }
        if (!disposed) {
          setReady(true);
          callbacks.current.onZoomChange(initialZoom);
        }
      } catch (e) {
        if (!disposed) {
          setSource(
            import.meta.env.VITE_TMAP_KEY ? "腾讯地图未连接" : "公开地图未连接",
          );
          setError(e instanceof Error ? e.message : "地图初始化失败。");
          setLoading(false);
        }
      }
    }
    void initialize();
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      markers.current?.setMap(null);
      lines.current?.setMap(null);
      tmap.current?.destroy();
      tmap.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (map.current && group.current) {
      group.current.clearLayers();
      posts.forEach((p) => {
        const c = asWgs(p.location);
        const selected = p.id === selectedId;
        const tooltip = document.createElement("span");
        tooltip.textContent = `${p.location.city} · ${p.location.placeName}`;
        const marker = L.circleMarker([c.lat, c.lng], {
          radius: selected ? 11 : 8,
          color: selected ? "#9a6d39" : "#3d7779",
          fillColor: selected ? "#f0cf95" : "#93c9c3",
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(group.current!)
          .bindTooltip(tooltip, {
            direction: "top",
            offset: [0, -8],
          })
          .on("click", () => callbacks.current.onSelect(p));
        const element = marker.getElement();
        if (element) {
          element.setAttribute("role", "button");
          element.setAttribute("tabindex", "0");
          element.setAttribute(
            "aria-label",
            `打开${p.location.city}的回声：${p.title || p.location.placeName}`,
          );
          element.addEventListener("keydown", (e) => {
            const key = (e as KeyboardEvent).key;
            if (key === "Enter" || key === " ") {
              e.preventDefault();
              callbacks.current.onSelect(p);
            }
          });
        }
      });
      if (route.length > 1)
        L.polyline(
          route.map((p) => {
            const c = asWgs(p.location);
            return [c.lat, c.lng] as L.LatLngTuple;
          }),
          {
            color: "#ad8c5b",
            weight: 3,
            opacity: 0.8,
            dashArray: "6 7",
            interactive: false,
          },
        ).addTo(group.current);
    } else if (tmap.current) {
      const T = window.TMap;
      markers.current.setGeometries(
        posts.map((p) => {
          const c = asTencent(p.location);
          return {
            id: p.id,
            styleId: "echo",
            position: new T.LatLng(c.lat, c.lng),
          };
        }),
      );
      lines.current.setGeometries(
        route.length > 1
          ? [
              {
                id: "route",
                styleId: "route",
                paths: route.map((p) => {
                  const c = asTencent(p.location);
                  return new T.LatLng(c.lat, c.lng);
                }),
              },
            ]
          : [],
      );
    }
  }, [posts, selectedId, route, ready]);
  useEffect(() => {
    if (!ready || lastSelected.current === selectedId) return;
    lastSelected.current = selectedId;
    const selected = posts.find((p) => p.id === selectedId);
    if (!selected) return;
    if (map.current) {
      const c = asWgs(selected.location);
      if (!map.current.getBounds().contains([c.lat, c.lng]))
        map.current.panTo([c.lat, c.lng], { animate: !reduced });
    } else if (tmap.current) {
      const c = asTencent(selected.location);
      tmap.current.setCenter(new window.TMap.LatLng(c.lat, c.lng));
    }
  }, [selectedId, ready]);
  return (
    <div className="street-map">
      <div
        className="street-map-host"
        ref={host}
        aria-label="真实街道地图，可拖动、双指缩放及点击回声点位"
      />
      <div className="map-source-badge">
        <span />
        {source}
        {!import.meta.env.VITE_TMAP_KEY && <small>公开底图 · 非腾讯地图</small>}
      </div>
      {loading && (
        <div className="map-loading" role="status">
          正在加载真实街道地图…
        </div>
      )}
      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}
      {route.length > 1 && (
        <span className="map-route-caption">回声连线 · 非道路导航路线</span>
      )}
    </div>
  );
});
