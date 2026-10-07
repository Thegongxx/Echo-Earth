import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PublicEcho } from "../types";
import { createEarthTexture } from "../lib/earthTexture";
import { atmosphereMaterial, earthMaterial } from "../lib/earthMaterial";
import { asWgs } from "../lib/coordinates";
import type { Coordinate } from "../lib/coordinates";
export type GlobeHandle = {
  zoom: (direction: number) => void;
  reset: () => void;
  getCenter: () => Coordinate;
};
type Props = {
  posts: PublicEcho[];
  selectedId?: string;
  route?: PublicEcho[];
  onSelect: (post: PublicEcho) => void;
  rotating: boolean;
  flightId?: string;
  onMapRequest?: (center: Coordinate) => void;
};
const point = (lat: number, lng: number, r = 2) =>
  new THREE.Vector3(
    Math.cos((lat * Math.PI) / 180) * Math.sin((lng * Math.PI) / 180) * r,
    Math.sin((lat * Math.PI) / 180) * r,
    Math.cos((lat * Math.PI) / 180) * Math.cos((lng * Math.PI) / 180) * r,
  );
function sphereGeometry() {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const w = 192,
    h = 96;
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const v = point(90 - (j / h) * 180, -180 + (i / w) * 360);
      positions.push(v.x, v.y, v.z);
      uv.push(i / w, 1 - j / h);
    }
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const a = j * (w + 1) + i,
        b = a + w + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,.7)");
  g.addColorStop(0.45, "rgba(255,255,255,.1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export const Globe = forwardRef<GlobeHandle, Props>(function Globe(
  { posts, selectedId, route = [], onSelect, rotating, flightId, onMapRequest },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    markers: THREE.Group;
    accents: THREE.Group;
    routes: THREE.Group;
    texture: THREE.Texture;
    overviewDistance: number;
    overviewFov: number;
    focus?: THREE.Vector3;
    zoomTarget?: number;
    startFlight?: number;
    flightId?: string;
  }>(undefined);
  const postsRef = useRef(posts);
  const selectRef = useRef(onSelect);
  const mapRequestRef = useRef(onMapRequest);
  const mapRequested = useRef(false);
  mapRequestRef.current = onMapRequest;
  const rotationRef = useRef(rotating);
  const label = useRef<HTMLDivElement>(null);
  const labelTarget = useRef<THREE.Vector3 | null>(null);
  const hoverId = useRef<string | undefined>(undefined);
  const [hovered, setHovered] = useState<string>();
  const [error, setError] = useState("");
  const [landLoading, setLandLoading] = useState(true);
  const [landIssue, setLandIssue] = useState("");
  postsRef.current = posts;
  selectRef.current = onSelect;
  rotationRef.current = rotating;
  const labelPost = posts.find((p) => p.id === (hovered || selectedId));
  useEffect(() => {
    const c = labelPost ? asWgs(labelPost.location) : null;
    labelTarget.current = c ? point(c.lat, c.lng, 2.065) : null;
  }, [labelPost]);
  useImperativeHandle(
    ref,
    () => ({
      zoom(direction) {
        const s = sceneRef.current;
        if (s) {
          s.focus = undefined;
          s.zoomTarget = THREE.MathUtils.clamp(
            (s.zoomTarget || s.camera.position.length()) *
              (direction > 0 ? 0.84 : 1.19),
            3.55,
            11,
          );
        }
      },
      getCenter() {
        const v = sceneRef.current?.camera.position.clone().normalize();
        return v
          ? {
              lat: (Math.asin(v.y) * 180) / Math.PI,
              lng: (Math.atan2(v.x, v.z) * 180) / Math.PI,
            }
          : { lat: 20, lng: 105 };
      },
      reset() {
        const s = sceneRef.current;
        if (s) {
          s.zoomTarget = undefined;
          s.focus = point(20, 105, s.overviewDistance);
        }
      },
    }),
    [],
  );
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let disposed = false;
    mapRequested.current = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setError(
        "当前浏览器无法显示 3D 地球。你仍可通过下方回声卡片探索与发布。",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
    camera.position.copy(point(24, 112, 6.8));
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 3.55;
    controls.maxDistance = 11;
    controls.autoRotateSpeed = 0.22;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const { texture, ready, cancel } = createEarthTexture(
      renderer.capabilities.maxTextureSize,
      renderer.capabilities.getMaxAnisotropy(),
    );
    ready
      .then(() => {
        if (!disposed) setLandLoading(false);
      })
      .catch(() => {
        if (disposed) return;
        setLandLoading(false);
        setLandIssue("地理数据加载失败，请刷新重试。");
      });
    const globe = new THREE.Mesh(sphereGeometry(), earthMaterial(texture));
    scene.add(globe);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.085, 96, 48),
      atmosphereMaterial(),
    );
    scene.add(atmosphere);
    // Static star field: the frame loop never creates new particles.
    const stars = new THREE.BufferGeometry();
    const starPositions: number[] = [],
      starColors: number[] = [];
    const starPalette = [
      new THREE.Color("#86b8ce"),
      new THREE.Color("#b5a8df"),
      new THREE.Color("#d9cca6"),
    ];
    for (let i = 0; i < 700; i++) {
      const y = 1 - ((i + 0.5) / 700) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      starPositions.push(
        Math.cos(angle) * radius * 24,
        y * 24,
        Math.sin(angle) * radius * 24,
      );
      const color = starPalette[i % starPalette.length];
      starColors.push(color.r, color.g, color.b);
    }
    stars.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );
    stars.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(starColors, 3),
    );
    scene.add(
      new THREE.Points(
        stars,
        new THREE.PointsMaterial({
          size: 1.3,
          sizeAttenuation: false,
          vertexColors: true,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        }),
      ),
    );
    const markers = new THREE.Group(),
      accents = new THREE.Group(),
      routes = new THREE.Group();
    scene.add(markers, accents, routes);
    const stamp = glowTexture();
    const s = {
      scene,
      camera,
      controls,
      markers,
      accents,
      routes,
      texture: stamp,
      overviewDistance: 6.8,
      overviewFov: 40,
      focus: undefined as THREE.Vector3 | undefined,
      zoomTarget: undefined as number | undefined,
      startFlight: undefined as number | undefined,
      flightId: undefined as string | undefined,
    };
    sceneRef.current = s;
    const projected = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const focusDirection = new THREE.Vector3();
    const focusRotation = new THREE.Quaternion();
    const focusStep = new THREE.Quaternion();
    function pick(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      cameraDirection.copy(camera.position).normalize();
      let nearest: THREE.Object3D | undefined;
      let distance = e.pointerType === "touch" ? 26 : 18;
      for (const marker of markers.children) {
        normal.copy(marker.position).normalize();
        if (normal.dot(cameraDirection) <= 2.02 / camera.position.length())
          continue;
        projected.copy(marker.position).project(camera);
        const x = rect.left + ((projected.x + 1) * rect.width) / 2;
        const y = rect.top + ((1 - projected.y) * rect.height) / 2;
        const d = Math.hypot(e.clientX - x, e.clientY - y);
        if (d < distance) {
          nearest = marker;
          distance = d;
        }
      }
      return nearest;
    }
    let downX = 0,
      downY = 0;
    const down = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      s.focus = undefined;
      s.zoomTarget = undefined;
    };
    const click = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const hit = pick(e);
      const p = postsRef.current.find((p) => p.id === hit?.userData.id);
      if (p) selectRef.current(p);
    };
    const hover = (e: PointerEvent) => {
      const hit = e.buttons ? undefined : pick(e);
      renderer.domElement.style.cursor = e.buttons
        ? "grabbing"
        : hit
          ? "pointer"
          : "grab";
      const id = hit?.userData.id as string | undefined;
      if (hoverId.current !== id) {
        hoverId.current = id;
        setHovered(id);
      }
    };
    const leave = () => {
      hoverId.current = undefined;
      setHovered(undefined);
    };
    const wheel = () => {
      s.focus = undefined;
      s.zoomTarget = undefined;
      leave();
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", click);
    renderer.domElement.addEventListener("pointermove", hover);
    renderer.domElement.addEventListener("pointerleave", leave);
    renderer.domElement.addEventListener("wheel", wheel, { passive: true });
    const resizeCamera = () => {
      const w = Math.max(1, container.clientWidth),
        h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // Fit the sphere to the shorter viewport dimension, including portrait phones.
      camera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(s.overviewFov / 2)) /
              Math.min(camera.aspect, 1),
          ),
      );
      camera.updateProjectionMatrix();
    };
    const resize = new ResizeObserver(resizeCamera);
    resize.observe(container);
    resizeCamera();
    const visible = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    });
    let inView = true;
    visible.observe(container);
    let frame = 0;
    let previous = 0;
    const frameInterval = 1000 / (navigator.hardwareConcurrency <= 4 ? 30 : 60);
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden || !inView || time - previous < frameInterval - 1)
        return;
      const delta = Math.min((time - previous) / 1000, 0.06);
      previous = time;
      controls.autoRotate =
        rotationRef.current && !reduced.matches && !s.focus && !hoverId.current;
      if (s.focus) {
        if (reduced.matches) camera.position.copy(s.focus);
        else {
          const distance = THREE.MathUtils.lerp(
            camera.position.length(),
            s.focus.length(),
            1 - Math.exp(-5 * delta),
          );
          // Interpolate direction and distance separately so cross-world focus cannot dive through the Earth.
          focusDirection.copy(camera.position).normalize();
          focusRotation.setFromUnitVectors(
            focusDirection,
            normal.copy(s.focus).normalize(),
          );
          focusStep.identity().slerp(focusRotation, 1 - Math.exp(-5 * delta));
          camera.position.copy(
            focusDirection.applyQuaternion(focusStep).multiplyScalar(distance),
          );
        }
        if (camera.position.distanceTo(s.focus) < 0.02) s.focus = undefined;
      }
      if (s.zoomTarget) {
        const d = reduced.matches
          ? s.zoomTarget
          : THREE.MathUtils.lerp(
              camera.position.length(),
              s.zoomTarget,
              1 - Math.exp(-12 * delta),
            );
        camera.position.setLength(d);
        if (Math.abs(d - s.zoomTarget) < 0.005) s.zoomTarget = undefined;
      }
      controls.update(delta);
      if (
        camera.position.length() <= 3.7 &&
        !mapRequested.current &&
        mapRequestRef.current
      ) {
        mapRequested.current = true;
        const v = camera.position.clone().normalize();
        mapRequestRef.current({
          lat: (Math.asin(v.y) * 180) / Math.PI,
          lng: (Math.atan2(v.x, v.z) * 180) / Math.PI,
        });
      }
      if (label.current) {
        const target = labelTarget.current;
        const front =
          target &&
          normal
            .copy(target)
            .normalize()
            .dot(cameraDirection.copy(camera.position).normalize()) >
            2.02 / camera.position.length();
        if (target && front) {
          projected.copy(target).project(camera);
          const x = ((projected.x + 1) * container.clientWidth) / 2;
          const y = ((1 - projected.y) * container.clientHeight) / 2 - 18;
          label.current.style.left = `${x}px`;
          label.current.style.top = `${y}px`;
          label.current.style.opacity =
            x > 45 &&
            x < container.clientWidth - 45 &&
            y > 92 &&
            y < container.clientHeight - 60
              ? "1"
              : "0";
        } else label.current.style.opacity = "0";
      }
      for (const obj of markers.children) {
        const sprite = obj as THREE.Sprite;
        const selected = sprite.userData.selected;
        const pulse = reduced.matches
          ? 1
          : 1 + Math.sin(time * 0.0018 + sprite.userData.phase) * 0.12;
        const size = (selected ? 0.26 : 0.19) * pulse;
        sprite.scale.setScalar(size);
        if (sprite.userData.id === s.flightId && s.startFlight) {
          const progress = reduced.matches
            ? 1
            : Math.min((time - s.startFlight) / 1500, 1);
          const end = sprite.userData.destination as THREE.Vector3;
          sprite.position
            .copy(end)
            .multiplyScalar(1 + (1 - progress) ** 2 * 1.7);
          if (progress === 1) s.startFlight = undefined;
        }
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancel();
      resize.disconnect();
      visible.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", click);
      renderer.domElement.removeEventListener("pointermove", hover);
      renderer.domElement.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("wheel", wheel);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Points ||
          o instanceof THREE.Sprite
        ) {
          if (!(o instanceof THREE.Sprite)) geometries.add(o.geometry);
          const m = Array.isArray(o.material) ? o.material : [o.material];
          m.forEach((m) => materials.add(m));
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      texture.dispose();
      stamp.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = undefined;
    };
  }, []);
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    for (const child of [...s.markers.children]) {
      s.markers.remove(child);
      (child as THREE.Sprite).material.dispose();
    }
    for (const child of [...s.accents.children]) {
      s.accents.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    posts.forEach((p, i) => {
      const selected = p.id === selectedId;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: s.texture,
          color: selected ? "#ffd7a0" : "#b7ffff",
          transparent: true,
          depthTest: true,
          depthWrite: false,
        }),
      );
      sprite.position.copy(
        point(asWgs(p.location).lat, asWgs(p.location).lng, 2.035),
      );
      sprite.scale.setScalar(selected ? 0.26 : 0.19);
      sprite.userData = {
        id: p.id,
        selected,
        phase: i,
        destination: sprite.position.clone(),
      };
      s.markers.add(sprite);
      const pin = new THREE.Mesh(
        new THREE.CircleGeometry(selected ? 0.029 : 0.021, 20),
        new THREE.MeshBasicMaterial({
          color: selected ? "#fff2c9" : "#d4f7fa",
          side: THREE.DoubleSide,
        }),
      );
      pin.position.copy(sprite.position).setLength(2.039);
      pin.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        pin.position.clone().normalize(),
      );
      s.accents.add(pin);
      if (selected) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.058, 0.066, 48),
          new THREE.MeshBasicMaterial({
            color: "#ffd9a0",
            transparent: true,
            opacity: 0.82,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.position.copy(pin.position);
        ring.quaternion.copy(pin.quaternion);
        s.accents.add(ring);
      }
    });
    const target = posts.find((p) => p.id === selectedId);
    if (target) {
      s.zoomTarget = undefined;
      s.focus = point(
        asWgs(target.location).lat,
        asWgs(target.location).lng,
        s.overviewDistance,
      );
    }
    if (flightId && flightId !== s.flightId) {
      s.flightId = flightId;
      s.startFlight = performance.now();
    }
  }, [posts, selectedId, flightId]);
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    for (const child of [...s.routes.children]) {
      s.routes.remove(child);
      const line = child as THREE.Line;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    for (let i = 0; i < route.length - 1; i++) {
      const a = point(
          asWgs(route[i].location).lat,
          asWgs(route[i].location).lng,
          1,
        ),
        b = point(
          asWgs(route[i + 1].location).lat,
          asWgs(route[i + 1].location).lng,
          1,
        );
      const axis = new THREE.Vector3().crossVectors(a, b).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
      const points = Array.from({ length: 81 }, (_, j) =>
        a
          .clone()
          .applyAxisAngle(axis, (angle * j) / 80)
          .multiplyScalar(2.04 + Math.sin((j / 80) * Math.PI) * 0.25),
      );
      s.routes.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({
            color: "#e8cda3",
            transparent: true,
            opacity: 0.7,
          }),
        ),
      );
    }
  }, [route]);
  return (
    <div
      className="globe-canvas"
      ref={host}
      role="img"
      aria-label="可拖动和缩放的真实地理轮廓地球，点击发光回声点打开记忆"
    >
      <div ref={label} className="globe-place-label" aria-hidden="true">
        <span>{labelPost?.location.city}</span>
        <small>{hovered ? "点击打开这段记忆" : "一段记忆，正在回响"}</small>
      </div>
      {(landLoading || landIssue) && !error && (
        <div className="globe-status" role="status">
          {landIssue || "正在加载真实地理轮廓…"}
        </div>
      )}
      {error && (
        <div className="globe-fallback">
          <span>◉</span>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
});
