// Colores a partir del escudo: se calculan en el celular, sin costo ni servidor.
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// Paleta completa de un club a partir de su color principal. Fondo oscuro para que todo se lea igual que en Diablos.
export function themeFrom(primary) {
  const dark = "#0b0b0b", soft = mix(primary, "#ffffff", lum(primary) < 0.12 ? 0.45 : 0.25);
  return {
    bg: mix(dark, primary, 0.07), panel: mix(dark, primary, 0.13), raise: mix(dark, primary, 0.19), line: mix(dark, primary, 0.3),
    text: "#ffffff", muted: mix("#a3a3a3", primary, 0.12), primary, primarySoft: soft, onPrimary: lum(primary) > 0.45 ? "#0b0b0b" : "#ffffff",
  };
}

// Color más representativo de una imagen: el grupo más frecuente entre los colores vivos (ni blancos, ni negros, ni grises).
export function dominant(source) {
  return new Promise((res) => {
    const url = URL.createObjectURL(source), img = new Image();
    img.onload = () => {
      const n = 48, c = document.createElement("canvas"); c.width = c.height = n;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, n, n); URL.revokeObjectURL(url);
      const px = x.getImageData(0, 0, n, n).data, bins = new Map();
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]]; if (a < 200) continue;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
        if (mx < 45 || (mn > 215 && sat < 0.15) || sat < 0.28) continue;
        const k = (r >> 5) + "," + (g >> 5) + "," + (b >> 5), e = bins.get(k) || { w: 0, n: 0, r: 0, g: 0, b: 0 };
        e.w += 1 + sat; e.n += 1; e.r += r; e.g += g; e.b += b; bins.set(k, e);
      }
      let best = null; bins.forEach((e) => { if (!best || e.w > best.w) best = e; });
      res(best ? hex(best.r / best.n, best.g / best.n, best.b / best.n) : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
