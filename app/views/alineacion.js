// Alineación: cancha con formaciones. Se arma tocando cada posición; se guarda en este celular.
import { esc, store, icon, money } from "../util.js";
import { POS } from "./plantel.js";
import { nextMatch, whenText, versus, attendanceOf } from "../matches.js";

const S = (c, t, x, y) => ({ c, t, x, y });
const POR = ["POR"], LAT = ["LAT"], DFC = ["DFC"], MCD = ["MCD"], MCO = ["MCO"], MC = ["MCD", "MCO"], EXT = ["EXT"], DC = ["DC"], LD3 = ["LAT", "DFC"];
// Fut 7: medio izquierdo y derecho; el medio del centro acepta a cualquiera de los medios.
const MI = ["MI", "EXT"], MD = ["MD", "EXT"], MC7 = ["MC", "MI", "MD", "MCD", "MCO"];
export const FORMS = {
  "4-3-3": { f: 11, s: [S("DC", DC, 50, 10), S("EI", EXT, 16, 19), S("ED", EXT, 84, 19), S("MCO", MCO, 29, 37), S("MCO", MCO, 71, 37), S("MCD", MCD, 50, 51), S("LI", LAT, 11, 68), S("DFC", DFC, 35, 72), S("DFC", DFC, 65, 72), S("LD", LAT, 89, 68), S("POR", POR, 50, 89)] },
  "4-4-2": { f: 11, s: [S("DC", DC, 36, 11), S("DC", DC, 64, 11), S("MI", EXT, 12, 36), S("MC", MC, 37, 43), S("MC", MC, 63, 43), S("MD", EXT, 88, 36), S("LI", LAT, 11, 68), S("DFC", DFC, 35, 72), S("DFC", DFC, 65, 72), S("LD", LAT, 89, 68), S("POR", POR, 50, 89)] },
  "4-2-3-1": { f: 11, s: [S("DC", DC, 50, 9), S("EI", EXT, 15, 27), S("MCO", MCO, 50, 30), S("ED", EXT, 85, 27), S("MCD", MCD, 33, 50), S("MCD", MCD, 67, 50), S("LI", LAT, 11, 68), S("DFC", DFC, 35, 72), S("DFC", DFC, 65, 72), S("LD", LAT, 89, 68), S("POR", POR, 50, 89)] },
  "3-5-2": { f: 11, s: [S("DC", DC, 36, 10), S("DC", DC, 64, 10), S("MC", MC, 31, 38), S("MC", MC, 69, 38), S("LI", LAT, 10, 52), S("MCD", MCD, 50, 53), S("LD", LAT, 90, 52), S("DFC", DFC, 25, 72), S("DFC", DFC, 50, 72), S("DFC", DFC, 75, 72), S("POR", POR, 50, 90)] },
  "5-3-2": { f: 11, s: [S("DC", DC, 36, 10), S("DC", DC, 64, 10), S("MCO", MCO, 28, 33), S("MCO", MCO, 72, 33), S("MCD", MCD, 50, 47), S("LI", LAT, 9, 60), S("DFC", DFC, 29, 72), S("DFC", DFC, 50, 72), S("DFC", DFC, 71, 72), S("LD", LAT, 91, 60), S("POR", POR, 50, 90)] },
  "2-3-1": { f: 7, s: [S("DC", DC, 50, 13), S("MI", MI, 15, 38), S("MC", MC7, 50, 43), S("MD", MD, 85, 38), S("DFC", DFC, 30, 70), S("DFC", DFC, 70, 70), S("POR", POR, 50, 89)] },
  "3-2-1": { f: 7, s: [S("DC", DC, 50, 13), S("MI", MI, 31, 41), S("MD", MD, 69, 41), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
  "3-1-2": { f: 7, s: [S("DC", DC, 34, 13), S("DC", DC, 66, 13), S("MC", MC7, 50, 40), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
  // Fútbol 5, 6, 8 y 9 (el portero cuenta como uno de los jugadores).
  "2-1-1": { f: 5, s: [S("DC", DC, 50, 14), S("MC", MC, 50, 40), S("DFC", DFC, 30, 67), S("DFC", DFC, 70, 67), S("POR", POR, 50, 89)] },
  "1-2-1": { f: 5, s: [S("DC", DC, 50, 14), S("EI", EXT, 16, 41), S("ED", EXT, 84, 41), S("DFC", DFC, 50, 67), S("POR", POR, 50, 89)] },
  "2-2-1": { f: 6, s: [S("DC", DC, 50, 13), S("MC", MC, 32, 40), S("MC", MC, 68, 40), S("DFC", DFC, 30, 68), S("DFC", DFC, 70, 68), S("POR", POR, 50, 89)] },
  "2-1-2": { f: 6, s: [S("DC", DC, 36, 13), S("DC", DC, 64, 13), S("MC", MC, 50, 41), S("DFC", DFC, 30, 68), S("DFC", DFC, 70, 68), S("POR", POR, 50, 89)] },
  "3-1-1": { f: 6, s: [S("DC", DC, 50, 13), S("MC", MC, 50, 40), S("LI", LD3, 16, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 84, 66), S("POR", POR, 50, 89)] },
  "3-3-1": { f: 8, s: [S("DC", DC, 50, 12), S("EI", EXT, 15, 36), S("MC", MC, 50, 41), S("ED", EXT, 85, 36), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
  "3-2-2": { f: 8, s: [S("DC", DC, 36, 12), S("DC", DC, 64, 12), S("MC", MC, 32, 40), S("MC", MC, 68, 40), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
  "2-4-1": { f: 8, s: [S("DC", DC, 50, 12), S("MI", EXT, 12, 38), S("MC", MC, 37, 43), S("MC", MC, 63, 43), S("MD", EXT, 88, 38), S("DFC", DFC, 30, 70), S("DFC", DFC, 70, 70), S("POR", POR, 50, 89)] },
  "3-3-2": { f: 9, s: [S("DC", DC, 36, 11), S("DC", DC, 64, 11), S("EI", EXT, 14, 37), S("MC", MC, 50, 42), S("ED", EXT, 86, 37), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
  "3-4-1": { f: 9, s: [S("DC", DC, 50, 11), S("MI", EXT, 12, 36), S("MC", MC, 37, 43), S("MC", MC, 63, 43), S("MD", EXT, 88, 36), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
  "4-3-1": { f: 9, s: [S("DC", DC, 50, 11), S("EI", EXT, 15, 36), S("MC", MC, 50, 42), S("ED", EXT, 85, 36), S("LI", LAT, 11, 66), S("DFC", DFC, 36, 71), S("DFC", DFC, 64, 71), S("LD", LAT, 89, 66), S("POR", POR, 50, 89)] },
};

function load(ctx) {
  const forms = Object.keys(FORMS).filter((k) => FORMS[k].f === (ctx.team.format || 11));
  let st = store(ctx.key + ":lineup");
  if (!st || !FORMS[st.form] || FORMS[st.form].f !== (ctx.team.format || 11)) st = { form: forms[0], slots: [] };
  st.slots = FORMS[st.form].s.map((_, i) => st.slots[i] || null);
  return { st, forms };
}
const att = (ctx) => { const n = nextMatch(ctx.team); const A = n && attendanceOf(n, ctx.live); return A ? { va: new Set(A.va), no: new Set(A.no) } : null; };
const rank = (A, id) => (!A ? 1 : A.va.has(id) ? 0 : A.no.has(id) ? 2 : 1);
const active = (ctx) => { const A = att(ctx); return ctx.team.roster.filter((r) => r.status !== "congelado" && ctx.playersById[r.player]).sort((a, b) => rank(A, a.player) - rank(A, b.player)); };
const conf = (A, id) => !A || A.va.has(id);
const tag = (A, id) => (!A ? "" : A.va.has(id) ? '<span class="chip ok">Va</span>' : A.no.has(id) ? '<span class="chip na">No va</span>' : "");

function token(ctx, pid, slot, i) {
  const style = `left:${slot.x}%;top:${slot.y}%`;
  if (!pid) return `<button type="button" class="tk empty" data-slot="${i}" style="${style}" aria-label="Elegir ${esc(slot.c)}"><span class="tk-sh"></span><span class="tk-plus">+</span><span class="tk-pos">${esc(slot.c)}</span></button>`;
  const p = ctx.playersById[pid], r = ctx.team.roster.find((x) => x.player === pid) || {};
  return `<button type="button" class="tk" data-slot="${i}" style="${style}" aria-label="${esc(slot.c)}: ${esc(p.name)}"><span class="tk-sh"></span>
    <span class="tk-no">${esc(r.number || "–")}</span><span class="tk-pos">${esc(slot.c)}</span><span class="tk-nm">${esc(p.name)}</span></button>`;
}

function benchHtml(ctx, bench) {
  const A = att(ctx);
  const chip = (r) => `<span class="bch${conf(A, r.player) ? "" : " out"}">${r.number ? `<i>${esc(r.number)}</i>` : ""}${esc(ctx.playersById[r.player].name)}</span>`;
  if (!A) return `<div class="bench"><span class="lbl">Banca (${bench.length})</span><div class="bench-row">${bench.map(chip).join("") || '<span class="hint">Todos están en la cancha.</span>'}</div></div>`;
  const yes = bench.filter((r) => A.va.has(r.player)), nope = bench.filter((r) => A.no.has(r.player)), pend = bench.filter((r) => !A.va.has(r.player) && !A.no.has(r.player));
  return `<div class="bench"><span class="lbl">Confirmados en banca (${yes.length})</span><div class="bench-row">${yes.map(chip).join("") || '<span class="hint">Todos los confirmados están en la cancha.</span>'}</div>
    <span class="lbl">Sin confirmar (${pend.length})</span><div class="bench-row">${pend.map(chip).join("") || '<span class="hint">Todos respondieron.</span>'}</div>
    ${nope.length ? `<span class="lbl">No van (${nope.length})</span><div class="bench-row">${nope.map(chip).join("")}</div>` : ""}</div>`;
}

function refHtml(ctx) {
  const A = att(ctx); if (!A || !ctx.team.finance || !ctx.team.finance.arbitraje) return "";
  const yes = active(ctx).filter((r) => conf(A, r.player));
  const pay = yes.filter((r) => r.arbitraje !== false);
  if (!pay.length) return "";
  const items = ctx.team.finance.arbitraje.items.filter((i) => /rbitro|ripleta/.test(i.t));
  return `<div class="arb"><span class="lbl">Arbitraje entre los confirmados</span>
    <p class="hint">${yes.length} confirmados, pagan ${pay.length} (el portero becado no paga).</p>
    <ul>${items.map((i) => `<li><span>${esc(i.t)} ${money(i.m)}</span><b>${money(Math.ceil(i.m / pay.length))} c/u</b></li>`).join("")}</ul>
    <p class="hint">Si alguien sin credencial juega, suma $20 de permiso. Cambia si se confirman más o menos jugadores.</p></div>`;
}

function view(ctx) {
  const { st, forms } = load(ctx);
  const F = FORMS[st.form];
  const on = new Set(st.slots.filter(Boolean));
  const bench = active(ctx).filter((r) => !on.has(r.player));
  const filled = st.slots.filter(Boolean).length;
  return `<section class="s"><h2>Alineación <small>${filled} de ${F.s.length}</small></h2>
    ${(() => { const n = nextMatch(ctx.team); return n ? `<p class="next">${esc((n.jornada ? n.jornada + " · " : "") + versus(n, ctx.club.name) + " · " + whenText(n.date))}</p>` : ""; })()}
    <div class="forms" role="group" aria-label="Formación">${forms.map((k) => `<button type="button" class="fm${k === st.form ? " on" : ""}" data-form="${k}" aria-pressed="${k === st.form}">${k}</button>`).join("")}</div>
    <div class="pitch">
      <svg class="lines" viewBox="0 0 100 135" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100" height="135"/><line x1="0" y1="67.5" x2="100" y2="67.5"/><circle cx="50" cy="67.5" r="11"/><rect x="22" y="0" width="56" height="20"/><rect x="36" y="0" width="28" height="7"/><rect x="22" y="115" width="56" height="20"/><rect x="36" y="128" width="28" height="7"/></svg>
      <img class="pitch-wm" src="${esc(ctx.crest)}" alt="">
      ${F.s.map((slot, i) => token(ctx, st.slots[i], slot, i)).join("")}
    </div>
    ${benchHtml(ctx, bench)}
    ${refHtml(ctx)}
    <div class="row-acts"><span class="hint">Se guarda solo en este celular.</span>${filled ? '<button type="button" class="btn ghost" data-clear="1">Vaciar cancha</button>' : ""}</div></section>`;
}

function picker(ctx, i) {
  const { st } = load(ctx);
  const slot = FORMS[st.form].s[i];
  const where = Object.fromEntries(st.slots.map((pid, j) => [pid, j]).filter(([pid]) => pid));
  const A = att(ctx);
  const list = active(ctx).map((r) => ({ r, p: ctx.playersById[r.player] }));
  const fits = (x) => (x.p.positions || []).some((t) => slot.t.includes(t));
  const row = (x) => {
    const j = where[x.p.id];
    const chips = tag(A, x.p.id) + (x.p.positions || []).map((t) => `<span class="chip ${slot.t.includes(t) ? "due" : "na"}">${t}</span>`).join("");
    return `<button type="button" class="pick" data-pick="${esc(x.p.id)}"><span class="pk-no">${esc(x.r.number || "–")}</span><span class="pk-n">${esc(x.p.name)}<span class="chips">${chips}</span></span>${j != null && j !== i ? `<span class="pk-st">En ${esc(FORMS[st.form].s[j].c)}</span>` : j === i ? '<span class="pk-st">Aquí</span>' : ""}</button>`;
  };
  const byFit = (x, y) => fits(y) - fits(x);
  const yes = list.filter((x) => conf(A, x.p.id)).sort(byFit);
  const rest = list.filter((x) => !conf(A, x.p.id));
  const no = rest.filter((x) => A && A.no.has(x.p.id)).sort(byFit), pend = rest.filter((x) => !(A && A.no.has(x.p.id))).sort(byFit);
  const sec = (l, arr, dim) => (arr.length ? `<span class="lbl">${l}</span><div${dim ? ' class="dim"' : ""}>${arr.map(row).join("")}</div>` : "");
  return `<div class="bd" data-close="1"></div><div class="sp" role="dialog" aria-modal="true" aria-label="Elegir ${esc(slot.c)}">
    <div class="sp-h"><div><h3>${esc(slot.c)}</h3><p>${esc(slot.t.map((t) => POS[t] || t).join(" o "))}</p></div><button type="button" class="x" data-close="1" aria-label="Cerrar">${icon.close}</button></div>
    ${st.slots[i] ? `<button type="button" class="btn ghost" data-unpick="${i}">Dejar vacía esta posición</button>` : ""}
    ${A ? sec(`Confirmados (${yes.length})`, yes, false) + sec(`Sin confirmar (${pend.length})`, pend, true) + sec(`No van (${no.length})`, no, true) : sec("Jugadores", yes.concat(rest), false)}</div>`;
}

export function render(ctx) { return `<div id="lineup">${view(ctx)}</div>`; }

export function bind(root, ctx) {
  const host = document.getElementById("sheet");
  let cur = null;
  const close = () => { host.hidden = true; host.innerHTML = ""; };
  const redraw = () => { root.querySelector("#lineup").innerHTML = view(ctx); };
  const save = (fn) => { const { st } = load(ctx); fn(st); store(ctx.key + ":lineup", st); redraw(); };
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.form) save((st) => { if (st.form !== t.dataset.form) { const old = st.slots; st.form = t.dataset.form; st.slots = FORMS[st.form].s.map((_, i) => old[i] || null); } });
    else if (t.dataset.slot != null) { cur = +t.dataset.slot; host.innerHTML = picker(ctx, cur); host.hidden = false; host.querySelector(".x").focus(); }
    else if (t.dataset.clear) save((st) => { st.slots = st.slots.map(() => null); });
  });
  host.onclick = (e) => {
    const t = e.target.closest("[data-close], [data-pick], [data-unpick]"); if (!t) return;
    if (t.dataset.pick) save((st) => { const j = st.slots.indexOf(t.dataset.pick); const prev = st.slots[cur]; if (j > -1) st.slots[j] = prev || null; st.slots[cur] = t.dataset.pick; });
    else if (t.dataset.unpick != null) save((st) => { st.slots[cur] = null; });
    close();
  };
  document.onkeydown = (e) => { if (e.key === "Escape" && !host.hidden) close(); };
}
