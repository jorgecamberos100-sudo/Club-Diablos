// Plantel: tarjetas de jugador estilo videojuego de fútbol, con ficha al tocarlas.
import { esc, icon } from "../util.js";

export const POS = { POR: "Portero", LAT: "Lateral", DFC: "Defensa central", MCD: "Medio defensivo", MCO: "Medio ofensivo", EXT: "Extremo", DC: "Delantero centro" };
export const ATTRS = [["vel", "VEL", "Velocidad"], ["tir", "TIR", "Tiro"], ["pas", "PAS", "Pase"], ["reg", "REG", "Regate"], ["def", "DEF", "Defensa"], ["fis", "FÍS", "Físico"]];
const LINES = [["todos", "Todos"], ["por", "Porteros"], ["def", "Defensas"], ["med", "Medios"], ["del", "Delanteros"]];
const LINE_OF = { POR: "por", LAT: "def", DFC: "def", MCD: "med", MCO: "med", EXT: "del", DC: "del" };

export function overall(p) {
  const a = p.attrs;
  if (!a) return null;
  const v = ATTRS.map(([k]) => a[k]).filter((x) => typeof x === "number");
  return v.length === ATTRS.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
}
const tier = (o) => (o == null ? "t-club" : o >= 75 ? "t-oro" : o >= 65 ? "t-plata" : "t-bronce");

export function card(p, r, ctx, opts = {}) {
  const o = overall(p);
  const pos = (p.positions || [])[0] || "";
  const photo = p.photo ? `<img class="fc-ph" src="${esc(ctx.asset(p.photo))}" alt="">` : `<img class="fc-ph ghost" src="${esc(ctx.watermark)}" alt="">`;
  const at = ATTRS.map(([k, l]) => `<i><b>${p.attrs && typeof p.attrs[k] === "number" ? p.attrs[k] : "–"}</b>${l}</i>`).join("");
  const tag = opts.tag || "button";
  return `<${tag} class="fc ${tier(o)}${r && r.status === "congelado" ? " off" : ""}"${tag === "button" ? ` type="button" data-p="${esc(p.id)}" aria-label="Ver ficha de ${esc(p.name)}"` : ""}>
    <span class="fc-sh"></span><span class="fc-in">
      <span class="fc-ovr">${o == null ? "–" : o}</span><span class="fc-pos">${esc(pos)}</span>
      <img class="fc-cr" src="${esc(ctx.crest)}" alt="">${photo}
      ${r && r.number ? `<span class="fc-no">${esc(r.number)}</span>` : ""}
      <span class="fc-nm">${esc(p.name)}</span><span class="fc-at">${at}</span>
    </span></${tag}>`;
}

export function render(ctx) {
  const roster = ctx.team.roster.map((r) => ({ r, p: ctx.playersById[r.player] })).filter((x) => x.p);
  roster.sort((a, b) => (a.r.status === "congelado") - (b.r.status === "congelado") || (parseInt(a.r.number, 10) || 999) - (parseInt(b.r.number, 10) || 999) || a.p.name.localeCompare(b.p.name, "es"));
  const rated = roster.filter((x) => overall(x.p) != null).length;
  return `<section class="s"><h2>Plantel <small>${roster.length} jugadores</small></h2>
    ${rated ? "" : "<p>Las tarjetas todavía no tienen valores. Cuando el equipo los defina, aquí aparecen la media y cada atributo.</p>"}
    <div class="seg-tabs" role="tablist">${LINES.map(([k, l], i) => `<button type="button" role="tab" data-line="${k}" aria-selected="${i === 0}">${l}</button>`).join("")}</div>
    <div class="cards">${roster.map(({ r, p }) => `<div class="cw" data-line="${LINE_OF[(p.positions || [])[0]] || "otros"}">${card(p, r, ctx)}</div>`).join("")}</div></section>`;
}

function sheet(ctx, id) {
  const p = ctx.playersById[id];
  const r = ctx.team.roster.find((x) => x.player === id) || {};
  const pos = (p.positions || []).map((k) => `<span class="chip na">${esc(POS[k] || k)}</span>`).join(" ") || '<span class="hint">Sin posición registrada</span>';
  const bars = ATTRS.map(([k, , name]) => {
    const v = p.attrs && typeof p.attrs[k] === "number" ? p.attrs[k] : null;
    return `<li><span>${name}</span><span class="bar-v"><span class="bar-f" style="width:${v || 0}%"></span></span><b>${v == null ? "–" : v}</b></li>`;
  }).join("");
  return `<div class="bd" data-close="1"></div><div class="sp" role="dialog" aria-modal="true" aria-label="Ficha de ${esc(p.name)}">
    <div class="sp-h"><div><h3>${esc(p.name)}</h3><p>${r.number ? "#" + esc(r.number) + " · " : ""}${esc(ctx.team.name)}${r.status === "congelado" ? " · Congelado" : ""}${r.note ? " · " + esc(r.note) : ""}</p></div>
    <button type="button" class="x" data-close="1" aria-label="Cerrar">${icon.close}</button></div>
    <div class="sp-card">${card(p, r, ctx, { tag: "div" })}</div>
    <div class="blk"><span class="lbl">Posiciones</span><div class="chips">${pos}</div></div>
    <div class="blk"><span class="lbl">Atributos</span><ul class="attr">${bars}</ul>
    ${overall(p) == null ? '<p class="hint">Todavía no tiene valores.</p>' : ""}</div></div>`;
}

export function bind(root, ctx) {
  const host = document.getElementById("sheet");
  const close = () => { host.hidden = true; host.innerHTML = ""; };
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-line], [data-p]");
    if (!t) return;
    if (t.dataset.p) { host.innerHTML = sheet(ctx, t.dataset.p); host.hidden = false; host.querySelector(".x").focus(); return; }
    if (t.tagName === "BUTTON") {
      root.querySelectorAll(".seg-tabs button").forEach((b) => b.setAttribute("aria-selected", b === t));
      root.querySelectorAll(".cw").forEach((c) => { c.hidden = t.dataset.line !== "todos" && c.dataset.line !== t.dataset.line; });
    }
  });
  host.onclick = (e) => { if (e.target.closest("[data-close]")) close(); };
  document.onkeydown = (e) => { if (e.key === "Escape" && !host.hidden) close(); };
}
