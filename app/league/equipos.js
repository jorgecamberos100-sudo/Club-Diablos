// Sección Equipos del panel de liga: contrato, invitaciones, solicitudes y equipos vinculados.
import { esc } from "../util.js";
import { api, mode } from "../cloud.js";
import { card, chip, row, btn, empty, dshort, toast, copyText, waLink, appURL } from "../ui.js";

const ST = { pending: ["due", "Pendiente"], approved: ["ok", "Vinculado"], rejected: ["na", "Rechazado"], removed: ["na", "Desvinculado por la liga"], left: ["na", "El equipo salió"] };

export async function render(ctx) {
  const [contract, invites, links] = await Promise.all([api.leagueContract(ctx.id), api.invites(ctx.id), api.leagueLinks(ctx.id)]);
  const pend = links.filter((x) => x.status === "pending"), ok = links.filter((x) => x.status === "approved"), old = links.filter((x) => !["pending", "approved"].includes(x.status));
  const c = contract || { pro_slots: 0, used: 0, valid: false, status: "none" };
  const left = Math.max(0, c.pro_slots - c.used);

  const contractCard = card("Contrato con la plataforma", `
    <div class="cl-who"><b>${c.valid ? c.used + " de " + c.pro_slots + " equipos con Pro" : "Sin contrato vigente"}</b><span>${c.valid ? left + " disponibles" : ""}</span></div>
    <p class="hint">${c.valid ? "Los equipos vinculados reciben Pro mientras el contrato siga vigente" + (c.ends_at ? " (hasta " + esc(dshort(c.ends_at)) + ")" : "") + ". Si se desvinculan o el contrato termina, solo pierden el Pro que venía de la liga."
      : "Tus equipos pueden vincularse, pero no recibirán Pro hasta que el contrato esté activo."}</p>
    ${mode === "demo" ? `<form data-lf="contract" class="fld"><label>Cupos de Pro para probar<input name="slots" type="number" min="0" max="500" value="2" required></label><button class="btn ghost" type="submit">Activar contrato de prueba</button><p class="hint">Solo en modo de prueba. En Supabase el contrato lo activa la plataforma.</p></form>` : ""}`);

  const invCard = card("Invitaciones", `
    <p>Crea un código y mándalo a los delegados. Cada delegado lo escribe en su cuenta y tú apruebas la solicitud.</p>
    <form data-lf="invite" class="fld"><label>Nombre (opcional)<input name="label" maxlength="60" placeholder="Ej. Temporada otoño"></label>
      <div class="two"><label>Usos máximos<input name="max" type="number" min="1" max="1000" placeholder="Sin límite"></label><label>Vigencia en días<input name="days" type="number" min="1" max="365" placeholder="Sin vencimiento"></label></div>
      <button class="btn" type="submit">Crear código</button></form>
    ${invites.map((i) => {
      const dead = !i.active || (i.expires_at && new Date(i.expires_at) < new Date()) || (i.max_uses && i.uses >= i.max_uses);
      const msg = `Te invito a vincular tu equipo con ${ctx.l.name}. Código: ${i.code}. Entra a ${appURL()}#/cuenta, abre «Vincular con una liga» y escríbelo.`;
      return `<div class="cl-row static inv${dead ? " off" : ""}"><span><b class="code">${esc(i.code)}</b><small>${esc(i.label || "Sin nombre")} · ${i.uses}${i.max_uses ? "/" + i.max_uses : ""} usos${i.expires_at ? " · vence " + esc(dshort(i.expires_at)) : ""}${dead ? " · " + (i.active ? "agotado o vencido" : "revocado") : ""}</small></span>
        ${dead ? "" : `<span class="acts">${btn("Copiar", `data-la="copy" data-v="${esc(i.code)}"`, "ghost")}<a class="btn sm ghost" href="${esc(waLink(msg))}" target="_blank" rel="noopener">WhatsApp</a>${btn("Revocar", `data-la="revoke" data-v="${esc(i.code)}"`, "ghost")}</span>`}</div>`;
    }).join("")}`);

  const pendCard = pend.length ? card("Solicitudes por revisar", pend.map((x) => row(x.team_name, "Pidió vincularse el " + dshort(x.requested_at), btn("Aprobar", `data-la="approve" data-id="${esc(x.id)}"`) + btn("Rechazar", `data-la="reject" data-id="${esc(x.id)}"`, "ghost"))).join("")) : "";

  const okCard = card("Equipos vinculados", ok.length ? ok.map((x) => row(x.team_name, x.pro ? "Con Pro de la liga" : "Sin Pro de la liga",
      (x.pro ? chip("Pro", "ok") : "") + btn(x.pro ? "Quitar Pro" : "Dar Pro", `data-la="pro" data-id="${esc(x.id)}" data-v="${x.pro ? 0 : 1}"`, "ghost") + btn("Desvincular", `data-la="unlink" data-id="${esc(x.id)}"`, "ghost"))).join("")
    : empty("Todavía no hay equipos vinculados."))
    + (old.length ? `<details class="cl-list"><summary>Historial (${old.length})</summary>${old.map((x) => `<p>${esc(x.team_name)} — ${esc((ST[x.status] || [])[1] || x.status)}${x.decided_at ? ", " + esc(dshort(x.decided_at)) : ""}</p>`).join("")}</details>` : "");

  return contractCard + pendCard + okCard + invCard;
}

const done = (ctx) => (ctx.reload(), undefined);
export const actions = {
  async copy(ctx, el) { toast((await copyText(el.dataset.v)) ? "Código copiado" : "No se pudo copiar; selecciónalo y cópialo a mano.", false); },
  async revoke(ctx, el) { await api.revokeInvite(ctx.id, el.dataset.v); toast("Código revocado"); done(ctx); },
  async approve(ctx, el) {
    const r = await api.decideLink(ctx.id, el.dataset.id, true);
    toast(r.pro ? "Equipo vinculado con Pro" : "Equipo vinculado. No recibió Pro: no hay cupo o contrato vigente."); done(ctx);
  },
  async reject(ctx, el) { await api.decideLink(ctx.id, el.dataset.id, false); toast("Solicitud rechazada"); done(ctx); },
  async pro(ctx, el) { await api.setTeamPro(ctx.id, el.dataset.id, el.dataset.v === "1"); toast(el.dataset.v === "1" ? "Pro asignado" : "Pro retirado"); done(ctx); },
  async unlink(ctx, el) {
    if (!confirm("¿Desvincular este equipo? Conserva su plantel y su historial; solo pierde el Pro que venía de la liga.")) return;
    await api.unlinkTeam(el.dataset.id); toast("Equipo desvinculado"); done(ctx);
  },
};
export const forms = {
  async invite(ctx, f, fd) {
    const code = await api.createInvite(ctx.id, { label: (fd.get("label") || "").trim(), maxUses: +fd.get("max") || null, days: +fd.get("days") || null });
    toast("Código creado: " + code); done(ctx);
  },
  async contract(ctx, f, fd) { await api.demoContract(ctx.id, +fd.get("slots") || 0, null); toast("Contrato de prueba activado"); done(ctx); },
};
