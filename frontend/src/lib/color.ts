// Conversions between hex strings (#RRGGBB / #RRGGBBAA) and Polaris ColorPicker's HSBA model.
export interface HSBA {
  hue: number;
  saturation: number;
  brightness: number;
  alpha: number;
}

export function hexToHsba(hex: string): HSBA {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const alpha = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max === 0 ? 0 : d / max, brightness: max, alpha };
}

export function hsbaToHex({ hue, saturation, brightness, alpha }: HSBA): string {
  const c = brightness * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = brightness - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const hx = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0").toUpperCase();
  const base = `#${hx(r)}${hx(g)}${hx(b)}`;
  if (alpha < 1) return base + Math.round(alpha * 255).toString(16).padStart(2, "0").toUpperCase();
  return base;
}
