// Aplica la estética de cada club. Todo sale de club.json -> "theme":
//
//   colors:  bg, panel, raise, line, text, muted, primary, primarySoft
//   fonts:   display (títulos y números), cond (etiquetas), body (texto). Cualquier fuente de Google Fonts.
//   card:    forma de las tarjetas: "escudo" | "redonda" | "recta"
//   pattern: detalle de marca en encabezados: "franjas" | "diagonal" | "liso"
//
// Un club nuevo solo llena esos valores; la app no se toca.

const COLOR_VARS = { bg: "--ink", panel: "--panel", raise: "--raise", line: "--line", text: "--fg", muted: "--muted", primary: "--red", primarySoft: "--red-soft", onPrimary: "--on-red" };
const FONT_VARS = { display: "--display", cond: "--cond", body: "--body" };
const BUILT_IN = ["Saira Extra Condensed", "Saira Condensed", "Barlow"];
const FALLBACK = { display: '"Arial Narrow", Impact, sans-serif', cond: '"Arial Narrow", sans-serif', body: "system-ui, -apple-system, sans-serif" };

export function applyTheme(club, crestURL) {
  const t = club.theme || { colors: club.colors };
  const root = document.documentElement;
  // Limpia la estética anterior (al pasar de Mi cuenta a un equipo, o de un club a otro).
  [...Object.values(COLOR_VARS), ...Object.values(FONT_VARS)].forEach((v) => root.style.removeProperty(v));
  Object.entries(t.colors || {}).forEach(([k, v]) => { if (COLOR_VARS[k]) root.style.setProperty(COLOR_VARS[k], v); });

  const fonts = t.fonts || {};
  const extra = Object.values(fonts).filter((f) => f && !BUILT_IN.includes(f));
  Object.entries(fonts).forEach(([k, f]) => { if (FONT_VARS[k] && f) root.style.setProperty(FONT_VARS[k], `"${f}", ${FALLBACK[k]}`); });
  let link = document.getElementById("club-fonts");
  if (extra.length) {
    const href = "https://fonts.googleapis.com/css2?" + [...new Set(extra)].map((f) => "family=" + encodeURIComponent(f).replace(/%20/g, "+") + ":wght@400;500;600;700;800").join("&") + "&display=swap";
    if (!link) { link = document.createElement("link"); link.id = "club-fonts"; link.rel = "stylesheet"; document.head.appendChild(link); }
    if (link.href !== href) link.href = href;
  } else if (link) link.remove();

  root.dataset.card = t.card || "escudo";
  root.dataset.pattern = t.pattern || "franjas";
  document.title = club.name;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && t.colors && t.colors.bg) meta.content = t.colors.bg;
  if (crestURL) {
    let ic = document.querySelector('link[rel="icon"]');
    if (!ic) { ic = document.createElement("link"); ic.rel = "icon"; document.head.appendChild(ic); }
    ic.href = crestURL;
  }
}
