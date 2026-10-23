// Sección Jugadores: padrón central de la liga, registro (oficina, delegado, enlace), aprobaciones, baja y credenciales.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { can as hasFeature } from "../plans.js";
import { card, chip, row, btn, empty, dshort, toast, copyText, waLink, appURL, shrinkImage } from "../ui.js";
import * as sheet from "../sheet.js";
import { printCredentials, credId } from "./credentials.js";

const VIA = { office: "Oficina", delegate: "Delegado", link: "Enlace" };
const ST = { pending: ["due", "Pendiente"], active: ["ok", "Activo"], inactive: ["na", "Inactivo"], rejected: ["na", "Rechazado"], removed: ["na", "Baja"] };
const LEVEL = { off: "No se pide", optional: "Opcional", required: "Obligatoria" };
let S = null, tid = null, find = "";

const age = (bd) => { if (!bd) return null; const d = new Date(bd), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
const tname = (id) => (S.teams.find((t) => t.id === id) || {}).name || "";
const tour = (id) => S.tours.find((t) => t.id === id) || {};

export async function render(ctx) {
  if (!ctx.can("registration")) return card("Jugadores", empty("Tu cuenta no tiene permiso para ver el registro de jugadores."));
  const [reg, teams, tours, rules, brand, links] = await Promise.all([api.registry(ctx.id), api.leagueTeams(ctx.id), api.tournaments(ctx.id), api.registrationRules(ctx.id), api.leagueBrand(ctx.id), api.regLinks(ctx.id)]);
  if (!tours.some((t) => t.id === tid)) tid = (tours[0] || {}).id || null;
  S = { ctx, ...reg, teams, tours, rules, brand, links };
  const enabled = hasFeature(ctx.ent, "registration"), canSet = ctx.can("settings");
  const byP = new Map(reg.players.map((p) => [p.id, p])), cur = (pid) => reg.regs.find((r) => r.player_id === pid && ["pending", "active"].includes(r.status));
  const photos = new Map(await Promise.all(reg.players.filter((p) => p.photo_path).slice(0, 80).map(async (p) => [p.id, await api.playerPhotoUrl(p.photo_path).catch(() => null)])));
  const pend = reg.regs.filter((r) => r.status === "pending");
  const needs = (p) => [S.rules.photo === "required" && !p.photo_path && "foto", S.rules.doc === "required" && !p.doc_norm && "documento"].filter(Boolean);

  const pendCard = pend.length ? card("Por revisar", pend.map((r) => { const p = byP.get(r.player_id) || {}; const miss = needs(p);
    return row(p.name, `${tname(r.team_id)} · ${VIA[r.via]} · ${dshort(r.created_at)}${miss.length ? " · Falta: " + miss.join(" y ") : ""}`,
      btn("Aprobar", `data-la="approve" data-id="${esc(r.id)}"`) + btn("Rechazar", `data-la="reject" data-id="${esc(r.id)}"`, "ghost")); }).join("")) : "";

  const act = reg.regs.filter((r) => r.status === "active").length;
  const top = card("Registro de jugadores", `<p><b>${reg.players.length}</b> en el padrón · <b>${act}</b> activos en equipos${pend.length ? ` · <b>${pend.length}</b> por revisar` : ""}</p>
    <div class="row-acts">${enabled && teams.length ? btn("Registrar jugador", 'data-la="reg"') : ""}</div>
    ${enabled ? "" : '<p class="hint">Tu plan no incluye el registro de jugadores.</p>'}${enabled && !teams.length ? '<p class="hint">Primero inscribe equipos en un torneo.</p>' : ""}
    <p class="hint">Un jugador existe una sola vez en el padrón de la liga (mismo documento, o mismo nombre y fecha de nacimiento) y solo puede estar en un equipo por torneo.</p>`);

  const list = reg.players.map((p) => { const r = cur(p.id), a = age(p.birth_date), ph = photos.get(p.id);
    return `<div class="cl-row static pl" data-n="${esc(p.norm)}"><span class="pl-ph">${ph ? `<img src="${esc(ph)}" alt="">` : "·"}</span><span><b>${esc(p.name)}</b><small>${esc([a != null && a + " años", r && tname(r.team_id) + (r.number != null ? " #" + r.number : ""), r && r.status === "pending" && "Pendiente"].filter(Boolean).join(" · "))}</small></span>
      <span class="acts">${a != null && a < 18 ? chip("Menor", "due") : ""}${chip(ST[p.status][1], ST[p.status][0])}${btn("Editar", `data-la="edit" data-id="${esc(p.id)}"`, "ghost")}
      ${r && r.status === "active" ? btn("Credencial", `data-la="cred1" data-id="${esc(r.id)}"`, "ghost") : ""}${r ? btn("Baja", `data-la="rm" data-id="${esc(r.id)}"`, "ghost") : ""}</span></div>`; }).join("");
  const padron = card("Padrón de la liga", reg.players.length ? `<label class="fld-inline">Buscar<input type="search" data-search placeholder="Nombre del jugador" value="${esc(find)}"></label><div id="pl-list">${list}</div>` : empty("Todavía no hay jugadores."));

  const live = links.filter((l) => l.active && new Date(l.expires_at) > new Date() && l.uses < l.max_uses);
  const linkCard = card("Enlaces de registro", `<p>Mándalo al delegado o a los jugadores de un equipo: capturan sus datos sin cuenta y tú apruebas cada uno.</p>
    ${enabled && teams.length ? `<form data-lf="mklink" class="fld"><label>Equipo<select name="team">${teams.map((t) => `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(tour(t.tournament_id).name || "")}</option>`).join("")}</select></label>
    <div class="two"><label>Usos máximos<input name="max" type="number" min="1" max="200" value="30"></label><label>Vigencia en días<input name="days" type="number" min="1" max="90" value="14"></label></div><button class="btn" type="submit">Crear enlace</button></form>` : ""}
    ${live.map((l) => { const url = appURL() + "#/registro/" + l.code, msg = `Registra a los jugadores de ${tname(l.team_id)} en ${ctx.l.name}: ${url}`;
      return `<div class="cl-row static inv"><span><b class="code">${esc(l.code)}</b><small>${esc(tname(l.team_id))} · ${l.uses}/${l.max_uses} usos · vence ${esc(dshort(l.expires_at))}</small></span><span class="acts">${btn("Copiar", `data-la="copy" data-v="${esc(url)}"`, "ghost")}<a class="btn sm ghost" href="${esc(waLink(msg))}" target="_blank" rel="noopener">WhatsApp</a>${btn("Revocar", `data-la="rlink" data-v="${esc(l.code)}"`, "ghost")}</span></div>`; }).join("")}`);

  const inT = teams.filter((t) => t.tournament_id === tid);
  const credCard = card("Credenciales", tours.length ? `<label class="fld-inline">Torneo<select data-la-change="jtour">${tours.map((t) => `<option value="${esc(t.id)}"${t.id === tid ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
    <p class="hint">Se imprimen con los colores y el logo de tu liga (en Ajustes). Llevan nombre, número, equipo, torneo, foto y un código; no llevan documento ni fecha de nacimiento.</p>
    <div class="row-acts">${inT.map((t) => btn("Hoja: " + t.name, `data-la="credTeam" data-id="${esc(t.id)}"`, "ghost")).join("")}${inT.length ? btn("Todo el torneo", 'data-la="credAll"') : ""}</div>` : empty("Aún no hay torneos."));

  const rulesCard = card("Reglas de registro", canSet ? `<form data-lf="rules" class="fld"><div class="two"><label>Foto<select name="photo">${Object.entries(LEVEL).map(([k, v]) => `<option value="${k}"${k === rules.photo ? " selected" : ""}>${v}</option>`).join("")}</select></label>
    <label>Documento de identidad<select name="doc">${Object.entries(LEVEL).map(([k, v]) => `<option value="${k}"${k === rules.doc ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>
    <label class="opt"><input type="checkbox" name="appr"${rules.delegate_approval ? " checked" : ""}><span>Lo que mandan los delegados y los enlaces espera mi aprobación</span></label><button class="btn" type="submit">Guardar reglas</button></form>
    <p class="hint">Si pides foto o documento, no se puede activar a un jugador que no lo tenga.</p>`
    : `<p>Foto: ${LEVEL[rules.photo]} · Documento: ${LEVEL[rules.doc]}</p>`);
  return top + pendCard + padron + linkCard + credCard + rulesCard;
}

const done = (ctx) => (ctx.reload(), undefined);
const photoInput = (rule) => (rule === "off" ? "" : `<label>Foto${rule === "required" ? " (obligatoria)" : " (opcional)"}<input type="file" name="photo" accept="image/*" capture="environment"${rule === "required" ? " required" : ""}></label>`);

export const actions = {
  async copy(ctx, el) { toast((await copyText(el.dataset.v)) ? "Enlace copiado" : "No se pudo copiar; selecciónalo y cópialo a mano.", false); },
  async rlink(ctx, el) { await api.revokeRegLink(ctx.id, el.dataset.v); toast("Enlace revocado"); done(ctx); },
  async reg() {
    const r = S.rules;
    sheet.open("Registrar jugador", "Registro en oficina: queda activo de inmediato", `<form data-jform="reg" class="fld">
      <label>Equipo<select name="team" required>${S.teams.map((t) => `<option value="${esc(t.id)}"${t.tournament_id === tid ? " selected" : ""}>${esc(t.name)} · ${esc(tour(t.tournament_id).name || "")}</option>`).join("")}</select></label>
      <label>Nombre completo<input name="name" required minlength="2" maxlength="80"></label>
      <div class="two"><label>Fecha de nacimiento<input name="birth" type="date" max="${new Date().toISOString().slice(0, 10)}"></label><label>Número<input name="number" type="number" min="0" max="99"></label></div>
      ${r.doc === "off" ? "" : `<label>Documento de identidad${r.doc === "required" ? " (obligatorio)" : " (opcional)"}<input name="doc" maxlength="30"${r.doc === "required" ? " required" : ""}></label>`}
      ${photoInput(r.photo)}<p class="hint">Si el jugador ya está en el padrón, se usa su registro (no se duplica).</p><button class="btn" type="submit">Registrar</button></form>`);
  },
  async edit(ctx, el) {
    const p = S.players.find((x) => x.id === el.dataset.id), r = S.rules;
    sheet.open("Editar jugador", p.name, `<form data-jform="edit" class="fld"><input type="hidden" name="id" value="${esc(p.id)}">
      <label>Nombre completo<input name="name" required minlength="2" maxlength="80" value="${esc(p.name)}"></label>
      <label>Fecha de nacimiento<input name="birth" type="date" value="${esc(p.birth_date || "")}"></label>
      ${r.doc === "off" ? "" : `<label>Documento de identidad<input name="doc" maxlength="30" value="${esc(p.doc_id || "")}"></label>`}
      ${r.photo === "off" ? "" : `<label>${p.photo_path ? "Cambiar foto" : "Agregar foto"}<input type="file" name="photo" accept="image/*" capture="environment"></label>`}
      <button class="btn" type="submit">Guardar</button></form>`);
  },
  async approve(ctx, el) {
    const reg = S.regs.find((x) => x.id === el.dataset.id), p = S.players.find((x) => x.id === reg.player_id);
    sheet.open("Aprobar registro", `${p.name} · ${tname(reg.team_id)}`, `<form data-jform="approve" class="fld"><input type="hidden" name="id" value="${esc(reg.id)}"><input type="hidden" name="player" value="${esc(p.id)}">
      <label>Número de camiseta (opcional)<input name="number" type="number" min="0" max="99"></label>
      ${S.rules.photo === "off" ? "" : `<label>${p.photo_path ? "Cambiar foto (opcional)" : "Foto" + (S.rules.photo === "required" ? " (obligatoria)" : " (opcional)")}<input type="file" name="photo" accept="image/*" capture="environment"${S.rules.photo === "required" && !p.photo_path ? " required" : ""}></label>`}
      ${S.rules.doc === "required" && !p.doc_norm ? `<label>Documento (obligatorio)<input name="doc" required maxlength="30"></label>` : ""}
      <button class="btn" type="submit">Aprobar y activar</button></form>`);
  },
  async reject(ctx, el) { const why = prompt("Motivo (opcional, queda en el historial):"); if (why === null) return; await api.decideRegistration(ctx.id, el.dataset.id, false, null, why); toast("Registro rechazado"); done(ctx); },
  async rm(ctx, el) { const why = prompt("Motivo de la baja (queda en el historial):"); if (why === null) return; await api.removeRegistration(ctx.id, el.dataset.id, why); toast("Baja registrada"); done(ctx); },
  async cred1(ctx, el) { await printSel([S.regs.find((x) => x.id === el.dataset.id)]); },
  async credTeam(ctx, el) { await printSel(S.regs.filter((r) => r.status === "active" && r.team_id === el.dataset.id)); },
  async credAll() { await printSel(S.regs.filter((r) => r.status === "active" && r.tournament_id === tid)); },
};

async function printSel(regs) {
  regs = regs.filter(Boolean); if (!regs.length) return toast("No hay jugadores activos para imprimir.", true);
  const cards = await Promise.all(regs.map(async (r) => { const p = S.players.find((x) => x.id === r.player_id), t = tour(r.tournament_id);
    return { id: r.id, name: p.name, number: r.number, team: tname(r.team_id), tournament: t.name, season: t.season, photo: await api.playerPhotoUrl(p.photo_path).catch(() => null) }; }));
  await printCredentials(cards, S.brand, S.ctx.l.name);
}

export const forms = {
  async rules(ctx, f, fd) { await api.setRegistrationRules(ctx.id, { photo: fd.get("photo"), doc: fd.get("doc"), delegate_approval: !!fd.get("appr") }); toast("Reglas guardadas"); done(ctx); },
  async mklink(ctx, f, fd) { const c = await api.createRegLink(ctx.id, fd.get("team"), +fd.get("max") || 30, +fd.get("days") || 14); toast("Enlace creado: " + c); done(ctx); },
};

async function upload(ctx, file) { return api.uploadPlayerPhoto(ctx.id, await shrinkImage(file)); }
sheet.wireNs("j", () => {}, (k, f, fd) => {
  const ctx = S.ctx;
  sheet.guard(async () => {
    const file = fd.get("photo"), has = file && file.size > 0;
    if (k === "reg") {
      const p = { name: fd.get("name").trim(), birth_date: fd.get("birth") || null, doc_id: (fd.get("doc") || "").trim() || null, number: fd.get("number") === "" ? null : +fd.get("number") };
      if (has) p.photo_path = await upload(ctx, file);
      await api.officeRegister(ctx.id, fd.get("team"), p);
    } else if (k === "edit") {
      const p = { name: fd.get("name").trim(), birth_date: fd.get("birth") || null }; if (fd.has("doc")) p.doc_id = fd.get("doc").trim(); if (has) p.photo_path = await upload(ctx, file);
      await api.updateLeaguePlayer(ctx.id, fd.get("id"), p);
    } else if (k === "approve") {
      const upd = {}; if (has) upd.photo_path = await upload(ctx, file); if (fd.get("doc")) upd.doc_id = fd.get("doc").trim();
      if (Object.keys(upd).length) await api.updateLeaguePlayer(ctx.id, fd.get("player"), upd);
      await api.decideRegistration(ctx.id, fd.get("id"), true, fd.get("number") === "" ? null : +fd.get("number"));
    }
    sheet.close(); toast("Guardado"); ctx.reload();
  });
});
// Controles que viven en la vista (no en una hoja): búsqueda y torneo.
document.addEventListener("input", (e) => { const t = e.target.closest("[data-search]"); if (!t) return; find = t.value; const q = find.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, "").trim();
  document.querySelectorAll("#pl-list .pl").forEach((r) => { r.hidden = q && !r.dataset.n.includes(q); }); });
document.addEventListener("change", (e) => { const t = e.target.closest("[data-la-change=jtour]"); if (t && S) { tid = t.value; S.ctx.reload(); } });
export { credId };
