import type { PublicBar } from "./api";
import { formatRemaining, isExpired } from "./countdown";

export const BAR_ID = "announcement-bar-app";

// renderBar builds the single active bar, prepends it to <body>, applies colors, and (if a
// countdown is set) ticks every second — removing the bar from the DOM when it reaches zero.
export function renderBar(bar: PublicBar, doc: Document = document): void {
  const el = doc.createElement("div");
  el.id = BAR_ID;
  el.style.cssText =
    "position:sticky;top:0;z-index:2147483647;width:100%;box-sizing:border-box;" +
    "padding:11px 18px;text-align:center;font-weight:600;" +
    "display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;" +
    `background:${bar.background_color};color:${bar.text_color};`;

  const msg = doc.createElement("span");
  msg.textContent = bar.message;
  el.appendChild(msg);

  if (bar.countdown_enabled && bar.countdown_end_at) {
    const deadline = new Date(bar.countdown_end_at).getTime();
    const cd = doc.createElement("span");
    cd.style.cssText =
      "padding:4px 11px;border-radius:999px;font-variant-numeric:tabular-nums;font-weight:700;" +
      `background:${bar.countdown_bg_color};color:${bar.countdown_text_color};`;
    el.appendChild(cd);

    const tick = () => {
      const now = Date.now();
      if (isExpired(deadline, now)) {
        clearInterval(timer);
        el.remove();
        return;
      }
      cd.textContent = formatRemaining(deadline - now, bar.countdown_format);
    };
    const timer = setInterval(tick, 1000);
    tick();
  }

  doc.body.prepend(el);
}
