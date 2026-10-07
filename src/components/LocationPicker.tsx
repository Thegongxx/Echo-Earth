import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LocateFixed, MapPin, Search } from "lucide-react";
import type { Location } from "../types";
import {
  describePoint,
  placeSearchSource,
  searchPlaces,
} from "../lib/placeSearch";
import LocationMap from "./LocationMap";

export default function LocationPicker({
  value,
  onChange,
  onConfirmed,
}: {
  value?: Location;
  onChange: (l: Location | undefined) => void;
  onConfirmed?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [candidate, setCandidate] = useState<Location | undefined>(value);
  const [results, setResults] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [pointBusy, setPointBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);
  const version = useRef(0);
  const searchVersion = useRef(0);
  const alive = useRef(true);
  const mapSection = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      version.current++;
      searchVersion.current++;
    };
  }, []);
  function preview(l: Location) {
    version.current++;
    setPointBusy(false);
    setCandidate(l);
    onChange(undefined);
    setError("");
    setNotice("");
  }
  function selectResult(l: Location) {
    preview(l);
    setResults([]);
    setSearched(false);
    requestAnimationFrame(() =>
      mapSection.current?.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
  }
  async function pick(l: Location) {
    preview(l);
    const current = version.current;
    setPointBusy(true);
    try {
      const described = await describePoint(l);
      if (alive.current && current === version.current) setCandidate(described);
    } catch {
      if (alive.current && current === version.current)
        setNotice(
          "位置已标记，地址暂时无法识别。填写城市和地点名称即可继续，不需要经纬度。",
        );
    } finally {
      if (alive.current && current === version.current) setPointBusy(false);
    }
  }
  async function search() {
    if (!query.trim()) {
      setError("请输入学校、街道、店铺名称或完整地址。");
      return;
    }
    const current = ++searchVersion.current;
    setBusy(true);
    setError("");
    setSearched(false);
    setResults([]);
    try {
      const found = await searchPlaces(query.trim(), city.trim());
      if (alive.current && current === searchVersion.current) {
        setResults(found);
        setSearched(true);
      }
    } catch (e) {
      if (alive.current && current === searchVersion.current)
        setError(
          e instanceof Error ? e.message : "地点搜索失败，请在地图上选点。",
        );
    } finally {
      if (alive.current && current === searchVersion.current) setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setNotice("浏览器不支持定位，请搜索或在地图上选点。");
      return;
    }
    setNotice("");
    setError("");
    setPointBusy(true);
    const current = ++version.current;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!alive.current || version.current !== current) return;
        void pick({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          city: "",
          placeName: "",
          precision: "device",
          coordinateSystem: "WGS84",
          accuracyMeters: Math.round(p.coords.accuracy),
        });
      },
      (e) => {
        if (!alive.current || version.current !== current) return;
        setPointBusy(false);
        setNotice(
          e.code === 1
            ? "定位未获授权。仍可搜索或点击地图选择地点。"
            : "暂时无法定位。请搜索或点击地图选择地点。",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }
  function edit(field: "city" | "placeName", text: string) {
    if (!candidate) return;
    version.current++;
    setPointBusy(false);
    onChange(undefined);
    setCandidate({ ...candidate, [field]: text });
  }
  function confirm() {
    if (!candidate?.city.trim() || !candidate.placeName.trim()) {
      setError("请补充城市和地点名称，再确认标记。");
      return;
    }
    onChange({
      ...candidate,
      city: candidate.city.trim(),
      placeName: candidate.placeName.trim(),
    });
    onConfirmed?.();
  }
  return (
    <div className="location-picker real-location-picker">
      <div className="location-guide">
        <p>
          搜索名称或地址，在街道地图上确认。坐标会自动保存，也可以直接放大地图点选。
        </p>
      </div>
      <div className="search-fields">
        <label className="city-field">
          {import.meta.env.VITE_TMAP_KEY ? "城市" : "城市（可选）"}
          <input
            value={city}
            maxLength={50}
            onChange={(e) => {
              setCity(e.target.value);
              searchVersion.current++;
              setBusy(false);
              setSearched(false);
              setResults([]);
            }}
            placeholder="输入城市"
          />
        </label>
        <label className="place-field">
          地点名称或地址
          <div className="input-icon">
            <Search size={17} />
            <input
              value={query}
              maxLength={160}
              onChange={(e) => {
                setQuery(e.target.value);
                searchVersion.current++;
                setBusy(false);
                setSearched(false);
                setResults([]);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="输入学校、街道、店铺或完整地址"
            />
          </div>
        </label>
        <button
          className="secondary"
          disabled={busy || !query.trim()}
          onClick={() => void search()}
        >
          {busy ? "搜索中…" : "搜索地点"}
        </button>
      </div>
      <p className="location-source">
        {placeSearchSource}
        {!import.meta.env.VITE_TMAP_KEY &&
          " · 演示选点，非腾讯地图；公开数据可能缺少国内 POI"}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <div className="location-result-list" aria-label="地点搜索结果">
          {results.map((l, i) => (
            <button
              key={`${l.poiId || l.placeName}-${i}`}
              className={`place-result ${candidate?.lat === l.lat && candidate?.lng === l.lng ? "chosen" : ""}`}
              onClick={() => selectResult(l)}
            >
              <MapPin size={18} />
              <span>
                <strong>{l.placeName}</strong>
                <small>{l.address || l.city || "选择后在地图上核对位置"}</small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      )}
      {searched && !results.length && (
        <p className="location-search-empty" role="status">
          没有找到这个地点。试试完整名称或附近道路，也可以放大地图直接点选。
        </p>
      )}
      <div className="location-map-section" ref={mapSection}>
        <LocationMap selected={candidate} onPick={(l) => void pick(l)} />
      </div>
      <div className="location-tools">
        <button className="text-button" disabled={pointBusy} onClick={locate}>
          <LocateFixed size={17} />
          使用我当前位置
        </button>
        <small>仅点击后请求定位授权</small>
      </div>
      {notice && (
        <p className="location-search-empty" role="status">
          {notice}
        </p>
      )}
      {candidate ? (
        <div className="location-selection">
          <div className="location-selection-heading">
            <MapPin size={19} />
            <strong>
              {pointBusy ? "正在识别这个位置…" : "核对地图标记与地点名称"}
            </strong>
            {value && <Check size={17} />}
          </div>
          {candidate.address && (
            <p className="location-address">{candidate.address}</p>
          )}
          <div className="field-grid">
            <label>
              地点名称
              <input
                value={candidate.placeName}
                maxLength={120}
                placeholder="例如：图书馆东门"
                onChange={(e) => edit("placeName", e.target.value)}
              />
            </label>
            <label>
              所在城市
              <input
                value={candidate.city}
                maxLength={50}
                placeholder="输入所在城市"
                onChange={(e) => edit("city", e.target.value)}
              />
            </label>
          </div>
          <p className="location-pin-note">
            {candidate.precision === "poi"
              ? "搜索结果位置，可点击地图微调。"
              : "坐标由地图标记自动记录；附近地址只供参考。"}
            {candidate.accuracyMeters
              ? ` 定位精度约 ${candidate.accuracyMeters} 米。`
              : ""}
          </p>
          <button
            className="primary location-confirm-next"
            disabled={
              pointBusy || !candidate.city.trim() || !candidate.placeName.trim()
            }
            onClick={confirm}
          >
            <Check size={17} />
            确认地点，继续
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <div className="location-search-empty">
          <MapPin size={17} />
          还没有选择地点。先搜索并选择结果，或放大街道地图点击选点。
        </div>
      )}
    </div>
  );
}
