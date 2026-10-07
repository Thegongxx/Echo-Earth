import type { Location } from "../types";
import { asTencent, asWgs } from "./coordinates";
import { loadTMap } from "./tmap";

// Shared Photon is a small local demo only; production requires configuration.
const photonBase =
  import.meta.env.VITE_PHOTON_URL ||
  (import.meta.env.DEV ? "https://photon.komoot.io" : "");
export const placeSearchSource = import.meta.env.VITE_TMAP_KEY
  ? "腾讯地点搜索"
  : photonBase
    ? "Photon / OpenStreetMap"
    : "地点搜索未配置";
const cache = new Map<string, Location[]>();
let nextRequestAt = 0;
async function photon(
  path: string,
  params: Record<string, string>,
): Promise<Location[]> {
  if (!photonBase)
    throw new Error(
      "请配置腾讯地图 Key 或地点搜索服务。当前可以放大街道地图并点击选点。",
    );
  const url = new URL(`${photonBase.replace(/\/$/, "")}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("limit", path === "reverse" ? "1" : "6");
  const cached = cache.get(url.href);
  if (cached) return cached;
  if (Date.now() < nextRequestAt)
    throw new Error("请稍等两秒再查询，公开演示搜索需要控制请求频率。");
  nextRequestAt = Date.now() + 2000;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
    });
    if (!response.ok)
      throw new Error("公开地点搜索暂时不可用，请稍后重试或在地图上点选。");
    const data = await response.json();
    const locations: Location[] = (data.features || []).flatMap(
      (feature: any) => {
        const p = feature.properties || {};
        const [lng, lat] = feature.geometry?.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
        const city =
          p.city ||
          p.town ||
          p.village ||
          p.county ||
          (p.type === "city" || p.osm_value === "city" ? p.name : "");
        return [
          {
            lat,
            lng,
            city,
            placeName:
              p.name ||
              [p.street, p.housenumber].filter(Boolean).join(" ") ||
              "地图上的地点",
            address: [
              ...new Set(
                [
                  p.country,
                  p.state,
                  city,
                  p.district,
                  p.street,
                  p.housenumber,
                ].filter(Boolean),
              ),
            ].join(" · "),
            poiId: p.osm_id ? `osm:${p.osm_type}:${p.osm_id}` : undefined,
            precision: "poi" as const,
            coordinateSystem: "WGS84" as const,
          },
        ];
      },
    );
    if (cache.size >= 100) cache.clear();
    cache.set(url.href, locations);
    return locations;
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error("地点搜索超时。可以重试，或在街道地图上点击位置。");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
export async function searchPlaces(
  query: string,
  city: string,
): Promise<Location[]> {
  if (!import.meta.env.VITE_TMAP_KEY)
    return photon("api", { q: [city, query].filter(Boolean).join(" ") });
  if (!city.trim())
    throw new Error("请填写搜索城市，再查找具体学校、道路或店铺。");
  const T = await loadTMap();
  const r = await new T.service.Search({ pageSize: 6 }).searchRegion({
    keyword: query.trim(),
    cityName: city.trim(),
    autoExtend: false,
  });
  if (r.status !== 0) throw new Error(r.message || "腾讯地点搜索失败。");
  return (r.data || []).map((p: any) => ({
    lat: p.location.lat,
    lng: p.location.lng,
    city: p.ad_info?.city || city,
    placeName: p.title,
    address: p.address,
    poiId: p.id,
    precision: "poi",
    coordinateSystem: "GCJ02",
  }));
}
export async function describePoint(point: Location): Promise<Location> {
  if (!import.meta.env.VITE_TMAP_KEY) {
    const c = asWgs(point);
    const nearby = (
      await photon("reverse", { lat: String(c.lat), lon: String(c.lng) })
    )[0];
    // Reverse lookup describes a nearby object, never replaces the user's pin.
    return nearby
      ? {
          ...point,
          city: nearby.city,
          address: nearby.address,
          placeName: `附近：${nearby.placeName}`,
        }
      : point;
  }
  const T = await loadTMap();
  const c = asTencent(point);
  const r = await new T.service.Geocoder().getAddress({
    location: new T.LatLng(c.lat, c.lng),
  });
  if (r.status !== 0) throw new Error(r.message || "地址识别失败。");
  return {
    ...point,
    city: r.result.address_component?.city || "",
    address: r.result.address,
    placeName:
      r.result.formatted_addresses?.recommend ||
      r.result.address ||
      point.placeName,
  };
}
