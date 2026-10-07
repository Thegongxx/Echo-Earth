import * as THREE from "three";
type Ring = number[][];
type Polygon = Ring[];
type LandGeoJSON = {
  features: {
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: Polygon | Polygon[];
    };
  }[];
};
let landPromise: Promise<LandGeoJSON> | undefined;
function loadLand() {
  landPromise ??= fetch("/assets/earth-land-50m.geojson")
    .then((r) => {
      if (!r.ok) throw new Error("真实地理数据读取失败");
      return r.json() as Promise<LandGeoJSON>;
    })
    .catch((e) => {
      landPromise = undefined;
      throw e;
    });
  return landPromise;
}
/** Natural Earth 1:50m 陆地数据；纹理与点位使用相同的经纬度投影。 */
export function createEarthTexture(maxTextureSize: number, anisotropy: number) {
  const canvas = document.createElement("canvas");
  const width = Math.min(4096, maxTextureSize);
  const height = width / 2;
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  const ocean = c.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, "#153650");
  ocean.addColorStop(0.28, "#245c80");
  ocean.addColorStop(0.52, "#277694");
  ocean.addColorStop(0.76, "#245c80");
  ocean.addColorStop(1, "#153650");
  c.fillStyle = ocean;
  c.fillRect(0, 0, width, height);
  // Subtle atlas graticule; the geographic coastline remains the real dataset.
  c.strokeStyle = "rgba(166, 219, 231, .065)";
  c.lineWidth = Math.max(0.8, width / 4096);
  c.beginPath();
  for (let lng = -180; lng <= 180; lng += 20) {
    const x = ((lng + 180) / 360) * width;
    c.moveTo(x, 0);
    c.lineTo(x, height);
  }
  for (let lat = -80; lat <= 80; lat += 20) {
    const y = ((90 - lat) / 180) * height;
    c.moveTo(0, y);
    c.lineTo(width, y);
  }
  c.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, anisotropy);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  let cancelled = false;
  const ready = loadLand().then((geo) => {
    if (cancelled) return;
    const path = new Path2D();
    for (const feature of geo.features) {
      const polys =
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates as Polygon]
          : (feature.geometry.coordinates as Polygon[]);
      for (const polygon of polys) {
        for (const ring of polygon) {
          ring.forEach(([lng, lat], i) => {
            const x = ((lng + 180) / 360) * width,
              y = ((90 - lat) / 180) * height;
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          });
          path.closePath();
        }
      }
    }
    c.save();
    c.clip(path, "evenodd");
    const land = c.createLinearGradient(0, 0, 0, height);
    land.addColorStop(0, "#e6eee4");
    land.addColorStop(0.13, "#c3d6bf");
    land.addColorStop(0.29, "#a6c9af");
    land.addColorStop(0.48, "#8cb9a2");
    land.addColorStop(0.68, "#b1caae");
    land.addColorStop(0.82, "#d1ddc5");
    land.addColorStop(1, "#eaf0e6");
    c.fillStyle = land;
    c.fillRect(0, 0, width, height);
    // 柔和的沙漠色块仅作视觉风格处理，海岸线始终由真实矢量数据裁切。
    const areas = [
      { lng: 13, lat: 24, rx: 28, ry: 12 },
      { lng: 48, lat: 25, rx: 15, ry: 10 },
      { lng: 134, lat: -25, rx: 16, ry: 11 },
      { lng: 86, lat: 43, rx: 27, ry: 11 },
    ];
    for (const a of areas) {
      const x = ((a.lng + 180) / 360) * width,
        y = ((90 - a.lat) / 180) * height;
      c.save();
      c.translate(x, y);
      c.scale(a.rx / 180, a.ry / 90);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, width * 0.5);
      g.addColorStop(0, "rgba(221,197,149,.75)");
      g.addColorStop(0.65, "rgba(211,190,151,.38)");
      g.addColorStop(1, "rgba(211,190,151,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, width * 0.5, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.restore();
    c.strokeStyle = "rgba(212,238,214,.48)";
    c.lineWidth = Math.max(0.8, width / 4096);
    c.stroke(path);
    texture.needsUpdate = true;
  });
  return {
    texture,
    ready,
    cancel: () => {
      cancelled = true;
    },
  };
}
