import { useEffect } from "react";

/** Enter once when visible; never intercept scrolling or animate the map. */
export function usePageMotion(page: string, ready: boolean, section?: string) {
  useEffect(() => {
    if (!ready || !("IntersectionObserver" in window)) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-reveal]:not(.is-revealed)",
      ),
    ];
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08, rootMargin: "0px 0px -16px 0px" },
    );
    elements.forEach((el, i) => {
      el.style.setProperty("--reveal-delay", `${Math.min(i % 4, 3) * 65}ms`);
      el.classList.add("reveal-ready");
      observer.observe(el);
    });
    const finish = () => {
      if (preference.matches)
        elements.forEach((el) => el.classList.add("is-revealed"));
    };
    preference.addEventListener("change", finish);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", finish);
      elements.forEach((el) => el.classList.remove("reveal-ready"));
    };
  }, [page, ready, section]);
}
