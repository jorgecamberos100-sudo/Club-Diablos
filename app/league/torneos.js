// Sección Torneos del panel de liga: torneos, equipos inscritos, calendario, resultados, tabla y goleo.
// Las reglas viven en la base de datos (permisos, plan, jornadas, marcador); aquí solo se muestran y se piden los datos.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { can as hasFeature } from "../plans.js";
import { card, chip, row, btn, empty, dtime, toast } from "../ui.js";
import * as sheet from "../sheet.js";
import { disputeFor } from "./sanciones.js";
import { standings, scorers, roundRobin, TIEBREAKERS } from "./standings.js";

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
    ${may.t ? `<div class="row-acts">${btn(next[0], `data-la="status" data-v="${next[1]}"`)}${t.status !== "finished" ? btn("Terminar", 'data-la="status" data-v="finished"', "ghost") + btn("Editar", 'data-la="edit"', "ghost") : ""}</div>` : ""}`);
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
  const rows = standings(t, d.teams, d.matches, d.events, d.adjust || []);
  if (!d.teams.length) return card("Posiciones", empty("Inscribe equipos para ver la tabla."));
  return card("Posiciones", `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Equipo</th><th title="Jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th><th title="Perdidos">P</th><th title="Goles a favor">GF</th><th title="Goles en contra">GC</th><th title="Diferencia">DG</th><th title="Puntos">Pts</th></tr></thead><tbody>${rows.map((r) =>
    `<tr><td>${r.pos}</td><td class="nm">${esc(r.name)}${r.withdrawn ? ' <small>(retirado)</small>' : ""}</td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.gf}</td><td>${r.gc}</td><td>${r.dg > 0 ? "+" : ""}${r.dg}</td><td><b>${r.pts}</b>${r.adj ? ` <small title="Descuento por sanción">(${r.adj})</small>` : ""}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">Desempate: ${esc((t.tiebreakers || []).map((c) => TIEBREAKERS[c]).filter(Boolean).join(" → ") || "orden alfabético")}. Solo cuentan los partidos con resultado.</p>`);
}

function calendario(t, d, may, closed) {
  const by = {}; d.matches.forEach((m) => (by[m.round || "Sin jornada"] ||= []).push(m));
  const rounds = Object.keys(by).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const MS = { scheduled: "", played: "", postponed: chip("Pospuesto", "due"), canceled: chip("Cancelado", "na") };
  const mrow = (m) => row(`${tname(m.home_id)} ${m.status === "played" ? m.home_goals + " - " + m.away_goals : "vs"} ${tname(m.away_id)}`,
    [m.starts_at ? dtime(m.starts_at) : "Sin fecha", m.venue, m.notes].filter(Boolean).join(" · "),
    MS[m.status] + (S && S.ctx.can("sanctions") ? btn("Protesta", `data-la="dispute" data-id="${esc(m.id)}"`, "ghost") : "") + (!closed && may.r && m.status !== "canceled" ? btn(m.status === "played" ? "Corregir" : "Resultado", `data-la="result" data-id="${esc(m.id)}"`) : "")
    + (!closed && may.s && m.status !== "played" ? btn("Editar", `data-la="match" data-id="${esc(m.id)}"`, "ghost") : ""));
  const tools = !closed && may.s && d.teams.filter((x) => x.status === "active").length >= 2
    ? `<div class="row-acts">${btn("Agregar partido", 'data-la="match"')}${!d.matches.length ? btn("Generar calendario", 'data-la="gen"', "ghost") : ""}</div>` : "";
  return card("Calendario", (rounds.length ? rounds.map((r) => `<h3 class="rnd">${esc(r)}</h3>${by[r].map(mrow).join("")}`).join("") : empty(d.teams.length < 2 ? "Inscribe al menos dos equipos para armar el calendario." : "Todavía no hay partidos.")) + tools);
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
        ${t.fee != null ? `<p class="hint">Cuota de inscripción: $${esc(t.fee)}${t.fee_note ? " — " + esc(t.fee_note) : ""}. El cobro y su seguimiento llegan con las finanzas de la liga.</p>` : ""}` : ""));
}

function goleo(d) {
  const sc = scorers(d.teams, d.matches, d.events);
  return card("Goleo", sc.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr></thead><tbody>${sc.map((s, i) => `<tr><td>${i + 1}</td><td class="nm">${esc(s.player)}</td><td>${esc(s.team)}</td><td><b>${s.goals}</b></td></tr>`).join("")}</tbody></table></div>`
    : empty("Aún no hay goles registrados."));
}

function reglas(t) {
  return card("Reglas y puntos", `<p>Victoria ${t.pts_win} · Empate ${t.pts_draw} · Derrota ${t.pts_loss}</p>
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
    <h3>Goles y tarjetas</h3><div id="evs">${evs.map((e) => evRow(m, e)).join("")}</div>
    <button type="button" class="btn sm ghost" data-tj="evadd" data-id="${esc(m.id)}">+ Agregar gol o tarjeta</button>
    <label>Nota<input name="notes" maxlength="500" value="${esc(m.notes || "")}"></label>
    <p class="hint">Los goles de los jugadores no pueden superar el marcador. Cada cambio queda en la bitácora con el valor anterior.</p>
    <button class="btn" type="submit">Guardar resultado</button>${m.status === "played" ? `<button class="btn ghost" type="button" data-tj="clear" data-id="${esc(m.id)}">Borrar resultado</button>` : ""}</form>`);
}

function genSheet() {
  sheet.open("Generar calendario", S.t.name, `<form data-tform="gen" class="fld">
    <p>Se crean los partidos de todos contra todos con los ${S.teams.filter((x) => x.status === "active").length} equipos inscritos. Después puedes ajustar fechas y canchas uno por uno.</p>
    <label>Vueltas<select name="v"><option value="1">Solo ida</option><option value="2">Ida y vuelta</option></select></label>
    <label>Fecha de la primera jornada (opcional)<input name="start" type="datetime-local"></label>
    <label>Días entre jornadas<input name="gap" type="number" min="1" max="60" value="7"></label>
    <button class="btn" type="submit">Generar</button></form>`);
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
  async gen() { genSheet(); },
  async dispute(ctx, el) { disputeFor(ctx, find(el.dataset.id), S.teams); },
  async rm(ctx, el) {
    if (!confirm("¿Quitar este equipo del torneo? Si ya jugó partidos se conserva su historial y se cancelan los pendientes; si no, se borra con su calendario.")) return;
    await api.removeTournamentTeam(ctx.id, el.dataset.id); toast("Equipo quitado"); done(ctx);
  },
};
export const forms = {
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
          tiebreakers: [...new Set([0, 1, 2, 3].map((i) => fd.get("tb" + i)).filter(Boolean))] };
        if (k === "new") { sel = await api.createTournament(ctx.id, body); tab = "equipos"; } else await api.updateTournament(ctx.id, sel, body);
      } else if (k === "match") {
        const m = { id: fd.get("id") || undefined, tournament: sel, home: fd.get("home"), away: fd.get("away"), round: fd.get("round").trim(), venue: fd.get("venue").trim(), starts_at: iso(fd.get("starts_at")), status: fd.get("status"), notes: fd.get("notes").trim() };
        await api.leagueSaveMatch(ctx.id, m);
      } else if (k === "result") {
        const rows = [...f.querySelectorAll(".ev")].map((r) => ({ team: r.querySelector("[name=ev_team]").value, player: r.querySelector("[name=ev_player]").value.trim(), kind: r.querySelector("[name=ev_kind]").value })).filter((x) => x.player);
        await api.recordResult(ctx.id, fd.get("id"), +fd.get("hg"), +fd.get("ag"), rows, fd.get("notes").trim());
      } else if (k === "gen") {
        const ids = S.teams.filter((x) => x.status === "active").map((x) => x.id), start = fd.get("start") ? new Date(fd.get("start")) : null, gap = +fd.get("gap") || 7;
        const ms = roundRobin(ids, +fd.get("v")).map((m) => ({ ...m, starts_at: start ? new Date(start.getTime() + (+m.round.slice(1) - 1) * gap * 864e5).toISOString() : null }));
        await api.leagueCreateMatches(ctx.id, sel, ms); tab = "calendario";
      }
      sheet.close(); toast("Guardado"); ctx.reload();
    });
  });
}
