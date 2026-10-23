// Administración de un equipo creado en la app: ajustes, escudo y colores, plantel, calendario y finanzas.
// Los equipos de archivo (Diablos, ejemplo) no pasan por aquí: se siguen editando en sus archivos.
import { esc } from "./util.js";
import { api } from "./cloud.js";
import { open, close, say, guard, reload } from "./sheet.js";
import { POS } from "./views/plantel.js";
import { sorted, versus, whenText } from "./matches.js";
import { dominant, themeFrom } from "./color.js";
import { toast } from "./ui.js";

const FORMATS = [[5, "Fútbol 5"], [6, "Fútbol 6"], [7, "Fútbol 7"], [8, "Fútbol 8"], [9, "Fútbol 9"], [11, "Fútbol 11"]];
const pad = (n) => String(n).padStart(2, "0");
const toInput = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const nameOf = (ctx, id) => (ctx.playersById[id] || {}).name || id;
const isAdminDb = (ctx) => !!(ctx.live && ctx.live.admin && ctx.team.db);
const c_t = (ctx) => [ctx.clubId, ctx.team.id];
const proHint = '<p class="hint">Esta función es del plan Pro. La puedes tener por tu cuenta o porque tu liga la cubre.</p>';

// Vuelve a dibujar la app con datos frescos y abre otra vez una hoja con ellos.
async function refreshThen(fn) { await window.__reload(); const c = window.__ctx && window.__ctx(); if (c && fn) fn(c); }

// ---------- Tarjetas dentro de las vistas ----------
export function cards(ctx, view) {
  if (!isAdminDb(ctx)) return "";
  const b = (label, a, cls = "") => `<button type="button" class="btn ${cls}" data-cl="${a}">${esc(label)}</button>`;
  if (view === "inicio") return `<section class="s cl-card"><h2>Administrar equipo</h2><div class="row-acts">${b("Ajustes y escudo", "ta-settings")}${b("Plantel", "ta-roster", "ghost")}${b("Calendario", "ta-cal", "ghost")}${b("Finanzas", "ta-fin", "ghost")}</div></section>`;
  if (view === "plantel") return `<section class="s cl-card"><h2>Tu plantel</h2><p>${activeCount(ctx) ? activeCount(ctx) + " jugadores activos." : "Aún no hay jugadores."} Agrégalos aquí; no necesitan cuenta.</p><div class="row-acts">${b("Agregar jugador", "addp")}${b("Administrar jugadores", "ta-roster", "ghost")}</div></section>`;
  if (view === "partidos") return `<section class="s cl-card"><h2>Calendario</h2><p>${ctx.team.matches.length ? ctx.team.matches.length + " partidos." : "Aún no hay partidos."} Agrega los de tu torneo y anota los resultados al terminar.</p><div class="row-acts">${b("Agregar partido", "ta-match")}${b("Administrar calendario", "ta-cal", "ghost")}</div></section>`;
  return "";
}
const activeCount = (ctx) => ctx.team.roster.filter((r) => r.status !== "congelado").length;

// ---------- Ajustes, escudo y colores ----------
function settingsSheet(ctx) {
  const can = ctx.live.can("themes"), th = ctx.club.theme || {}, col = (th.colors || {}).primary || "#1f9d61";
  open("Ajustes del equipo", ctx.club.name, `<form data-form="ta-settings" class="fld">
    <label>Nombre del equipo<input name="nm" maxlength="60" value="${esc(ctx.club.name)}" required></label>
    <label>Torneo o liga (opcional)<input name="comp" maxlength="80" value="${esc(ctx.team.competition || "")}" placeholder="Ej. Liga Reforma Intermedia"></label>
    <span class="lbl">Modalidad</span>
    <div class="pickgrid">${FORMATS.map(([n, t]) => `<label class="opt"><input type="radio" name="fmt" value="${n}"${(ctx.team.format || 11) === n ? " checked" : ""}><span>${t}</span></label>`).join("")}</div>
    <label>Escudo<input type="file" name="crest" accept="image/*"></label>
    <div class="crest-prev"><img src="${esc(ctx.crest)}" alt="Escudo actual" width="56" height="56"><span class="hint" id="crest-hint">Cuadrado y con fondo transparente se ve mejor.</span></div>
    ${can ? `<span class="lbl">Colores</span>
      <label class="clr">Color principal<input type="color" name="primary" value="${esc(col)}"></label>
      <button type="button" class="link" data-cl="ta-fromcrest">Sacar el color de mi escudo</button>
      <span class="lbl">Forma de las tarjetas</span>
      <div class="pickgrid">${[["escudo", "Escudo"], ["redonda", "Redonda"], ["recta", "Recta"]].map(([k, t]) => `<label class="opt"><input type="radio" name="card" value="${k}"${(th.card || "escudo") === k ? " checked" : ""}><span>${t}</span></label>`).join("")}</div>
      <span class="lbl">Detalle del encabezado</span>
      <div class="pickgrid">${[["franjas", "Franjas"], ["diagonal", "Diagonal"], ["liso", "Liso"]].map(([k, t]) => `<label class="opt"><input type="radio" name="pattern" value="${k}"${(th.pattern || "franjas") === k ? " checked" : ""}><span>${t}</span></label>`).join("")}</div>`
      : `<span class="lbl">Colores propios</span>${proHint}`}
    <button class="btn" type="submit">Guardar</button></form>`);
  const f = document.querySelector('#sheet input[name="crest"]');
  if (f) f.addEventListener("change", async () => {
    const file = f.files[0]; const p = document.querySelector('#sheet input[name="primary"]'); if (!file) return;
    document.querySelector("#sheet .crest-prev img").src = URL.createObjectURL(file);
    if (p) { const c = await dominant(file); if (c) { p.value = c; document.getElementById("crest-hint").textContent = "Tomé el color de tu escudo; ajústalo si quieres."; } }
  });
}

// PNG cuadrado y chico (conserva transparencia).
function shrinkPng(file, max = 256) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("escudo"))), "image/png");
    };
    img.onerror = () => rej(new Error("No se pudo leer la imagen"));
    img.src = url;
  });
}

// ---------- Plantel ----------
function rosterSheet(ctx) {
  const rows = ctx.team.roster.filter((r) => ctx.playersById[r.player]).slice().sort((a, b) => (a.status === "congelado") - (b.status === "congelado") || (parseInt(a.number, 10) || 999) - (parseInt(b.number, 10) || 999));
  open("Plantel", activeCount(ctx) + " activos de " + rows.length, `<div class="row-acts"><button type="button" class="btn" data-cl="addp">Agregar jugador</button></div>
    ${rows.map((r) => { const p = ctx.playersById[r.player], off = r.status === "congelado";
      return `<div class="cl-row static${off ? " off" : ""}"><span><b>${esc(r.number ? "#" + r.number + " " : "")}${esc(p.name)}</b><small>${esc((p.positions || []).map((k) => POS[k]).join(", ") || "Sin posición")}${off ? " · dado de baja" : ""}</small></span>
        <span class="acts"><button type="button" class="btn sm ghost" data-cl="ta-pedit" data-p="${esc(r.player)}">Editar</button><button type="button" class="btn sm ghost" data-cl="ta-pstat" data-p="${esc(r.player)}" data-v="${off ? "activo" : "congelado"}">${off ? "Reactivar" : "Dar de baja"}</button></span></div>`; }).join("") || '<p class="hint">Aún no hay jugadores.</p>'}
    <p class="hint">Dar de baja no borra al jugador: conserva sus partidos, estadísticas y cuentas.</p>`);
}
function playerSheet(ctx, pid) {
  const p = ctx.playersById[pid], r = ctx.team.roster.find((x) => x.player === pid);
  open("Editar jugador", p.name, `<form data-form="ta-pedit" data-p="${esc(pid)}" class="fld">
    <label>Nombre<input name="nm" maxlength="40" value="${esc(p.name)}" required></label>
    <label>Dorsal<input name="num" inputmode="numeric" maxlength="3" value="${esc(r.number || "")}"></label>
    <label>Posición<select name="pos"><option value="">Sin definir</option>${Object.entries(POS).map(([k, v]) => `<option value="${k}"${(p.positions || [])[0] === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
    <button class="btn" type="submit">Guardar</button><button type="button" class="link" data-cl="ta-roster">Volver al plantel</button></form>`);
}

// ---------- Calendario ----------
function calSheet(ctx) {
  const ms = sorted(ctx.team);
  open("Calendario", ms.length + " partidos", `<div class="row-acts"><button type="button" class="btn" data-cl="ta-match">Agregar partido</button></div>
    ${ms.map((m) => { const done = !!m.score;
      return `<div class="cl-row static"><span><b>${esc(versus(m, ctx.club.name))}</b><small>${esc((m.jornada ? m.jornada + " · " : "") + whenText(m.date))}${m.venue ? " · " + esc(m.venue) : ""}${done ? " · resultado " + m.score.for + "-" + m.score.against : ""}</small></span>
        <span class="acts"><button type="button" class="btn sm ghost" data-cl="ta-match" data-m="${esc(m.id)}">Editar</button>${done ? "" : `<button type="button" class="btn sm ghost" data-cl="ta-mdel" data-m="${esc(m.id)}">Quitar</button>`}</span></div>`; }).join("") || '<p class="hint">Aún no hay partidos.</p>'}
    <p class="hint">Los partidos con resultado no se pueden quitar: son historial.</p>`);
}
function matchSheet(ctx, mid) {
  const m = mid ? ctx.team.matches.find((x) => x.id === mid) : null;
  open(m ? "Editar partido" : "Agregar partido", ctx.club.name, `<form data-form="ta-match" data-m="${esc(mid || "")}" class="fld">
    <label>Rival<input name="rival" maxlength="40" value="${esc(m ? m.rival : "")}" required></label>
    <label>Fecha y hora<input name="date" type="datetime-local" value="${esc(m ? toInput(m.date) : "")}" required></label>
    <label>Jornada (opcional)<input name="jornada" maxlength="20" value="${esc(m ? m.jornada || "" : "")}" placeholder="J1"></label>
    <label>Cancha (opcional)<input name="venue" maxlength="40" value="${esc(m ? m.venue || "" : "")}" placeholder="Cancha 2"></label>
    <div class="pickgrid"><label class="opt"><input type="radio" name="home" value="1"${!m || m.home !== false ? " checked" : ""}><span>Local</span></label><label class="opt"><input type="radio" name="home" value="0"${m && m.home === false ? " checked" : ""}><span>Visitante</span></label></div>
    <button class="btn" type="submit">Guardar</button><button type="button" class="link" data-cl="ta-cal">Volver al calendario</button></form>`);
}

// ---------- Finanzas ----------
const rowHtml = (s, x = {}) => `<div class="frow"><input name="${s}_label" maxlength="40" placeholder="Concepto" value="${esc(x.label || "")}" aria-label="Concepto"><input name="${s}_costo" type="number" min="0" max="500000" inputmode="numeric" placeholder="$" value="${x.costo != null ? esc(x.costo) : ""}" aria-label="Costo"><input type="hidden" name="${s}_k" value="${esc(x.k || "")}"></div>`;
function finSheet(ctx) {
  if (!ctx.live.can("finance")) return open("Finanzas del equipo", "", `<p>Cuotas, multas, gastos y el historial de movimientos de tu equipo.</p>${proHint}`);
  const f = ctx.team.finance || { cuota: 0, liga: [], gastos: [], cuentas: [], multa: null };
  const flagged = new Set((f.cuentas || []).filter((c) => c.multa).map((c) => c.player));
  const liga = (f.liga || []).filter((x) => x.k !== "multa");
  open("Finanzas del equipo", "Registros internos para que todos vean las cuentas claras. No mueven dinero real.", `<form data-form="ta-fin" class="fld">
    <label>Cuota por jugador<input name="cuota" type="number" min="0" max="50000" inputmode="numeric" value="${esc(f.cuota || "")}" required></label>
    <label>Qué cubre la cuota (opcional)<input name="nota" maxlength="200" value="${esc(f.cuotaNota || "")}" placeholder="Ej. Inscripción, árbitros y balón"></label>
    <span class="lbl">Pagos a la liga (inscripción, credenciales…)</span><div id="rows-liga">${liga.map((x) => rowHtml("liga", x)).join("")}${rowHtml("liga")}</div>
    <button type="button" class="link" data-cl="ta-addrow" data-s="liga">+ Agregar concepto</button>
    <span class="lbl">Otros gastos del equipo (árbitro, balones…)</span><div id="rows-gastos">${(f.gastos || []).map((x) => rowHtml("gastos", x)).join("")}${rowHtml("gastos")}</div>
    <button type="button" class="link" data-cl="ta-addrow" data-s="gastos">+ Agregar concepto</button>
    <label>Multa total (opcional)<input name="multa" type="number" min="0" max="50000" inputmode="numeric" value="${f.multa ? esc(f.multa.total) : ""}"></label>
    <span class="lbl">Quiénes la pagan (se reparte entre los marcados)</span>
    <div class="pickgrid">${ctx.team.roster.filter((r) => r.status !== "congelado" && ctx.playersById[r.player]).map((r) => `<label class="opt"><input type="checkbox" name="pm" value="${esc(r.player)}"${flagged.has(r.player) ? " checked" : ""}><span>${esc(nameOf(ctx, r.player))}</span></label>`).join("")}</div>
    <label class="opt"><input type="checkbox" name="pub"${f.finance_public || ctx.team.finance_public ? " checked" : ""}><span>Cualquiera con el enlace del equipo puede ver las finanzas (si no, solo los jugadores aprobados en la app)</span></label>
    <button class="btn" type="submit">Guardar finanzas</button>
    <p class="hint">Lo ya pagado se conserva: sale de los pagos aprobados, no de este formulario.</p></form>`);
}
const gather = (fd, s) => { const l = fd.getAll(s + "_label"), c = fd.getAll(s + "_costo"), k = fd.getAll(s + "_k"); return l.map((label, i) => ({ label: label.trim(), costo: +c[i] || 0, k: k[i] })).filter((x) => x.label); };

// ---------- Acciones ----------
export function handle(ctx, a, el) {
  if (!a.startsWith("ta-") && !a.startsWith("submit-ta-")) return false;
  const [c, t] = c_t(ctx), fresh = (fn) => refreshThen(fn);
  if (a === "ta-settings") return settingsSheet(ctx), true;
  if (a === "ta-fromcrest") { const f = document.querySelector('#sheet input[name="crest"]').files[0], p = document.querySelector('#sheet input[name="primary"]');
    if (!f) say("Primero elige la imagen de tu escudo."); else dominant(f).then((x) => { if (x) p.value = x; else say("No encontré un color claro en el escudo. Elige uno a mano."); }); return true; }
  if (a === "submit-ta-settings") return guard(async () => {
    const f = new FormData(el), file = el.querySelector('input[name="crest"]').files[0];
    await api.updateTeam(c, t, { name: (f.get("nm") || "").trim(), comp: (f.get("comp") || "").trim(), format: +f.get("fmt") });
    if (file) await api.setCrest(c, await shrinkPng(file));
    if (ctx.live.can("themes") && f.get("primary")) await api.setTheme(c, t, { colors: themeFrom(f.get("primary")), card: f.get("card"), pattern: f.get("pattern") });
    close(); toast("Ajustes guardados"); reload();
  }), true;
  if (a === "ta-roster") return rosterSheet(ctx), true;
  if (a === "ta-pedit") return playerSheet(ctx, el.dataset.p), true;
  if (a === "submit-ta-pedit") return guard(async () => {
    const f = new FormData(el); await api.updatePlayer(c, t, el.dataset.p, { name: (f.get("nm") || "").trim(), number: (f.get("num") || "").trim(), pos: f.get("pos") });
    toast("Jugador actualizado"); await fresh(rosterSheet);
  }), true;
  if (a === "ta-pstat") return guard(async () => { await api.setPlayerStatus(c, t, el.dataset.p, el.dataset.v); await fresh(rosterSheet); }), true;
  if (a === "ta-cal") return calSheet(ctx), true;
  if (a === "ta-match") return matchSheet(ctx, el.dataset && el.dataset.m), true;
  if (a === "submit-ta-match") return guard(async () => {
    const f = new FormData(el), d = new Date(f.get("date")); if (isNaN(d)) throw new Error("Fecha no válida");
    await api.saveMatch(c, t, { id: el.dataset.m || undefined, rival: (f.get("rival") || "").trim(), date: d.toISOString(), jornada: (f.get("jornada") || "").trim(), venue: (f.get("venue") || "").trim(), home: f.get("home") !== "0" });
    toast("Partido guardado"); await fresh(calSheet);
  }), true;
  if (a === "ta-mdel") return guard(async () => { await api.deleteMatch(c, t, el.dataset.m); toast("Partido quitado"); await fresh(calSheet); }), true;
  if (a === "ta-fin") return finSheet(ctx), true;
  if (a === "ta-addrow") { document.getElementById("rows-" + el.dataset.s).insertAdjacentHTML("beforeend", rowHtml(el.dataset.s)); return true; }
  if (a === "submit-ta-fin") return guard(async () => {
    const f = new FormData(el);
    await api.saveFinance(c, t, { cuota: +f.get("cuota") || 0, cuotaNota: (f.get("nota") || "").trim(), liga: gather(f, "liga"), gastos: gather(f, "gastos"),
      multaTotal: +f.get("multa") || 0, multas: f.getAll("pm").map((player) => ({ player, why: "" })) });
    if (!!f.get("pub") !== !!ctx.team.finance_public) await api.setFinancePublic(c, t, !!f.get("pub"));
    close(); toast("Finanzas guardadas"); reload();
  }), true;
  return false;
}
