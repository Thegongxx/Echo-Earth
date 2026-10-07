import type { Location } from "../types";
export type Coordinate = { lat: number; lng: number };
const outside = (lat: number, lng: number) =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
export function wgsToGcj({ lat, lng }: Coordinate): Coordinate {
  if (outside(lat, lng)) return { lat, lng };
  const x = lng - 105,
    y = lat - 35;
  let a =
    -100 +
    2 * x +
    3 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  let b =
    300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  a +=
    ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  a +=
    ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y * Math.PI) / 3)) * 2) / 3;
  a +=
    ((160 * Math.sin((y * Math.PI) / 12) + 320 * Math.sin((y * Math.PI) / 30)) *
      2) /
    3;
  b +=
    ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  b +=
    ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x * Math.PI) / 3)) * 2) / 3;
  b +=
    ((150 * Math.sin((x * Math.PI) / 12) + 300 * Math.sin((x * Math.PI) / 30)) *
      2) /
    3;
  const rad = (lat * Math.PI) / 180;
  let magic = Math.sin(rad);
  magic = 1 - 0.00669342162296594323 * magic * magic;
  const root = Math.sqrt(magic);
  a =
    (a * 180) /
    (((6378245 * (1 - 0.00669342162296594323)) / (magic * root)) * Math.PI);
  b = (b * 180) / ((6378245 / root) * Math.cos(rad) * Math.PI);
  return { lat: lat + a, lng: lng + b };
}
export function gcjToWgs(p: Coordinate): Coordinate {
  if (outside(p.lat, p.lng)) return { ...p };
  let wgs = { ...p };
  for (let i = 0; i < 8; i++) {
    const gcj = wgsToGcj(wgs);
    wgs = { lat: wgs.lat + p.lat - gcj.lat, lng: wgs.lng + p.lng - gcj.lng };
  }
  return wgs;
}
export function asWgs(l: Location): Coordinate {
  return l.coordinateSystem === "GCJ02"
    ? gcjToWgs(l)
    : { lat: l.lat, lng: l.lng };
}
export function asTencent(l: Location | Coordinate): Coordinate {
  return "coordinateSystem" in l && l.coordinateSystem === "GCJ02"
    ? { lat: l.lat, lng: l.lng }
    : wgsToGcj(l);
}
