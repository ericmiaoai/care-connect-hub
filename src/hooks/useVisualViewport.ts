import { useEffect } from "react";

/**
 * useVisualViewport
 * =================
 * Sets a CSS custom property `--vvh` on the <html> element equal to the
 * visual viewport height in pixels. The visual viewport shrinks as the
 * mobile soft keyboard opens — using `var(--vvh)` instead of `100vh` or
 * `100dvh` ensures sheets and modals always fit the actually-visible area,
 * regardless of how a browser interprets dvh with the keyboard open.
 *
 * Falls back to window.innerHeight for browsers without VisualViewport API.
 *
 * Call once in the root component.
 */
export function useVisualViewport() {
  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--vvh", `${h}px`);
    };

    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}
