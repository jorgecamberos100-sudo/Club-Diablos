// Sección Ajustes: administradores con permisos por función, y bitácora de cambios.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { FEATURES, can as hasFeature } from "../plans.js";
import { card, chip, row, btn, empty, dtime, toast, copyText, waLink, appURL } from "../ui.js";
import * as sheet from "../sheet.js";
import { actionLabel, detailText } from "./audit.js";

export const PERMS = { teams: "Equipos e invitaciones", tournaments: "Torneos", schedule: "Calendario", results: "Resultados", sanctions: "Sanciones y objeciones", finance: "Finanzas de la liga", registration: "Registro de jugadores", audit: "Ver la bitácora", settings: "Ajustes de la liga" };
const ROLE = { owner: "Superadministrador", admin: "Administrador" };
let S = null, auditN = 30;

export async function render(ctx) {
  const mine = ctx.can("admins") || ctx.l.me.role === "owner";
  let admins = [], invites = [], log = null;
  if (mine) [admins, invites] = await Promise.all([api.leagueAdmins(ctx.id), api.adminInvites(ctx.id)]);
  if (ctx.can("audit")) log = await api.auditView(ctx.id, auditN);
  S = { ctx, admins };
  const info = card("Tu liga", `<div class="cl-who"><b>${esc(ctx.l.name)}</b><span>${esc(ROLE[ctx.l.me.role] || "")}</span></div><p class="hint">Plan: ${esc(ctx.ent ? ctx.ent.name : "—")}</p>
    <ul class="feat">${["public_page"].map((f) => `<li><span>${esc(FEATURES[f])}</span><span class="chip ${hasFeature(ctx.ent, f) ? "ok" : "due"}">${hasFeature(ctx.ent, f) ? "En tu plan" : "No incluido"}</span></li>`).join("")}</ul>
    <p class="hint">Reglamento, marca de la liga y página pública llegan en las siguientes etapas.</p>`);
  let adm = "";
  if (mine) {
    const live = invites.filter((i) => i.active && !i.used_by && new Date(i.expires_at) > new Date());
    adm = card("Administradores", admins.map((a) => row(a.email || a.user_id, a.role === "owner" ? "Todos los permisos" : a.status === "revoked" ? "Acceso retirado" : a.perms.map((p) => PERMS[p] || p).join(", "),
      chip(a.status === "revoked" ? "Retirado" : ROLE[a.role], a.status === "active" ? "ok" : "na") + (a.role !== "owner" && a.status === "active" ? btn("Permisos", `data-la="perms" data-id="${esc(a.user_id)}"`, "ghost") + btn("Quitar", `data-la="revoke" data-id="${esc(a.user_id)}"`, "ghost") : ""))).join("")
      + `<h3>Invitar a un administrador</h3><form data-lf="adminvite" class="fld"><label>Nombre (opcional)<input name="label" maxlength="60" placeholder="Ej. Secretario"></label>
      <fieldset class="perms"><legend>Qué podrá hacer</legend>${Object.entries(PERMS).map(([k, v]) => `<label class="opt"><input type="checkbox" name="perm" value="${k}"><span>${esc(v)}</span></label>`).join("")}</fieldset>
      <label>Vigencia en días<input name="days" type="number" min="1" max="60" value="7"></label><button class="btn" type="submit">Crear código</button></form>`
      + live.map((i) => {
        const msg = `Te invito a administrar ${ctx.l.name}. Código: ${i.code}. Entra a ${appURL()}#/cuenta y escríbelo en «¿Te invitaron a administrar una liga?».`;
        return `<div class="cl-row static inv"><span><b class="code">${esc(i.code)}</b><small>${esc(i.label || "Sin nombre")} · ${esc(i.perms.map((p) => PERMS[p]).join(", "))} · vence ${esc(dtime(i.expires_at))}</small></span><span class="acts">${btn("Copiar", `data-la="copy" data-v="${esc(i.code)}"`, "ghost")}<a class="btn sm ghost" href="${esc(waLink(msg))}" target="_blank" rel="noopener">WhatsApp</a>${btn("Revocar", `data-la="rinv" data-v="${esc(i.code)}"`, "ghost")}</span></div>`;
      }).join("")
      + `<p class="hint">Cada código sirve una sola vez. Quien lo use solo podrá hacer lo que marques; puedes cambiarlo o quitarle el acceso cuando quieras.</p>`);
  }
  const aud = log ? card("Bitácora", (log.length ? log.map((a) => row(actionLabel(a.action), `${a.actor || "—"} · ${dtime(a.at)}${detailText(a) ? " · " + detailText(a) : ""}`)).join("") : empty("Todavía no hay movimientos."))
    + (log.length >= auditN ? `<div class="row-acts">${btn("Ver más", 'data-la="more"', "ghost")}</div>` : "")
    + `<p class="hint">Cada cambio importante queda con quién lo hizo, cuándo y, en las correcciones, el valor anterior. No se puede borrar desde la app.</p>`) : "";
  return info + adm + aud;
}

const done = (ctx) => (ctx.reload(), undefined);
export const actions = {
  async copy(ctx, el) { toast((await copyText(el.dataset.v)) ? "Código copiado" : "No se pudo copiar; selecciónalo y cópialo a mano.", false); },
  async rinv(ctx, el) { await api.revokeAdminInvite(ctx.id, el.dataset.v); toast("Código revocado"); done(ctx); },
  async more(ctx) { auditN += 50; done(ctx); },
  async revoke(ctx, el) {
    if (!confirm("¿Quitarle el acceso a este administrador? Pierde todos sus permisos de inmediato; su historial se conserva.")) return;
    await api.revokeAdmin(ctx.id, el.dataset.id); toast("Acceso retirado"); done(ctx);
  },
  async perms(ctx, el) {
    const a = S.admins.find((x) => x.user_id === el.dataset.id);
    sheet.open("Permisos", a.email, `<form data-aform="perms" class="fld"><input type="hidden" name="id" value="${esc(a.user_id)}"><fieldset class="perms">${Object.entries(PERMS).map(([k, v]) => `<label class="opt"><input type="checkbox" name="perm" value="${k}"${a.perms.includes(k) ? " checked" : ""}><span>${esc(v)}</span></label>`).join("")}</fieldset><button class="btn" type="submit">Guardar</button></form>`);
  },
};
export const forms = {
  async adminvite(ctx, f, fd) {
    const perms = fd.getAll("perm"); if (!perms.length) return toast("Marca al menos un permiso.", true);
    const code = await api.createAdminInvite(ctx.id, perms, (fd.get("label") || "").trim(), +fd.get("days") || 7); toast("Código creado: " + code); done(ctx);
  },
};
sheet.wireNs("a", () => {}, (k, f, fd) => {
  sheet.guard(async () => {
    const perms = fd.getAll("perm"); if (!perms.length) throw new Error("Datos no válidos");
    await api.setAdminPerms(S.ctx.id, fd.get("id"), perms); sheet.close(); toast("Permisos actualizados"); S.ctx.reload();
  });
});
