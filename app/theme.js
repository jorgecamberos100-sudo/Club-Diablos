// Aplica la marca del club (colores, escudo, nombre) a toda la app.
// Cada club define sus colores en club.json; aquí se convierten en variables de CSS.

const MAP = { bg: "--ink", panel: "--panel", raise: "--raise", line: "--line", text: "--fg", muted: "--muted", primary: "--red", primarySoft: "--red-soft" };

export function applyTheme(club, crestURL) {
  const root = document.documentElement.style;
  Object.entries(club.colors || {}).forEach(([k, v]) => { if (MAP[k]) root.setProperty(MAP[k], v); });
  document.title = club.name;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && club.colors && club.colors.bg) meta.content = club.colors.bg;
  if (crestURL) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = crestURL;
  }
}
