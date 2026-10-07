declare global {
  interface Window {
    TMap?: any;
  }
}
let mapPromise: Promise<any> | undefined;
export function loadTMap() {
  if (window.TMap) return Promise.resolve(window.TMap);
  if (mapPromise) return mapPromise;
  mapPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://map.qq.com/api/gljs?v=1.exp&libraries=service&key=${encodeURIComponent(import.meta.env.VITE_TMAP_KEY)}`;
    const timer = setTimeout(() => {
      mapPromise = undefined;
      script.remove();
      reject(new Error("腾讯地图加载超时，请检查 Key 和域名配置。"));
    }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.TMap) resolve(window.TMap);
      else {
        mapPromise = undefined;
        reject(new Error("腾讯地图初始化失败，请检查 Key 和域名白名单。"));
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      mapPromise = undefined;
      script.remove();
      reject(new Error("腾讯地图加载失败。"));
    };
    document.head.appendChild(script);
  });
  return mapPromise;
}
