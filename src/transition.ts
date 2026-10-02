import { flushSync } from "react-dom";

interface VT {
  finished: Promise<void>;
  skipTransition: () => void;
}
type VTDocument = Document & { startViewTransition?: (cb: () => void) => VT };

let active: VT | null = null;

/**
 * While a view transition animates, Chrome delivers clicks to <html> instead of the element under the
 * pointer, so a quick second click (e.g. theme then language) would be lost. This finishes the running
 * transition immediately and replays the click on the real target. Install once at startup.
 */
export function installClickThrough() {
  document.addEventListener(
    "click",
    (e) => {
      if (!active || e.target !== document.documentElement) return;
      const { clientX: x, clientY: y } = e;
      const vt = active;
      vt.skipTransition();
      vt.finished.finally(() => requestAnimationFrame(() => (document.elementFromPoint(x, y) as HTMLElement | null)?.click()));
    },
    true,
  );
}

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Runs a UI update inside a View Transition, so the browser animates between the old and new screen
 * (smooth theme / language switches). Browsers without support — or users who prefer reduced motion —
 * simply get the instant update.
 *
 * `htmlClass` is added to <html> while the transition runs, so CSS can pick a special animation.
 */
export function smoothly(update: () => void, htmlClass?: string) {
  const d = document as VTDocument;
  if (!d.startViewTransition || reduced()) {
    update();
    return;
  }
  const root = document.documentElement;
  if (htmlClass) root.classList.add(htmlClass);
  const vt = d.startViewTransition(() => flushSync(update));
  active = vt;
  vt.finished.finally(() => {
    if (active === vt) active = null;
    if (htmlClass) root.classList.remove(htmlClass);
  });
}

/** Sets where the circular theme "reveal" starts (the centre of the clicked element). */
export function setRevealOrigin(el: Element | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const s = document.documentElement.style;
  s.setProperty("--vt-x", `${x}px`);
  s.setProperty("--vt-y", `${y}px`);
  s.setProperty("--vt-r", `${radius}px`);
}
