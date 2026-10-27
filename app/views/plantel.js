// Plantel: tarjetas de jugador con media y atributos calculados por votos de compañeros.
import { esc, icon } from "../util.js";
import { tierOf, DEFAULT_CFG } from "../rating.js";

export const POS = { POR: "Portero", LAT: "Lateral", DFC: "Defensa central", MCD: "Medio defensivo", MCO: "Medio ofensivo", EXT: "Extremo", MI: "Medio izquierdo", MD: "Medio derecho", DC: "Delantero centro" };
export const ATTRS = [["vel", "VEL", "Velocidad"], ["tir", "TIR", "Tiro"], ["pas", "PAS", "Pase"], ["reg", "REG", "Regate"], ["def", "DEF", "Defensa"], ["fis", "FÍS", "Físico"]];
const LINES = [["todos", "Todos"], ["por", "Porteros"], ["def", "Defensas"], ["med", "Medios"], ["del", "Delanteros"]];
const LINE_OF = { POR: "por", LAT: "def", DFC: "def", MCD: "med", MCO: "med", EXT: "del", MI: "med", MD: "med", DC: "del" };

export function card(p, r, ctx, opts = {}) {
  const R = ctx.ratings[p.id] || {};
  const o = R.media;
  const pos = (p.positions || [])[0] || "";
  const photo = p.photo ? `<img class="fc-ph" src="${esc(ctx.asset(p.photo))}" alt="">` : `<img class="fc-ph ghost" src="${esc(ctx.watermark)}" alt="">`;
  const at = ATTRS.map(([k, l]) => `<i><b>${R.attrs ? R.attrs[k] : "–"}</b>${l}</i>`).join("");
  const tag = opts.tag || "button";
  const trend = R.trend > 0 ? '<span class="fc-tr up" title="En forma">▲</span>' : R.trend < 0 ? '<span class="fc-tr down" title="A la baja">▼</span>' : "";
  return `<${tag} class="fc ${tierOf(o)}${r && r.status === "congelado" ? " off" : ""}"${tag === "button" ? ` type="button" data-p="${esc(p.id)}" aria-label="Ver ficha de ${esc(p.name)}"` : ""}>
    <span class="fc-sh"></span><span class="fc-in">
      <span class="fc-ovr">${o == null ? "–" : o}</span><span class="fc-pos">${esc(pos)}</span>${trend}
      <img class="fc-cr" src="${esc(ctx.crest)}" alt="">${photo}
      ${r && r.number ? `<span class="fc-no">${esc(r.number)}</span>` : ""}
      ${R.mvps ? `<span class="fc-mvp" title="Mejor del partido">★ ${R.mvps}</span>` : ""}
      <span class="fc-nm">${esc(p.name)}</span><span class="fc-at">${at}</span>
    </span></${tag}>`;
}

export function howHtml(ctx) {
  const w = { ...DEFAULT_CFG.weights, ...((ctx.club.rating || {}).weights || {}) };
  const pc = (x) => Math.round(x * 100) + "%";
  return `<details class="how"><summary>Cómo se califica a cada jugador<span class="ar" aria-hidden="true">▶</span></summary><div class="ans">
    <p>Las calificaciones las ponen los compañeros, no el administrador. Nadie se califica a sí mismo y los votos son anónimos.</p>
    <ol>
      <li><b>Atributos.</b> Al inicio y a mitad de temporada, cada jugador califica del 1 al 10 la velocidad, el tiro, el pase, el regate, la defensa y el físico de sus compañeros.</li>
      <li><b>Forma.</b> Al terminar cada partido, los que jugaron se califican entre sí del 1 al 10 y votan al mejor del partido. Cuentan los últimos 5 partidos.</li>
      <li><b>Compromiso.</b> El porcentaje de partidos que ha jugado.</li>
    </ol>
    <p>La media es <b>${pc(w.atributos)} atributos + ${pc(w.forma)} forma + ${pc(w.compromiso)} compromiso</b>, en escala de 40 a 99. Con 75 o más la tarjeta es de oro, de 65 a 74 de plata, y abajo de 65 de bronce.</p>
    <p>Para que sea justo: con menos de 3 votos no cuenta, y con 5 o más se quitan el voto más alto y el más bajo. La flecha ▲ o ▼ indica si en su último partido estuvo arriba o abajo de su media.</p>
  </div></details>`;
}

export function render(ctx) {
  const roster = ctx.team.roster.map((r) => ({ r, p: ctx.playersById[r.player] })).filter((x) => x.p);
  roster.sort((a, b) => (a.r.status === "congelado") - (b.r.status === "congelado") || (parseInt(a.r.number, 10) || 999) - (parseInt(b.r.number, 10) || 999) || a.p.name.localeCompare(b.p.name, "es"));
  const rated = roster.filter((x) => ctx.ratings[x.p.id] && ctx.ratings[x.p.id].media != null).length;
  return `<section class="s"><h2>Plantel <small>${roster.length} jugadores</small></h2>
    ${rated ? "" : "<p>Las tarjetas se llenan con los votos de los compañeros. Todavía no hay votaciones registradas.</p>"}
    ${howHtml(ctx)}
    <div class="seg-tabs" role="tablist">${LINES.map(([k, l], i) => `<button type="button" role="tab" data-line="${k}" aria-selected="${i === 0}">${l}</button>`).join("")}</div>
    <div class="cards">${roster.map(({ r, p }) => `<div class="cw" data-line="${LINE_OF[(p.positions || [])[0]] || "otros"}">${card(p, r, ctx)}</div>`).join("")}</div></section>`;
}

export function sheet(ctx, id) {
  const p = ctx.playersById[id];
  const r = ctx.team.roster.find((x) => x.player === id) || {};
  const R = ctx.ratings[id] || {};
  const pos = (p.positions || []).map((k) => `<span class="chip na">${esc(POS[k] || k)}</span>`).join(" ") || '<span class="hint">Sin posición registrada</span>';
  const bars = ATTRS.map(([k, , name]) => {
    const v = R.attrs ? R.attrs[k] : null;
    return `<li><span>${name}</span><span class="bar-v"><span class="bar-f" style="width:${v || 0}%"></span></span><b>${v == null ? "–" : v}</b></li>`;
  }).join("");
  const stat = (v, l) => `<div><b>${v == null ? "–" : v}</b><span>${l}</span></div>`;
  return `<div class="bd" data-close="1"></div><div class="sp" role="dialog" aria-modal="true" aria-label="Ficha de ${esc(p.name)}">
    <div class="sp-h"><div><h3>${esc(p.name)}</h3><p>${r.number ? "#" + esc(r.number) + " · " : ""}${esc(ctx.team.name)}${r.status === "congelado" ? " · Congelado" : ""}${r.note ? " · " + esc(r.note) : ""}</p></div>
    <button type="button" class="x" data-close="1" aria-label="Cerrar">${icon.close}</button></div>
    <div class="sp-card">${card(p, r, ctx, { tag: "div" })}</div>
    <div class="stats">${stat(R.played, "Partidos")}${stat(R.goals, "Goles")}${stat(R.assists, "Asistencias")}${stat(R.mvps, "Mejor del partido")}</div>
    <div class="stats three">${stat(R.forma, "Forma")}${stat(R.compromiso, "Compromiso")}${stat(R.media, "Media")}</div>
    <div class="blk"><span class="lbl">Posiciones</span><div class="chips">${pos}</div></div>
    <div class="blk"><span class="lbl">Atributos</span><ul class="attr">${bars}</ul>
    ${R.media == null ? '<p class="hint">Todavía no tiene votos suficientes para su media.</p>' : ""}</div></div>`;
}

export function openSheet(ctx, id) {
  const host = document.getElementById("sheet");
  host.innerHTML = sheet(ctx, id); host.hidden = false; host.querySelector(".x").focus();
  host.onclick = (e) => { if (e.target.closest("[data-close]")) { host.hidden = true; host.innerHTML = ""; } };
  document.onkeydown = (e) => { if (e.key === "Escape" && !host.hidden) { host.hidden = true; host.innerHTML = ""; } };
}

export function bind(root, ctx) {
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-line], [data-p]");
    if (!t) return;
    if (t.dataset.p) { openSheet(ctx, t.dataset.p); return; }
    if (t.tagName === "BUTTON") {
      root.querySelectorAll(".seg-tabs button").forEach((b) => b.setAttribute("aria-selected", b === t));
      root.querySelectorAll(".cw").forEach((c) => { c.hidden = t.dataset.line !== "todos" && c.dataset.line !== t.dataset.line; });
    }
  });
}
