// Hoja inferior (diálogo) compartida por las pantallas de cuenta y de administración del equipo.
import { esc } from "./util.js";
import { friendly } from "./cloud.js";

const el = () => document.getElementById("sheet");
export function open(title, sub, body) {
  const h = el();
  h.innerHTML = `<div class="bd" data-cl="close"></div><div class="sp cl" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sp-h"><div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ""}</div><button type="button" class="x" data-cl="close" aria-label="Cerrar">×</button></div>
    <div class="cl-body">${body}</div><p class="msg" role="alert" hidden></p></div>`;
  h.hidden = false;
  const f = h.querySelector("input, select, button.btn"); if (f) f.focus();
}
export const close = () => { const h = el(); h.hidden = true; h.innerHTML = ""; };
export const say = (t) => { const m = el().querySelector(".msg"); if (m) { m.textContent = t; m.hidden = !t; } };
export async function guard(fn) { try { say(""); await fn(); } catch (e) { console.error(e); say(friendly(e)); } }
export const reload = () => { window.__reload && window.__reload(); };

// Escucha una sola vez los botones [data-<ns>j] y formularios [data-<ns>form] que viven dentro de la hoja.
const wiredNs = new Set();
export function wireNs(ns, onClick, onSubmit) {
  if (wiredNs.has(ns)) return; wiredNs.add(ns);
  const sh = el();
  sh.addEventListener("click", (e) => { const t = e.target.closest(`[data-${ns}j]`); if (t) onClick(t.dataset[ns + "j"], t, e); });
  sh.addEventListener("submit", (e) => { const f = e.target.closest(`form[data-${ns}form]`); if (f) { e.preventDefault(); onSubmit(f.dataset[ns + "form"], f, new FormData(f)); } });
}
