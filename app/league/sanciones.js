// Sección Sanciones: sanciones, objeciones y protestas, con su resolución y su historial de cambios.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { can as hasFeature } from "../plans.js";
import { card, chip, row, btn, empty, dshort, dtime, toast, saveFile } from "../ui.js";
import { toCSV } from "./report.js";
import { printDoc } from "./printout.js";
import * as sheet from "../sheet.js";
import { actionLabel, detailText } from "./audit.js";

const KIND = { amonestacion: "Amonestación", suspension: "Suspensión", multa: "Multa", puntos: "Descuento de puntos", expulsion: "Expulsión" };
const SST = { active: ["due", "Vigente"], served: ["ok", "Cumplida"], revoked: ["na", "Revocada"] };
const DK = { objection: "Objeción", protest: "Protesta" };
const DST = { open: ["due", "Abierta"], in_review: ["due", "En revisión"], accepted: ["ok", "Procedente"], rejected: ["na", "Improcedente"], withdrawn: ["na", "Retirada"] };
let S = null, show = "activas";

const tname = (id) => { const t = S && S.teams.find((x) => x.id === id); return t ? t.name : ""; };

export async function render(ctx) {
  if (!ctx.can("sanctions")) return card("Sanciones", empty("Tu cuenta no tiene permiso para ver sanciones."));
  const [sanctions, disputes, teams, tours] = await Promise.all([api.sanctions(ctx.id), api.disputes(ctx.id), api.leagueTeams(ctx.id), api.tournaments(ctx.id)]);
  S = { ctx, sanctions, disputes, teams, tours };
  const enabled = hasFeature(ctx.ent, "sanctions");
  const list = sanctions.filter((x) => (show === "activas" ? x.status === "active" : true));
  const detail = (x) => [x.player, x.team_id && tname(x.team_id), x.matches && x.matches + " partido(s)", x.points && "-" + x.points + " pts", x.amount != null && "$" + x.amount, x.ends_on && "hasta " + dshort(x.ends_on)].filter(Boolean).join(" · ");
  const srow = (x) => row(`${KIND[x.kind]}: ${x.reason}`, detail(x) + (x.evidence ? " · Evidencia: " + x.evidence : ""),
    chip(SST[x.status][1], SST[x.status][0]) + (x.status !== "revoked" ? btn("Editar", `data-la="edit" data-id="${esc(x.id)}"`, "ghost") : "")
    + (x.status === "active" ? btn("Cumplida", `data-la="served" data-id="${esc(x.id)}"`, "ghost") : "") + (x.status !== "revoked" ? btn("Revocar", `data-la="revoke" data-id="${esc(x.id)}"`, "ghost") : "")
    + (ctx.can("audit") ? btn("Historial", `data-la="hist" data-id="${esc(x.id)}"`, "ghost") : ""));
  const drow = (x) => row(`${DK[x.kind]}: ${x.subject}`, [tname(x.team_id), dshort(x.created_at), x.resolution && "Resolución: " + x.resolution].filter(Boolean).join(" · "),
    chip(DST[x.status][1], DST[x.status][0]) + btn(["accepted", "rejected", "withdrawn"].includes(x.status) ? "Cambiar" : "Resolver", `data-la="resolve" data-id="${esc(x.id)}"`)
    + (ctx.can("audit") ? btn("Historial", `data-la="hist" data-id="${esc(x.id)}"`, "ghost") : ""));
  const sBody = (list.length ? list.map(srow).join("") : empty(show === "activas" ? "No hay sanciones vigentes." : "Todavía no hay sanciones."))
    + `<div class="row-acts">${enabled ? btn("Nueva sanción", 'data-la="new"') : ""}${btn(show === "activas" ? "Ver todas" : "Ver solo vigentes", 'data-la="toggle"', "ghost")}${sanctions.length ? btn("Exportar CSV", 'data-la="csv"', "ghost") + btn("Imprimir / PDF", 'data-la="print"', "ghost") : ""}</div>`
    + (enabled ? "" : `<p class="hint">Tu plan no incluye sanciones.</p>`);
  const dBody = (disputes.length ? disputes.map(drow).join("") : empty("No hay objeciones ni protestas."))
    + (enabled ? `<div class="row-acts">${btn("Registrar objeción o protesta", 'data-la="newd"')}</div>` : "")
    + `<p class="hint">Una protesta no cambia el resultado por sí sola: si procede, se corrige el resultado en Torneos y el cambio queda en la bitácora.</p>`;
  return card("Sanciones", sBody) + card("Objeciones y protestas", dBody);
}

const done = (ctx) => (ctx.reload(), undefined);
export const forms = {};
export const actions = {
  async toggle(ctx) { show = show === "activas" ? "todas" : "activas"; done(ctx); },
  async new() { sanctionSheet(null); },
  async edit(ctx, el) { sanctionSheet(S.sanctions.find((x) => x.id === el.dataset.id)); },
  async newd() { disputeSheet(); },
  async resolve(ctx, el) { resolveSheet(S.disputes.find((x) => x.id === el.dataset.id)); },
  async served(ctx, el) { await api.setSanctionStatus(ctx.id, el.dataset.id, "served"); toast("Marcada como cumplida"); done(ctx); },
  async revoke(ctx, el) {
    const why = prompt("Motivo de la revocación (queda en el historial):"); if (why === null) return;
    await api.setSanctionStatus(ctx.id, el.dataset.id, "revoked", why); toast("Sanción revocada"); done(ctx);
  },
  async hist(ctx, el) { await historySheet(el.dataset.id); },
  async print(ctx) {
    const brand = await api.leagueBrand(ctx.id).catch(() => ({})), list = S.sanctions.filter((x) => show === "todas" || x.status === "active");
    const body = `<h2>Sanciones${show === "activas" ? " vigentes" : ""}</h2><table class="rep-t"><thead><tr><th>Tipo</th><th>Equipo</th><th>Jugador</th><th>Motivo</th><th>Detalle</th><th>Estado</th></tr></thead><tbody>${list.map((x) =>
      `<tr><td>${esc(KIND[x.kind])}</td><td>${esc(tname(x.team_id))}</td><td>${esc(x.player || "")}</td><td>${esc(x.reason)}</td><td>${esc([x.matches && x.matches + " partido(s)", x.points && "-" + x.points + " pts", x.amount != null && "$" + x.amount, x.ends_on && "hasta " + dshort(x.ends_on)].filter(Boolean).join(" · "))}</td><td>${esc(SST[x.status][1])}</td></tr>`).join("")}</tbody></table>
      <h2>Objeciones y protestas</h2><table class="rep-t"><thead><tr><th>Tipo</th><th>Asunto</th><th>Equipo</th><th>Estado</th><th>Resolución</th></tr></thead><tbody>${S.disputes.map((x) =>
      `<tr><td>${esc(DK[x.kind])}</td><td>${esc(x.subject)}</td><td>${esc(tname(x.team_id))}</td><td>${esc(DST[x.status][1])}</td><td>${esc(x.resolution || "")}</td></tr>`).join("")}</tbody></table>`;
    await printDoc({ league: ctx.l.name, title: "Sanciones y protestas", sub: "", logo: brand.logo, body });
  },
  async csv() {
    const csv = toCSV([[(r) => KIND[r.kind], "Tipo"], ["player", "Jugador"], [(r) => tname(r.team_id), "Equipo"], ["reason", "Motivo"], ["matches", "Partidos"], ["points", "Puntos"], ["amount", "Monto"], ["starts_on", "Desde"], ["ends_on", "Hasta"], [(r) => SST[r.status][1], "Estado"], ["evidence", "Evidencia"]], S.sanctions);
    saveFile("sanciones.csv", csv); toast("Archivo generado");
  },
};

function sanctionSheet(x) {
  const e = x || { kind: "amonestacion" }, tn = (t) => (S.tours.find((y) => y.id === t.tournament_id) || {}).name;
  sheet.open(x ? "Editar sanción" : "Nueva sanción", "", `<form data-sform="sanction" class="fld"><input type="hidden" name="id" value="${esc(e.id || "")}">
    ${x ? `<p><b>${esc(KIND[x.kind])}</b> · ${esc([x.player, tname(x.team_id)].filter(Boolean).join(" · "))}</p>` : `
    <label>Equipo<select name="team"><option value="">— Solo un jugador —</option>${S.teams.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}${tn(t) ? " · " + esc(tn(t)) : ""}</option>`).join("")}</select></label>
    <label>Jugador (opcional si es del equipo)<input name="player" maxlength="60"></label>
    <label>Tipo<select name="kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>`}
    <label>Motivo<textarea name="reason" rows="2" required minlength="3" maxlength="500">${esc(e.reason || "")}</textarea></label>
    <div class="three"><label>Partidos<input name="games" type="number" min="1" max="99" value="${e.matches ?? ""}"></label><label>Puntos<input name="points" type="number" min="1" max="50" value="${e.points ?? ""}"></label><label>Monto<input name="amount" type="number" min="0.01" max="100000" step="0.01" value="${e.amount ?? ""}"></label></div>
    <div class="two"><label>Desde<input name="starts_on" type="date" value="${esc(e.starts_on || "")}"></label><label>Hasta<input name="ends_on" type="date" value="${esc(e.ends_on || "")}"></label></div>
    <label>Evidencia (enlace o descripción)<input name="evidence" maxlength="500" value="${esc(e.evidence || "")}"></label>
    ${x ? "" : `<label class="opt"><input type="checkbox" name="charge" value="1"><span>Multas: crear el cargo en las finanzas del equipo</span></label>`}
    <p class="hint">Suspensión: indica partidos o fecha final. Descuento de puntos: indica equipo y puntos (se aplica en la tabla). Multa: indica el monto.</p>
    <button class="btn" type="submit">Guardar</button></form>`);
}

function disputeSheet() {
  sheet.open("Objeción o protesta", "", `<form data-sform="dispute" class="fld"><label>Tipo<select name="kind"><option value="objection">Objeción</option><option value="protest">Protesta</option></select></label>
    <label>Equipo que la presenta<select name="team"><option value="">—</option>${S.teams.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></label>
    <label>Asunto<input name="subject" required minlength="3" maxlength="120"></label><label>Detalle<textarea name="detail" rows="3" maxlength="2000"></textarea></label>
    <button class="btn" type="submit">Registrar</button></form>`);
}
export function disputeFor(ctx, match, teams) {   // desde el calendario: protesta ligada a un partido
  S = S || { ctx, sanctions: [], disputes: [], teams: [], tours: [] }; S.ctx = ctx; S.teams = teams;
  sheet.open("Objeción o protesta", "Ligada a este partido", `<form data-sform="dispute" class="fld"><input type="hidden" name="match" value="${esc(match.id)}">
    <label>Tipo<select name="kind"><option value="objection">Objeción</option><option value="protest">Protesta</option></select></label>
    <label>Equipo que la presenta<select name="team">${[match.home_id, match.away_id].map((i) => `<option value="${esc(i)}">${esc((teams.find((t) => t.id === i) || {}).name || "")}</option>`).join("")}</select></label>
    <label>Asunto<input name="subject" required minlength="3" maxlength="120"></label><label>Detalle<textarea name="detail" rows="3" maxlength="2000"></textarea></label>
    <button class="btn" type="submit">Registrar</button></form>`);
}

function resolveSheet(x) {
  sheet.open(DK[x.kind] + ": " + x.subject, tname(x.team_id), `<form data-sform="resolve" class="fld"><input type="hidden" name="id" value="${esc(x.id)}">
    ${x.detail ? `<p>${esc(x.detail)}</p>` : ""}
    <label>Estado<select name="status">${Object.entries(DST).map(([k, v]) => `<option value="${k}"${k === x.status ? " selected" : ""}>${v[1]}</option>`).join("")}</select></label>
    <label>Resolución (obligatoria al declarar procedente o improcedente)<textarea name="res" rows="3" maxlength="2000">${esc(x.resolution || "")}</textarea></label>
    <button class="btn" type="submit">Guardar</button></form>`);
}

async function historySheet(ref) {
  const h = await api.auditView(S.ctx.id, 100, ref);
  sheet.open("Historial", "Cada cambio con quién y cuándo", h.length ? h.map((a) => row(actionLabel(a.action), `${a.actor || "—"} · ${dtime(a.at)}${detailText(a) ? " · " + detailText(a) : ""}`)).join("") : empty("Sin cambios registrados."));
}

sheet.wireNs("s", () => {}, (k, f, fd) => {
  const ctx = S.ctx;
  sheet.guard(async () => {
    if (k === "sanction") {
      const s = { id: fd.get("id") || undefined, reason: fd.get("reason").trim(), matches: fd.get("games"), points: fd.get("points"), amount: fd.get("amount"), starts_on: fd.get("starts_on"), ends_on: fd.get("ends_on"), evidence: fd.get("evidence").trim() };
      if (!s.id) Object.assign(s, { team: fd.get("team") || undefined, player: fd.get("player").trim(), kind: fd.get("kind"), charge: !!fd.get("charge") });
      await api.saveSanction(ctx.id, s);
    } else if (k === "dispute") await api.fileDispute(ctx.id, { kind: fd.get("kind"), team: fd.get("team") || undefined, match: fd.get("match") || undefined, subject: fd.get("subject").trim(), detail: fd.get("detail").trim() });
    else if (k === "resolve") await api.resolveDispute(ctx.id, fd.get("id"), fd.get("status"), fd.get("res").trim());
    sheet.close(); toast("Guardado"); ctx.reload();
  });
});
