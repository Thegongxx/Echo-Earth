import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Location } from "../types";
import { asTencent, asWgs } from "../lib/coordinates";
import { loadTMap } from "../lib/tmap";

export default function LocationMap({
  selected,
  onPick,
}: {
  selected?: Location;
  onPick: (l: Location) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const leaflet = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const tmap = useRef<any>(null);
  const tpin = useRef<any>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const initial = useRef(selected);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasKey = Boolean(import.meta.env.VITE_TMAP_KEY);
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const target = host.current;
    async function init() {
      try {
        const start = initial.current;
        if (hasKey) {
          const T = await loadTMap();
          if (disposed) return;
          const c = start ? asTencent(start) : { lat: 35, lng: 105 };
          tmap.current = new T.Map(target, {
            center: new T.LatLng(c.lat, c.lng),
            zoom: start ? 16 : 4,
            pitch: 0,
            minZoom: 3,
            maxZoom: 19,
          });
          tpin.current = new T.MultiMarker({
            map: tmap.current,
            styles: {
              pin: new T.MarkerStyle({
                width: 25,
                height: 35,
                anchor: { x: 12, y: 35 },
              }),
            },
            geometries: [],
          });
          tmap.current.on("click", (e: any) =>
            pickRef.current({
              lat: e.latLng.lat,
              lng: e.latLng.lng,
              city: "",
              placeName: "",
              precision: "manual",
              coordinateSystem: "GCJ02",
            }),
          );
          setLoading(false);
        } else {
          const c = start ? asWgs(start) : { lat: 35, lng: 105 };
          const m = L.map(target, {
            center: [c.lat, c.lng],
            zoom: start ? 16 : 3,
            minZoom: 2,
            maxZoom: 19,
            worldCopyJump: true,
          });
          leaflet.current = m;
          L.control.scale({ imperial: false }).addTo(m);
          const tiles = L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
              maxZoom: 19,
              keepBuffer: 1,
              updateWhenIdle: true,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
            },
          ).addTo(m);
          tiles.on("load", () => {
            if (!disposed) setLoading(false);
          });
          tiles.on("tileerror", () => {
            if (!disposed) {
              setLoading(false);
              setError("街道底图加载失败，请检查网络后重新打开选点页。");
            }
          });
          m.on("click", (e: L.LeafletMouseEvent) =>
            pickRef.current({
              lat: e.latlng.lat,
              lng: ((((e.latlng.lng + 180) % 360) + 360) % 360) - 180,
              city: "",
              placeName: "",
              precision: "manual",
              coordinateSystem: "WGS84",
            }),
          );
          observer = new ResizeObserver(() =>
            m.invalidateSize({ animate: false }),
          );
          observer.observe(target);
        }
        if (!disposed) setReady(true);
      } catch (e) {
        if (!disposed) {
          setLoading(false);
          setError(e instanceof Error ? e.message : "地图加载失败。");
        }
      }
    }
    void init();
    return () => {
      disposed = true;
      observer?.disconnect();
      leaflet.current?.remove();
      leaflet.current = null;
      pin.current = null;
      tpin.current?.setMap(null);
      tmap.current?.destroy();
      tmap.current = null;
    };
  }, [hasKey]);
  useEffect(() => {
    if (!ready || !selected) return;
    if (leaflet.current) {
      const c = asWgs(selected),
        m = leaflet.current;
      if (!pin.current)
        pin.current = L.marker([c.lat, c.lng], {
          icon: L.divIcon({
            className: "location-map-pin",
            html: "<span></span>",
            iconSize: [30, 40],
            iconAnchor: [15, 40],
          }),
        }).addTo(m);
      else pin.current.setLatLng([c.lat, c.lng]);
      if (
        selected.precision !== "manual" ||
        !m.getBounds().contains([c.lat, c.lng])
      )
        m.setView([c.lat, c.lng], 16, {
          animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        });
    } else if (tmap.current) {
      const c = asTencent(selected),
        p = new window.TMap.LatLng(c.lat, c.lng);
      tpin.current.setGeometries([
        { id: "selected", styleId: "pin", position: p },
      ]);
      if (selected.precision !== "manual") {
        tmap.current.setCenter(p);
        tmap.current.setZoom(16);
      }
    }
  }, [selected, ready]);
  return (
    <div className="location-street-map">
      <div
        className="location-map-host"
        ref={host}
        aria-label="真实街道地图，放大后点击记忆发生的位置"
      />
      <div className="location-map-caption">
        {hasKey ? "腾讯地图" : "OpenStreetMap 公开底图"} ·{" "}
        {selected ? "可点击地图调整标记" : "尚未选择地点"}
      </div>
      {loading && (
        <div className="location-map-message" role="status">
          正在加载街道地图…
        </div>
      )}
      {error && (
        <div className="location-map-message map-failure" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
