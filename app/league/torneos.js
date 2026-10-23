// Sección Torneos del panel de liga: torneos, equipos inscritos, calendario, resultados, tabla y goleo.
// Las reglas viven en la base de datos (permisos, plan, jornadas, marcador); aquí solo se muestran y se piden los datos.
import { openActas } from "./actas.js";
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { can as hasFeature } from "../plans.js";
import { card, chip, row, btn, empty, dtime, toast } from "../ui.js";
import * as sheet from "../sheet.js";
import { disputeFor } from "./sanciones.js";
import { standings, scorers, roundRobin, TIEBREAKERS } from "./standings.js";
import { FORMATS, GROUPS, hasGroups, hasKO, drawGroups, groupFixtures, groupTables, groupsDone, qualifiers, firstRound, nextRound, koRounds, roundName } from "./bracket.js";
import { tableHTML, bracketHTML, score } from "./views.js";
import { printDoc, standingsReport, scheduleReport, scorersReport } from "./printout.js";
import { toCSV } from "./report.js";
import { saveFile } from "../ui.js";

const ST = { draft: ["due", "Borrador"], published: ["ok", "Publicado"], paused: ["due", "En pausa"], finished: ["na", "Terminado"] };
const TABS = [["tabla", "Tabla"], ["calendario", "Calendario"], ["equipos", "Equipos"], ["goleo", "Goleo"], ["reglas", "Reglas"]];
const FMT = [5, 6, 7, 8, 9, 11];
const DEFAULT_TB = ["dg", "gf", "h2h", "fairplay"];
let sel = null, tab = "tabla", S = null, who = null, inLeague = null;   // torneo elegido, pestaña, y datos de la última pantalla (para las hojas)

const local = (iso) => { if (!iso) return ""; const d = new Date(iso), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const iso = (v) => (v ? new Date(v).toISOString() : null);
const tname = (id) => { const t = S && S.teams.find((x) => x.id === id); return t ? t.name : "—"; };

export async function render(ctx) {
  if (who !== ctx.user.id || inLeague !== ctx.id) { sel = null; tab = "tabla"; who = ctx.user.id; inLeague = ctx.id; }   // otra cuenta u otra liga: empezar de cero
  const list = await api.tournaments(ctx.id);
  const mayCreate = ctx.can("tournaments") && hasFeature(ctx.ent, "tournaments");
  if (sel && !list.some((t) => t.id === sel)) sel = null;
  if (!sel) {
    S = null;
    const head = card("Torneos", (list.length ? list.map((t) => row(t.name, [t.season, t.category, "Fútbol " + t.modality].filter(Boolean).join(" · "),
      chip(ST[t.status][1], ST[t.status][0]) + btn("Abrir", `data-la="open" data-id="${esc(t.id)}"`)) ).join("") : empty("Todavía no hay torneos."))
      + (mayCreate ? `<div class="row-acts">${btn("Nuevo torneo", 'data-la="new"')}</div>` : !hasFeature(ctx.ent, "tournaments") ? `<p class="hint">Tu plan no incluye torneos.</p>` : `<p class="hint">Tu cuenta no tiene permiso para crear torneos.</p>`));
    return head;
  }
  const t = list.find((x) => x.id === sel), data = await api.tournamentData(ctx.id, sel);
  data.adjust = await api.adjustments(ctx.id, sel);
  const links = ctx.can("tournaments") ? (await api.leagueLinks(ctx.id)).filter((x) => x.status === "approved") : [];
  S = { ctx, t, ...data, links };
  const act = hasFeature(ctx.ent, "tournaments");
  const may = { t: ctx.can("tournaments") && act, s: ctx.can("schedule") && hasFeature(ctx.ent, "schedule"), r: ctx.can("results") };
  const closed = t.status === "finished";
  const next = { draft: ["Publicar", "published"], published: ["Pausar", "paused"], paused: ["Reanudar", "published"], finished: ["Reabrir", "published"] }[t.status];
  const top = card("", `<div class="row-acts"><button type="button" class="btn sm ghost" data-la="back">← Torneos</button></div>
    <div class="cl-who"><b>${esc(t.name)}</b><span>${chip(ST[t.status][1], ST[t.status][0])}</span></div>
    <p class="hint">${esc([t.season, t.category, "Fútbol " + t.modality, t.day && t.day + (t.shift ? " " + t.shift : "")].filter(Boolean).join(" · "))}</p>
    ${may.t ? `<div class="row-acts">${btn(next[0], `data-la="status" data-v="${next[1]}"`)}${t.status !== "finished" ? btn("Terminar", 'data-la="status" data-v="finished"', "ghost") + btn("Editar", 'data-la="edit"', "ghost") : ""}</div>` : ""}
    <div class="row-acts">${btn("Imprimir / PDF", 'data-la="print"', "ghost")}${btn("Exportar CSV", 'data-la="csvt"', "ghost")}</div>`);
  const tabs = `<div class="seg-tabs" role="tablist">${TABS.map(([k, v]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-la="tab" data-v="${k}">${v}</button>`).join("")}</div>`;
  let body = "";
  if (tab === "tabla") body = tabla(t, data);
  else if (tab === "calendario") body = calendario(t, data, may, closed);
  else if (tab === "equipos") body = equipos(t, data, may, closed, links);
  else if (tab === "goleo") body = goleo(data);
  else body = reglas(t);
  return top + tabs + body;
}

function tabla(t, d) {
  if (!d.teams.length) return card("Posiciones", empty("Inscribe equipos para ver la tabla."));
  const fmt = t.format || "league", hint = `<p class="hint">Desempate: ${esc((t.tiebreakers || []).map((c) => TIEBREAKERS[c]).filter(Boolean).join(" → ") || "orden alfabético")}. Solo cuentan los partidos con resultado.</p>`;
  let out = "";
  if (fmt === "league") out = card("Posiciones", tableHTML(standings(t, d.teams, d.matches.filter((m) => (m.stage || "league") === "league"), d.events, d.adjust || [])) + hint);
  if (hasGroups(t)) {
    const gt = groupTables(t, d.teams, d.matches, d.events, d.adjust || []);
    out += gt.length ? gt.map((g) => card("Grupo " + g.group, tableHTML(g.rows, { advance: fmt === "groups_knockout" ? t.advance : 0 }))).join("") + (fmt === "groups_knockout" ? `<p class="hint">Marcados: los ${t.advance} primeros de cada grupo pasan a la eliminatoria.</p>` : "") + hint
      : card("Grupos", empty("Asigna un grupo a cada equipo en la pestaña Equipos."));
  }
  if (hasKO(t)) out += card("Eliminatoria", bracketHTML(d.matches, tname));
  return out;
}

function calendario(t, d, may, closed) {
  // Se agrupa por jornada; la eliminatoria va al final, ronda por ronda.
  const by = {}, label = {};
  d.matches.forEach((m) => { const k = m.stage === "knockout" ? "~" + String(m.ko_round).padStart(2, "0") : m.round || "Sin jornada"; (by[k] ||= []).push(m); label[k] = m.stage === "knockout" ? m.round || "Eliminatoria" : k; });
  const rounds = Object.keys(by).sort((a, b) => (a.startsWith("~") - b.startsWith("~")) || a.localeCompare(b, "es", { numeric: true }));
  const MS = { scheduled: "", played: "", postponed: chip("Pospuesto", "due"), canceled: chip("Cancelado", "na") };
  const mrow = (m) => row(`${m.stage === "group" ? m.group_label + " · " : ""}${tname(m.home_id)} ${score(m)} ${tname(m.away_id)}`,
    [m.starts_at ? dtime(m.starts_at) : "Sin fecha", m.venue, m.notes].filter(Boolean).join(" · "),
    MS[m.status] + (S && S.ctx.can("sanctions") ? btn("Protesta", `data-la="dispute" data-id="${esc(m.id)}"`, "ghost") : "") + (!closed && may.r && m.status !== "canceled" ? btn(m.status === "played" ? "Corregir" : "Resultado", `data-la="result" data-id="${esc(m.id)}"`) : "")
    + (!closed && may.r && m.status !== "played" && m.status !== "canceled" && S && hasFeature(S.ctx.ent, "actas") ? btn("Acta", `data-la="acta" data-id="${esc(m.id)}"`, "ghost") : "") + (!closed && may.s && m.status !== "played" ? btn("Editar", `data-la="match" data-id="${esc(m.id)}"`, "ghost") : ""));
  const act = d.teams.filter((x) => x.status === "active"), fmt = t.format || "league", b = [];
  if (!closed && may.s && act.length >= 2) {
    if (fmt !== "knockout") b.push(btn("Agregar partido", 'data-la="match"'));
    if (fmt === "league" && !d.matches.length) b.push(btn("Generar calendario", 'data-la="gen"', "ghost"));
    if (hasGroups(t) && !d.matches.some((m) => m.stage === "group")) b.push(btn("Generar partidos de grupos", 'data-la="gen"', "ghost"));
    if (hasKO(t) && !d.matches.some((m) => m.stage === "knockout") && (fmt === "knockout" || groupsDone(d.matches))) b.push(btn("Armar eliminatoria", 'data-la="genko"', "ghost"));
    const nx = nextRound(d.matches); if (nx.length) b.push(btn("Armar " + roundName(nx.length), 'data-la="nextko"'));
  }
  const tools = b.length ? `<div class="row-acts">${b.join("")}</div>` : "";
  const hintGroups = hasGroups(t) && act.some((x) => !x.group_label) ? `<p class="hint">Antes de generar los partidos de grupos, asigna un grupo a cada equipo (pestaña Equipos).</p>` : "";
  return card("Calendario", (rounds.length ? rounds.map((r) => `<h3 class="rnd">${esc(label[r])}</h3>${by[r].map(mrow).join("")}`).join("") : empty(d.teams.length < 2 ? "Inscribe al menos dos equipos para armar el calendario." : "Todavía no hay partidos.")) + hintGroups + tools);
}

function gruposCard(t, d, may, closed) {
  if (!hasGroups(t)) return "";
  const act = d.teams.filter((x) => x.status === "active"), locked = d.matches.some((m) => m.stage === "group"), opts = GROUPS.slice(0, t.groups).split("");
  if (!may.t || closed || locked) return card("Grupos", act.map((x) => row(x.name, "", chip(x.group_label ? "Grupo " + x.group_label : "Sin grupo", x.group_label ? "ok" : "due"))).join("") + (locked ? `<p class="hint">Ya hay partidos de grupos: los grupos quedan fijos.</p>` : ""));
  return card("Grupos", `<form data-lf="groups" class="fld">${act.map((x) => `<div class="grp-sel"><span>${esc(x.name)}</span><select name="g_${esc(x.id)}" aria-label="Grupo de ${esc(x.name)}"><option value="">—</option>${opts.map((g) => `<option${g === x.group_label ? " selected" : ""}>${g}</option>`).join("")}</select></div>`).join("")}
    <div class="row-acts">${btn("Sortear grupos", 'data-la="drawgroups"', "ghost")}<button class="btn" type="submit">Guardar grupos</button></div></form>
    <p class="hint">${t.groups} grupos. El sorteo reparte en orden de inscripción, de forma equilibrada; puedes ajustar a mano antes de guardar.</p>`);
}

function equipos(t, d, may, closed, links) {
  const act = d.teams.filter((x) => x.status === "active"), out = d.teams.filter((x) => x.status !== "active");
  const free = links.filter((l) => !act.some((x) => x.link_id === l.id));
  return card("Equipos inscritos", (act.length ? act.map((x) => row(x.name, [x.link_id ? "Equipo de la app" : "Equipo externo", x.contact].filter(Boolean).join(" · "),
      !closed && may.t ? btn("Quitar", `data-la="rm" data-id="${esc(x.id)}"`, "ghost") : "")).join("") : empty("Todavía no hay equipos inscritos."))
    + (out.length ? `<details class="cl-list"><summary>Retirados (${out.length})</summary>${out.map((x) => `<p>${esc(x.name)}</p>`).join("")}</details>` : "")
    + (!closed && may.t ? `<form data-lf="addteam" class="fld"><h3>Inscribir equipo</h3>
        ${free.length ? `<label>Equipo vinculado a la liga<select name="link"><option value="">— Otro equipo (escribir nombre) —</option>${free.map((l) => `<option value="${esc(l.id)}">${esc(l.team_name)}</option>`).join("")}</select></label>` : ""}
        <label>Nombre<input name="name" maxlength="60" placeholder="Solo si no eliges uno vinculado"></label>
        <label>Contacto del delegado (privado)<input name="contact" maxlength="120" placeholder="Teléfono o correo"></label>
        <button class="btn" type="submit">Inscribir</button></form>
        ${t.fee != null ? `<p class="hint">Cuota de inscripción: $${esc(t.fee)}${t.fee_note ? " — " + esc(t.fee_note) : ""}. El cobro y su seguimiento llegan con las finanzas de la liga.</p>` : ""}` : "")) + gruposCard(t, d, may, closed);
}

function goleo(d) {
  const sc = scorers(d.teams, d.matches, d.events);
  return card("Goleo", sc.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr></thead><tbody>${sc.map((s, i) => `<tr><td>${i + 1}</td><td class="nm">${esc(s.player)}</td><td>${esc(s.team)}</td><td><b>${s.goals}</b></td></tr>`).join("")}</tbody></table></div>`
    : empty("Aún no hay goles registrados."));
}

function reglas(t) {
  const fmt = t.format || "league";
  return card("Reglas y puntos", `<p>Formato: <b>${esc(FORMATS[fmt])}</b>${hasGroups(t) ? ` · ${t.groups} grupos` : ""}${fmt === "groups_knockout" ? ` · pasan ${t.advance} por grupo` : ""}${hasKO(t) ? " · en eliminatoria, los empates se definen por penales" : ""}</p>
    <p>Victoria ${t.pts_win} · Empate ${t.pts_draw} · Derrota ${t.pts_loss}</p>
    <p class="hint">Orden de desempate: ${esc((t.tiebreakers || []).map((c) => TIEBREAKERS[c]).filter(Boolean).join(" → ") || "orden alfabético")}</p>
    ${t.rules ? `<p class="rules">${esc(t.rules).replace(/\n/g, "<br>")}</p>` : empty("Sin reglamento escrito.")}`);
}

// ---------- Hojas ----------
function tournamentSheet(t) {
  const x = t || { modality: 7, pts_win: 3, pts_draw: 1, pts_loss: 0, tiebreakers: DEFAULT_TB };
  const tb = x.tiebreakers || [];
  const opt = (v, cur) => `<option value="${v}"${v === cur ? " selected" : ""}>${esc(TIEBREAKERS[v] || "— Ninguno —")}</option>`;
  sheet.open(t ? "Editar torneo" : "Nuevo torneo", "", `<form data-tform="${t ? "edit" : "new"}" class="fld">
    <label>Nombre<input name="name" required minlength="2" maxlength="80" value="${esc(x.name || "")}"></label>
    <div class="two"><label>Temporada<input name="season" maxlength="40" value="${esc(x.season || "")}" placeholder="Otoño 2026"></label><label>Categoría<input name="category" maxlength="40" value="${esc(x.category || "")}" placeholder="Libre"></label></div>
    <div class="two"><label>Modalidad<select name="modality">${FMT.map((f) => `<option value="${f}"${f === x.modality ? " selected" : ""}>Fútbol ${f}</option>`).join("")}</select></label><label>Cuota de inscripción<input name="fee" type="number" min="0" max="100000" step="0.01" value="${x.fee ?? ""}"></label></div>
    <div class="two"><label>Día<input name="day" maxlength="20" value="${esc(x.day || "")}" placeholder="Domingo"></label><label>Turno<input name="shift" maxlength="20" value="${esc(x.shift || "")}" placeholder="Mañana"></label></div>
    <label>Qué cubre la cuota<input name="fee_note" maxlength="200" value="${esc(x.fee_note || "")}"></label>
    <div class="three"><label>Formato<select name="format">${Object.entries(FORMATS).map(([k, v]) => `<option value="${k}"${k === (x.format || "league") ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Grupos<input name="groups" type="number" min="2" max="8" value="${x.groups || 2}"></label><label>Pasan por grupo<input name="advance" type="number" min="1" max="4" value="${x.advance || 2}"></label></div>
    <p class="hint">Grupos y pasan por grupo solo aplican si el formato los usa. El formato ya no se cambia cuando hay partidos.</p>
    <div class="three"><label>Pts. victoria<input name="pts_win" type="number" min="0" max="10" value="${x.pts_win}"></label><label>Pts. empate<input name="pts_draw" type="number" min="0" max="10" value="${x.pts_draw}"></label><label>Pts. derrota<input name="pts_loss" type="number" min="0" max="10" value="${x.pts_loss}"></label></div>
    ${[0, 1, 2, 3].map((i) => `<label>Desempate ${i + 1}<select name="tb${i}">${["", "dg", "gf", "wins", "gc_low", "h2h", "fairplay"].map((v) => opt(v, tb[i] || "")).join("")}</select></label>`).join("")}
    <label>Reglamento<textarea name="rules" rows="5" maxlength="8000">${esc(x.rules || "")}</textarea></label>
    <button class="btn" type="submit">Guardar</button></form>`);
}

function matchSheet(m) {
  const act = S.teams.filter((x) => x.status === "active"), x = m || {};
  const sel2 = (name, cur) => `<select name="${name}" required><option value="">Elige…</option>${act.map((a) => `<option value="${esc(a.id)}"${a.id === cur ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`;
  sheet.open(m ? "Editar partido" : "Agregar partido", S.t.name, `<form data-tform="match" class="fld"><input type="hidden" name="id" value="${esc(x.id || "")}">
    <div class="two"><label>Local${sel2("home", x.home_id)}</label><label>Visitante${sel2("away", x.away_id)}</label></div>
    <div class="two"><label>Jornada<input name="round" maxlength="20" value="${esc(x.round || "")}" placeholder="J1"></label><label>Cancha<input name="venue" maxlength="40" value="${esc(x.venue || "")}"></label></div>
    <label>Fecha y hora<input name="starts_at" type="datetime-local" value="${local(x.starts_at)}"></label>
    <label>Estado<select name="status">${[["scheduled", "Programado"], ["postponed", "Pospuesto"], ["canceled", "Cancelado"]].map(([v, l]) => `<option value="${v}"${v === (x.status || "scheduled") ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label>Nota (incidencias, motivo)<input name="notes" maxlength="500" value="${esc(x.notes || "")}"></label>
    <button class="btn" type="submit">Guardar</button>${m ? `<button class="btn ghost" type="button" data-tj="delmatch" data-id="${esc(m.id)}">Eliminar partido</button>` : ""}</form>`);
}

const evRow = (m, e = {}) => `<div class="ev"><select name="ev_team" aria-label="Equipo"><option value="${esc(m.home_id)}"${e.team_id === m.home_id ? " selected" : ""}>${esc(tname(m.home_id))}</option><option value="${esc(m.away_id)}"${e.team_id === m.away_id ? " selected" : ""}>${esc(tname(m.away_id))}</option></select>
  <input name="ev_player" maxlength="60" placeholder="Jugador" aria-label="Jugador" value="${esc(e.player || "")}">
  <select name="ev_kind" aria-label="Tipo">${[["goal", "Gol"], ["own_goal", "Autogol"], ["yellow", "Amarilla"], ["red", "Roja"]].map(([v, l]) => `<option value="${v}"${v === (e.kind || "goal") ? " selected" : ""}>${l}</option>`).join("")}</select></div>`;
function resultSheet(m) {
  const evs = S.events.filter((e) => e.match_id === m.id);
  sheet.open(m.status === "played" ? "Corregir resultado" : "Capturar resultado", `${tname(m.home_id)} vs ${tname(m.away_id)}`, `<form data-tform="result" class="fld"><input type="hidden" name="id" value="${esc(m.id)}">
    <div class="two"><label>${esc(tname(m.home_id))}<input name="hg" type="number" min="0" max="99" required value="${m.home_goals ?? ""}"></label><label>${esc(tname(m.away_id))}<input name="ag" type="number" min="0" max="99" required value="${m.away_goals ?? ""}"></label></div>
    ${m.stage === "knockout" ? `<div class="two"><label>Penales ${esc(tname(m.home_id))}<input name="hp" type="number" min="0" max="99" value="${m.home_pens ?? ""}"></label><label>Penales ${esc(tname(m.away_id))}<input name="ap" type="number" min="0" max="99" value="${m.away_pens ?? ""}"></label></div><p class="hint">Eliminatoria: si empatan, escribe los penales (no pueden quedar iguales).</p>` : ""}
    <h3>Goles y tarjetas</h3><div id="evs">${evs.map((e) => evRow(m, e)).join("")}</div>
    <button type="button" class="btn sm ghost" data-tj="evadd" data-id="${esc(m.id)}">+ Agregar gol o tarjeta</button>
    <label>Nota<input name="notes" maxlength="500" value="${esc(m.notes || "")}"></label>
    <p class="hint">Los goles de los jugadores no pueden superar el marcador. Cada cambio queda en la bitácora con el valor anterior.</p>
    <button class="btn" type="submit">Guardar resultado</button>${m.status === "played" ? `<button class="btn ghost" type="button" data-tj="clear" data-id="${esc(m.id)}">Borrar resultado</button>` : ""}</form>`);
}

function genSheet() {
  const grp = hasGroups(S.t);
  sheet.open(grp ? "Generar partidos de grupos" : "Generar calendario", S.t.name, `<form data-tform="gen" class="fld">
    <p>${grp ? "Se crean los partidos de todos contra todos dentro de cada grupo." : `Se crean los partidos de todos contra todos con los ${S.teams.filter((x) => x.status === "active").length} equipos inscritos.`} Después puedes ajustar fechas y canchas uno por uno.</p>
    <label>Vueltas<select name="v"><option value="1">Solo ida</option><option value="2">Ida y vuelta</option></select></label>
    <label>Fecha de la primera jornada (opcional)<input name="start" type="datetime-local"></label>
    <label>Días entre jornadas<input name="gap" type="number" min="1" max="60" value="7"></label>
    <button class="btn" type="submit">Generar</button></form>`);
}

function koSheet(next) {
  const fmt = S.t.format, act = S.teams.filter((x) => x.status === "active");
  let pairs, desc;
  try {
    if (next) { pairs = nextRound(S.matches); desc = "Se cruzan los ganadores de la ronda anterior."; }
    else if (fmt === "groups_knockout") { const q = qualifiers(groupTables(S.t, S.teams, S.matches, S.events, S.adjust || []), S.t.advance); pairs = firstRound(q.map((x) => x.id)); desc = `Pasan ${S.t.advance} por grupo; los primeros enfrentan a los segundos de otro grupo.`; }
    else { pairs = null; desc = `Con los ${act.length} equipos inscritos, en orden de inscripción (1 contra el último, etc.) o por sorteo.`; if (![2, 4, 8, 16, 32].includes(act.length)) throw new Error("Para la eliminatoria se necesitan 2, 4, 8, 16 o 32 equipos"); }
  } catch (e) { return toast(e.message.includes("2, 4, 8") ? "Para la eliminatoria se necesitan 2, 4, 8, 16 o 32 equipos." : e.message, true); }
  const preview = pairs ? pairs.map((p) => `<p>${esc(tname(p.home))} vs ${esc(tname(p.away))}</p>`).join("") : "";
  sheet.open(next ? "Armar " + roundName(pairs.length) : "Armar eliminatoria", S.t.name, `<form data-tform="ko" class="fld"><input type="hidden" name="next" value="${next ? 1 : ""}"><p>${desc}</p>${preview}
    ${!next && fmt === "knockout" ? `<label class="opt"><input type="checkbox" name="shuffle"><span>Sortear los cruces</span></label>` : ""}
    <label>Fecha y hora (opcional)<input name="start" type="datetime-local"></label><button class="btn" type="submit">Crear partidos</button></form>`);
}

// ---------- Reportes ----------
async function printTournament(what) {
  const brand = await api.leagueBrand(S.ctx.id).catch(() => ({})), parts = { tabla: ["Tabla", standingsReport(S.t, S)], calendario: ["Calendario", scheduleReport(S)], goleo: ["Goleo", scorersReport(S)] };
  const pick = what === "todo" ? Object.values(parts) : [parts[what]], sub = [S.t.season, S.t.category].filter(Boolean).join(" · ");
  sheet.close(); await printDoc({ league: S.ctx.l.name, title: (what === "todo" ? "Torneo " : pick[0][0] + " · ") + S.t.name, sub, logo: brand.logo, body: pick.map(([h, b]) => (what === "todo" ? `<h2>${esc(h)}</h2>` : "") + b).join("") });
}
function exportTournament(what) {
  const slug = S.t.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (what === "tabla") {
    const rows = hasGroups(S.t) ? groupTables(S.t, S.teams, S.matches, S.events, S.adjust || []).flatMap((g) => g.rows.map((r) => ({ ...r, grupo: g.group }))) : standings(S.t, S.teams, S.matches.filter((m) => (m.stage || "league") === "league"), S.events, S.adjust || []);
    saveFile(`tabla-${slug}.csv`, toCSV([...(hasGroups(S.t) ? [["grupo", "Grupo"]] : []), ["pos", "Pos"], ["name", "Equipo"], ["pj", "PJ"], ["g", "G"], ["e", "E"], ["p", "P"], ["gf", "GF"], ["gc", "GC"], ["dg", "DG"], ["pts", "Pts"]], rows));
  } else if (what === "calendario") {
    saveFile(`calendario-${slug}.csv`, toCSV([[(m) => (m.group_label ? m.group_label + " · " : "") + (m.round || ""), "Jornada"], [(m) => m.starts_at || "", "Fecha"], [(m) => tname(m.home_id), "Local"], [(m) => (m.status === "played" ? m.home_goals : ""), "Goles local"], [(m) => (m.status === "played" ? m.away_goals : ""), "Goles visitante"], [(m) => (m.home_pens != null ? m.home_pens + "-" + m.away_pens : ""), "Penales"], [(m) => tname(m.away_id), "Visitante"], ["venue", "Cancha"], ["status", "Estado"]], S.matches));
  } else saveFile(`goleo-${slug}.csv`, toCSV([["player", "Jugador"], ["team", "Equipo"], ["goals", "Goles"]], scorers(S.teams, S.matches, S.events)));
  sheet.close(); toast("Archivo generado");
}

// ---------- Acciones ----------
const done = (ctx) => (ctx.reload(), undefined);
const find = (id) => S && S.matches.find((m) => m.id === id);
export const actions = {
  async open(ctx, el) { sel = el.dataset.id; tab = "tabla"; done(ctx); },
  async back(ctx) { sel = null; done(ctx); },
  async tab(ctx, el) { tab = el.dataset.v; done(ctx); },
  async new() { tournamentSheet(null); },
  async edit() { tournamentSheet(S.t); },
  async status(ctx, el) {
    if (el.dataset.v === "finished" && !confirm("¿Terminar el torneo? Ya no se podrán cambiar partidos ni resultados (puedes reabrirlo después).")) return;
    await api.setTournamentStatus(ctx.id, sel, el.dataset.v); toast("Torneo actualizado"); done(ctx);
  },
  async match(ctx, el) { matchSheet(el.dataset.id ? find(el.dataset.id) : null); },
  async result(ctx, el) { resultSheet(find(el.dataset.id)); },
  async acta(ctx, el) { const m = find(el.dataset.id); await openActas(ctx, m, { id: m.home_id, name: tname(m.home_id) }, { id: m.away_id, name: tname(m.away_id) }); },
  async gen() { genSheet(); },
  async print() {
    sheet.open("Imprimir o guardar como PDF", S.t.name, `<p>Elige qué imprimir. En el diálogo de impresión puedes elegir «Guardar como PDF».</p><div class="row-acts">${[["tabla", "Tabla"], ["calendario", "Calendario"], ["goleo", "Goleo"], ["todo", "Todo"]].map(([k, v]) => btn(v, `data-tj="pr" data-v="${k}"`)).join("")}</div>`);
  },
  async csvt() {
    sheet.open("Exportar a CSV (Excel)", S.t.name, `<div class="row-acts">${[["tabla", "Tabla"], ["calendario", "Calendario"], ["goleo", "Goleo"]].map(([k, v]) => btn(v, `data-tj="csv" data-v="${k}"`)).join("")}</div>`);
  },
  async genko() { koSheet(false); },
  async nextko() { koSheet(true); },
  async drawgroups() {
    const sels = [...document.querySelectorAll("form[data-lf=groups] select")], ids = sels.map((x) => x.name.slice(2)), shuffled = ids.slice().sort(() => Math.random() - 0.5), g = drawGroups(shuffled, S.t.groups);
    sels.forEach((x) => (x.value = g[x.name.slice(2)])); toast("Grupos sorteados: revisa y guarda");
  },
  async dispute(ctx, el) { disputeFor(ctx, find(el.dataset.id), S.teams); },
  async rm(ctx, el) {
    if (!confirm("¿Quitar este equipo del torneo? Si ya jugó partidos se conserva su historial y se cancelan los pendientes; si no, se borra con su calendario.")) return;
    await api.removeTournamentTeam(ctx.id, el.dataset.id); toast("Equipo quitado"); done(ctx);
  },
};
export const forms = {
  async groups(ctx, f, fd) {
    const ch = S.teams.filter((x) => x.status === "active" && (fd.get("g_" + x.id) || null) !== (x.group_label || null));
    for (const x of ch) await api.setTeamGroup(ctx.id, x.id, fd.get("g_" + x.id) || null);
    toast(ch.length ? "Grupos guardados" : "Sin cambios"); done(ctx);
  },
  async addteam(ctx, f, fd) {
    await api.addTournamentTeam(ctx.id, sel, { name: (fd.get("name") || "").trim(), link: fd.get("link") || null, contact: (fd.get("contact") || "").trim() });
    toast("Equipo inscrito"); done(ctx);
  },
};

// Las hojas viven fuera del panel: se escuchan una sola vez.
let wired = false;
export function wireSheets(getCtx) {
  if (wired) return; wired = true;
  const sh = document.getElementById("sheet");
  sh.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tj]"); if (!t) return;
    const ctx = getCtx(), a = t.dataset.tj;
    if (a === "evadd") { const m = find(t.dataset.id); sh.querySelector("#evs").insertAdjacentHTML("beforeend", evRow(m)); return; }
    if (a === "pr") return sheet.guard(() => printTournament(t.dataset.v));
    if (a === "csv") return exportTournament(t.dataset.v);
    sheet.guard(async () => {
      if (a === "delmatch") { if (!confirm("¿Eliminar este partido?")) return; await api.leagueDeleteMatch(ctx.id, t.dataset.id); }
      else if (a === "clear") { if (!confirm("¿Borrar el resultado? El partido vuelve a quedar pendiente y se quitan sus goles y tarjetas.")) return; await api.clearResult(ctx.id, t.dataset.id); }
      sheet.close(); toast("Listo"); ctx.reload();
    });
  });
  sh.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-tform]"); if (!f) return;
    e.preventDefault(); const ctx = getCtx(), fd = new FormData(f), k = f.dataset.tform;
    sheet.guard(async () => {
      if (k === "new" || k === "edit") {
        const body = { name: fd.get("name").trim(), season: fd.get("season").trim(), category: fd.get("category").trim(), modality: +fd.get("modality"), day: fd.get("day").trim(), shift: fd.get("shift").trim(),
          fee: fd.get("fee") === "" ? null : +fd.get("fee"), fee_note: fd.get("fee_note").trim(), rules: fd.get("rules"), pts_win: +fd.get("pts_win"), pts_draw: +fd.get("pts_draw"), pts_loss: +fd.get("pts_loss"),
          tiebreakers: [...new Set([0, 1, 2, 3].map((i) => fd.get("tb" + i)).filter(Boolean))], format: fd.get("format"), groups: +fd.get("groups") || 2, advance: +fd.get("advance") || 2 };
        if (k === "new") { sel = await api.createTournament(ctx.id, body); tab = "equipos"; } else await api.updateTournament(ctx.id, sel, body);
      } else if (k === "match") {
        const m = { id: fd.get("id") || undefined, tournament: sel, home: fd.get("home"), away: fd.get("away"), round: fd.get("round").trim(), venue: fd.get("venue").trim(), starts_at: iso(fd.get("starts_at")), status: fd.get("status"), notes: fd.get("notes").trim() };
        await api.leagueSaveMatch(ctx.id, m);
      } else if (k === "result") {
        const rows = [...f.querySelectorAll(".ev")].map((r) => ({ team: r.querySelector("[name=ev_team]").value, player: r.querySelector("[name=ev_player]").value.trim(), kind: r.querySelector("[name=ev_kind]").value })).filter((x) => x.player);
        const pen = (k) => (fd.get(k) === null || fd.get(k) === "" ? null : +fd.get(k));
        await api.recordResult(ctx.id, fd.get("id"), +fd.get("hg"), +fd.get("ag"), rows, fd.get("notes").trim(), pen("hp"), pen("ap"));
      } else if (k === "ko") {
        const start = fd.get("start") ? new Date(fd.get("start")).toISOString() : null; let pairs;
        if (fd.get("next")) pairs = nextRound(S.matches);
        else if (S.t.format === "groups_knockout") pairs = firstRound(qualifiers(groupTables(S.t, S.teams, S.matches, S.events, S.adjust || []), S.t.advance).map((x) => x.id));
        else { let ids = S.teams.filter((x) => x.status === "active").map((x) => x.id); if (fd.get("shuffle")) ids = ids.sort(() => Math.random() - 0.5); pairs = firstRound(ids); }
        await api.leagueCreateMatches(ctx.id, sel, pairs.map((p) => ({ ...p, stage: "knockout", round: roundName(pairs.length), starts_at: start }))); tab = "calendario";
      } else if (k === "gen") {
        const act = S.teams.filter((x) => x.status === "active"), start = fd.get("start") ? new Date(fd.get("start")) : null, gap = +fd.get("gap") || 7;
        if (hasGroups(S.t) && act.some((x) => !x.group_label)) throw new Error("Asigna un grupo a cada equipo antes de generar los partidos.");
        const base = hasGroups(S.t) ? groupFixtures(act, +fd.get("v")) : roundRobin(act.map((x) => x.id), +fd.get("v"));
        const ms = base.map((m) => ({ ...m, starts_at: start ? new Date(start.getTime() + (+m.round.slice(1) - 1) * gap * 864e5).toISOString() : null }));
        await api.leagueCreateMatches(ctx.id, sel, ms); tab = "calendario";
      }
      sheet.close(); toast("Guardado"); ctx.reload();
    });
  });
}
