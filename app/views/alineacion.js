// Alineación: cancha con formaciones. Se arma tocando cada posición; se guarda en este celular.
import { esc, store, icon } from "../util.js";
import { POS } from "./plantel.js";

const S = (c, t, x, y) => ({ c, t, x, y });
const POR = ["POR"], LAT = ["LAT"], DFC = ["DFC"], MCD = ["MCD"], MCO = ["MCO"], MC = ["MCD", "MCO"], EXT = ["EXT"], DC = ["DC"], LD3 = ["LAT", "DFC"];
export const FORMS = {
  "4-3-3": { f: 11, s: [S("DC", DC, 50, 10), S("EI", EXT, 16, 19), S("ED", EXT, 84, 19), S("MCO", MCO, 29, 37), S("MCO", MCO, 71, 37), S("MCD", MCD, 50, 51), S("LI", LAT, 11, 68), S("DFC", DFC, 35, 72), S("DFC", DFC, 65, 72), S("LD", LAT, 89, 68), S("POR", POR, 50, 89)] },
  "4-4-2": { f: 11, s: [S("DC", DC, 36, 11), S("DC", DC, 64, 11), S("MI", EXT, 12, 36), S("MC", MC, 37, 43), S("MC", MC, 63, 43), S("MD", EXT, 88, 36), S("LI", LAT, 11, 68), S("DFC", DFC, 35, 72), S("DFC", DFC, 65, 72), S("LD", LAT, 89, 68), S("POR", POR, 50, 89)] },
  "4-2-3-1": { f: 11, s: [S("DC", DC, 50, 9), S("EI", EXT, 15, 27), S("MCO", MCO, 50, 30), S("ED", EXT, 85, 27), S("MCD", MCD, 33, 50), S("MCD", MCD, 67, 50), S("LI", LAT, 11, 68), S("DFC", DFC, 35, 72), S("DFC", DFC, 65, 72), S("LD", LAT, 89, 68), S("POR", POR, 50, 89)] },
  "3-5-2": { f: 11, s: [S("DC", DC, 36, 10), S("DC", DC, 64, 10), S("MC", MC, 31, 38), S("MC", MC, 69, 38), S("LI", LAT, 10, 52), S("MCD", MCD, 50, 53), S("LD", LAT, 90, 52), S("DFC", DFC, 25, 72), S("DFC", DFC, 50, 72), S("DFC", DFC, 75, 72), S("POR", POR, 50, 90)] },
  "5-3-2": { f: 11, s: [S("DC", DC, 36, 10), S("DC", DC, 64, 10), S("MCO", MCO, 28, 33), S("MCO", MCO, 72, 33), S("MCD", MCD, 50, 47), S("LI", LAT, 9, 60), S("DFC", DFC, 29, 72), S("DFC", DFC, 50, 72), S("DFC", DFC, 71, 72), S("LD", LAT, 91, 60), S("POR", POR, 50, 90)] },
  "2-3-1": { f: 7, s: [S("DC", DC, 50, 13), S("EI", EXT, 15, 38), S("MC", MC, 50, 43), S("ED", EXT, 85, 38), S("DFC", DFC, 30, 70), S("DFC", DFC, 70, 70), S("POR", POR, 50, 89)] },
  "3-2-1": { f: 7, s: [S("DC", DC, 50, 13), S("MC", MC, 31, 41), S("MC", MC, 69, 41), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
  "3-1-2": { f: 7, s: [S("DC", DC, 34, 13), S("DC", DC, 66, 13), S("MC", MC, 50, 40), S("LI", LD3, 14, 66), S("DFC", DFC, 50, 70), S("LD", LD3, 86, 66), S("POR", POR, 50, 89)] },
};

function load(ctx) {
  const forms = Object.keys(FORMS).filter((k) => FORMS[k].f === (ctx.team.format || 11));
  let st = store(ctx.key + ":lineup");
  if (!st || !FORMS[st.form] || FORMS[st.form].f !== (ctx.team.format || 11)) st = { form: forms[0], slots: [] };
  st.slots = FORMS[st.form].s.map((_, i) => st.slots[i] || null);
  return { st, forms };
}
const active = (ctx) => ctx.team.roster.filter((r) => r.status !== "congelado" && ctx.playersById[r.player]);

function token(ctx, pid, slot, i) {
  const style = `left:${slot.x}%;top:${slot.y}%`;
  if (!pid) return `<button type="button" class="tk empty" data-slot="${i}" style="${style}" aria-label="Elegir ${esc(slot.c)}"><span class="tk-sh"></span><span class="tk-plus">+</span><span class="tk-pos">${esc(slot.c)}</span></button>`;
  const p = ctx.playersById[pid], r = ctx.team.roster.find((x) => x.player === pid) || {};
  return `<button type="button" class="tk" data-slot="${i}" style="${style}" aria-label="${esc(slot.c)}: ${esc(p.name)}"><span class="tk-sh"></span>
    <span class="tk-no">${esc(r.number || "–")}</span><span class="tk-pos">${esc(slot.c)}</span><span class="tk-nm">${esc(p.name)}</span></button>`;
}

function view(ctx) {
  const { st, forms } = load(ctx);
  const F = FORMS[st.form];
  const on = new Set(st.slots.filter(Boolean));
  const bench = active(ctx).filter((r) => !on.has(r.player));
  const filled = st.slots.filter(Boolean).length;
  return `<section class="s"><h2>Alineación <small>${filled} de ${F.s.length}</small></h2>
    ${ctx.team.next ? `<p class="next">${esc(ctx.team.next)}</p>` : ""}
    <div class="forms" role="group" aria-label="Formación">${forms.map((k) => `<button type="button" class="fm${k === st.form ? " on" : ""}" data-form="${k}" aria-pressed="${k === st.form}">${k}</button>`).join("")}</div>
    <div class="pitch">
      <svg class="lines" viewBox="0 0 100 135" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100" height="135"/><line x1="0" y1="67.5" x2="100" y2="67.5"/><circle cx="50" cy="67.5" r="11"/><rect x="22" y="0" width="56" height="20"/><rect x="36" y="0" width="28" height="7"/><rect x="22" y="115" width="56" height="20"/><rect x="36" y="128" width="28" height="7"/></svg>
      <img class="pitch-wm" src="${esc(ctx.crest)}" alt="">
      ${F.s.map((slot, i) => token(ctx, st.slots[i], slot, i)).join("")}
    </div>
    <div class="bench"><span class="lbl">Banca (${bench.length})</span><div class="bench-row">${bench.map((r) => `<span class="bch">${r.number ? `<i>${esc(r.number)}</i>` : ""}${esc(ctx.playersById[r.player].name)}</span>`).join("") || '<span class="hint">Todos están en la cancha.</span>'}</div></div>
    <div class="row-acts"><span class="hint">Se guarda solo en este celular.</span>${filled ? '<button type="button" class="btn ghost" data-clear="1">Vaciar cancha</button>' : ""}</div></section>`;
}

function picker(ctx, i) {
  const { st } = load(ctx);
  const slot = FORMS[st.form].s[i];
  const where = Object.fromEntries(st.slots.map((pid, j) => [pid, j]).filter(([pid]) => pid));
  const list = active(ctx).map((r) => ({ r, p: ctx.playersById[r.player] }));
  const fits = (x) => (x.p.positions || []).some((t) => slot.t.includes(t));
  const row = (x) => {
    const j = where[x.p.id];
    const chips = (x.p.positions || []).map((t) => `<span class="chip ${slot.t.includes(t) ? "due" : "na"}">${t}</span>`).join("");
    return `<button type="button" class="pick" data-pick="${esc(x.p.id)}"><span class="pk-no">${esc(x.r.number || "–")}</span><span class="pk-n">${esc(x.p.name)}<span class="chips">${chips}</span></span>${j != null && j !== i ? `<span class="pk-st">En ${esc(FORMS[st.form].s[j].c)}</span>` : j === i ? '<span class="pk-st">Aquí</span>' : ""}</button>`;
  };
  const rec = list.filter(fits), rest = list.filter((x) => !fits(x));
  return `<div class="bd" data-close="1"></div><div class="sp" role="dialog" aria-modal="true" aria-label="Elegir ${esc(slot.c)}">
    <div class="sp-h"><div><h3>${esc(slot.c)}</h3><p>${esc(slot.t.map((t) => POS[t] || t).join(" o "))}</p></div><button type="button" class="x" data-close="1" aria-label="Cerrar">${icon.close}</button></div>
    ${st.slots[i] ? `<button type="button" class="btn ghost" data-unpick="${i}">Dejar vacía esta posición</button>` : ""}
    ${rec.length ? `<span class="lbl">Juegan de ${esc(slot.c)}</span>${rec.map(row).join("")}` : ""}
    ${rest.length ? `<span class="lbl">Otros jugadores</span>${rest.map(row).join("")}` : ""}</div>`;
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
