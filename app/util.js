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
  cuenta: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4"/></svg>',
  torneos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4M8 20h8l-1-3H9z"/></svg>',
  equipos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  sanciones: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="10" height="15" rx="1.5" transform="rotate(12 12 11)"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
