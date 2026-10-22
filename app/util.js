// Utilidades compartidas por todas las vistas.

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function money(n) {
  const r = Math.round(n * 100) / 100;
  const s = Math.abs(r).toLocaleString("es-MX", { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return (r < 0 ? "−$" : "$") + s;
}

export const sum = (a, f) => a.reduce((t, x) => t + (+f(x) || 0), 0);

export const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function fecha(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) + ", " +
      d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
  } catch (e) { return iso; }
}

// Plantillas de texto: "{cuota}" se reemplaza por vars.cuota y **x** se vuelve negrita.
export function tpl(str, vars) {
  return esc(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? esc(vars[k]) : m)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

export function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { return null; }
}

export const icon = {
  inicio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/></svg>',
  partidos: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.6 2.6-1.4 4.3H9.8l-1.4-4.3zM12 3.5v4M20.2 9.4l-4.6.7M17.2 19l-3-4.6M6.8 19l3-4.6M3.8 9.4l4.6.7"/></svg>',
  finanzas: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/></svg>',
  plantel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l2 3v12l-7 3-7-3V6z"/><circle cx="12" cy="10" r="2.6"/><path d="M8.5 16c1-1.6 2.2-2.3 3.5-2.3s2.5.7 3.5 2.3"/></svg>',
  alineacion: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 12h16"/><circle cx="12" cy="12" r="2.6"/><path d="M9 3v3h6V3M9 21v-3h6v3"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
