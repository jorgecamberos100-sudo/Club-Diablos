// Sección Ajustes: administradores con permisos por función, y bitácora de cambios.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { FEATURES, can as hasFeature } from "../plans.js";
import { card, chip, row, btn, empty, dtime, toast, copyText, waLink, appURL, shrinkImage } from "../ui.js";
import * as sheet from "../sheet.js";
import { actionLabel, detailText } from "./audit.js";

const TZS = ["America/Tijuana", "America/Mexico_City", "America/Monterrey", "America/Cancun", "America/Hermosillo", "America/Chihuahua", "America/Los_Angeles", "America/Bogota", "America/Lima", "America/Santiago", "America/Argentina/Buenos_Aires", "Europe/Madrid"];
// Plantilla de partida. NO es asesoría legal: la liga completa lo que está entre corchetes y lo revisa con quien la asesore.
const TEMPLATE = (liga) => `Aviso de privacidad de ${liga}

Responsable: [nombre de la persona o asociación responsable de la liga], con domicilio en [domicilio].

Datos que pedimos: nombre, fecha de nacimiento y, si la liga lo pide, foto [y documento de identidad]. No pedimos datos que no necesitemos para organizar el torneo.

Para qué los usamos: registrar a cada jugador en su equipo, verificar su categoría y su identidad en los partidos, imprimir credenciales y publicar resultados. [Agrega aquí cualquier otro uso.]

Quién los ve: solo la administración de la liga. Si la liga publica su página, solo se muestran nombres de equipos, calendario y resultados; [los nombres de goleadores solo si la liga lo activa].

Menores de edad: para registrar a un menor se necesita la autorización de su madre, padre o tutor.

Cuánto tiempo los guardamos: [por ejemplo, mientras el jugador participe y hasta X meses después].

Tus derechos: puedes pedir ver, corregir o borrar tus datos, u oponerte a su uso, escribiendo a [contacto]. Responderemos en [plazo].

Cambios: si cambiamos este aviso, lo publicaremos aquí y te lo volveremos a pedir al registrarte.

Fecha de esta versión: [fecha].`;

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
    <p class="hint">Reglamento y precios llegan en una etapa posterior.</p>`);
  let brandCard = "";
  if (ctx.can("settings")) {
    const b = await api.leagueBrand(ctx.id);
    brandCard = card("Marca de la liga", `<p>Los colores y el logo se usan en las credenciales y en la página pública.</p>
      <form data-lf="brand" class="fld"><div class="crest-prev">${b.logo ? `<img src="${esc(b.logo)}" alt="Logo actual" width="56" height="56">` : ""}<label>Logo<input type="file" name="logo" accept="image/*"></label></div>
      <label>Color principal<input type="color" name="color" value="${esc(b.color)}"></label><button class="btn" type="submit">Guardar marca</button></form>`);
  }
  let pubCard = "", privCard = "";
  if (ctx.can("settings")) {
    const pv = await api.privacyState(ctx.id);
    privCard = card("Privacidad", `<p>Antes de registrar jugadores, la liga publica su aviso de privacidad: lo ven y lo aceptan quienes se registran (o su madre, padre o tutor, si son menores). Cada cambio crea una versión nueva.</p>
      <form data-lf="privacy" class="fld"><label>Aviso de privacidad${pv.version ? ` (versión ${pv.version})` : ""}<textarea name="notice" rows="8" maxlength="8000" placeholder="Escribe aquí tu aviso o usa la plantilla">${esc(pv.notice || "")}</textarea></label>
      ${pv.notice ? "" : btn("Usar plantilla para revisar", 'data-la="tpl"', "ghost")}
      <label>Contacto para dudas de privacidad o para pedir que se borren datos<input name="contact" maxlength="160" value="${esc(pv.contact || "")}" placeholder="correo o teléfono de la liga"></label>
      <label class="opt"><input type="checkbox" name="minors"${pv.minors ? " checked" : ""}><span>En esta liga juegan menores de edad (no se publican nombres de jugadores)</span></label>
      <button class="btn" type="submit">Guardar aviso</button></form>
      <p class="hint">La plantilla es un punto de partida, no un documento legal: tiene partes entre [corchetes] que la liga debe completar y revisar con quien la asesore. La app no garantiza el cumplimiento de ninguna ley.</p>`);
  }
  if (ctx.can("settings") && hasFeature(ctx.ent, "public_page")) {
    const ps = await api.publicState(ctx.id), ts = (await api.tournaments(ctx.id)).filter((t) => ["published", "paused", "finished"].includes(t.status));
    const link = appURL() + "#/p/" + ctx.id, snip = (t) => `<iframe src="${appURL()}#/embed/${ctx.id}/${t.id}/tabla" title="${esc(ctx.l.name + " - " + t.name)}" width="100%" height="520" style="border:0" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
    const NAMES = { off: "No mostrar nombres (recomendado)", initials: "Solo nombre e inicial del apellido", full: "Nombre completo" };
    pubCard = card("Página pública", `<p>Cualquiera con el enlace puede ver la tabla, el calendario y, si lo permites, el goleo. Solo se muestran torneos publicados. Nunca aparecen fotos, documentos, fechas de nacimiento, contactos, notas, finanzas ni motivos de sanciones.</p>
      <form data-lf="pub" class="fld"><label class="opt"><input type="checkbox" name="enabled"${ps.enabled ? " checked" : ""}><span>Página pública activa</span></label>
      <label>Nombres de goleadores<select name="names"${ps.minors ? " disabled" : ""}>${Object.entries(NAMES).map(([k, v]) => `<option value="${k}"${k === ps.names ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      ${ps.minors ? `<p class="hint">Marcaste que hay menores de edad: los nombres no se publican.</p>` : ""}
      <label class="opt"><input type="checkbox" name="details"${ps.details ? " checked" : ""}><span>Mostrar hora y cancha de los partidos (si no, solo la fecha)</span></label>
      <label>Zona horaria de la liga<select name="tz">${TZS.map((z) => `<option${z === ps.tz ? " selected" : ""}>${z}</option>`).join("")}</select></label>
      <label class="opt"><input type="checkbox" name="chat"${ps.chat ? " checked" : ""}><span>Asistente de preguntas en la página</span></label>
      <label>Preguntas al asistente por día (máximo)<input name="daily" type="number" min="0" max="5000" value="${ps.chat_daily}"></label>
      <p class="hint">Las respuestas por reglas no cuestan. El tope aplica al servicio con modelo de lenguaje, si tu liga lo configura${ps.chat ? "; hoy lleva " + (await api.chatUsage(ctx.id)) + " pregunta(s) contadas" : ""}.</p><button class="btn" type="submit">Guardar</button></form>`
      + (ps.enabled ? `<h3>Enlace</h3><div class="cl-row static"><span><b class="code" style="font-size:14px">${esc(link)}</b></span><span class="acts">${btn("Copiar", `data-la="copy" data-v="${esc(link)}"`, "ghost")}<a class="btn sm ghost" href="${esc(waLink("Tabla y calendario de " + ctx.l.name + ": " + link))}" target="_blank" rel="noopener">WhatsApp</a></span></div>
        <h3>Para tu sitio web</h3>${ts.length ? ts.map((t) => `<p class="hint">${esc(t.name)}</p><textarea readonly rows="3" class="snip" aria-label="Código para ${esc(t.name)}">${esc(snip(t))}</textarea>${btn("Copiar código", `data-la="copy" data-v="${esc(snip(t))}"`, "ghost")}`).join("") : `<p class="hint">Publica un torneo para obtener su código.</p>`}
        <p class="hint">Cambia «tabla» por «calendario» o «goleo» en el código para mostrar otra parte.</p>` : ""));
  }
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
  return info + brandCard + privCard + pubCard + adm + aud;
}

const done = (ctx) => (ctx.reload(), undefined);
export const actions = {
  async tpl(ctx) { const t = document.querySelector("form[data-lf=privacy] textarea[name=notice]"); if (t && !t.value.trim()) t.value = TEMPLATE(ctx.l.name); },
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
  async brand(ctx, f, fd) {
    const file = fd.get("logo"); await api.setLeagueBrand(ctx.id, fd.get("color"), file && file.size ? await shrinkImage(file, 400, 0.9, "image/png") : null); toast("Marca guardada"); done(ctx);
  },
  async pub(ctx, f, fd) {
    const s = { enabled: fd.get("enabled") === "on", details: fd.get("details") === "on", chat: fd.get("chat") === "on", chat_daily: Math.max(0, Math.min(5000, Math.round(+fd.get("daily") || 0))), tz: fd.get("tz") };
    if (fd.get("names")) s.names = fd.get("names");
    await api.setPublicPage(ctx.id, s); toast("Página pública guardada"); done(ctx);
  },
  async privacy(ctx, f, fd) {
    const r = await api.setPrivacy(ctx.id, { notice: fd.get("notice"), contact: fd.get("contact"), minors: fd.get("minors") === "on" });
    toast(`Aviso guardado (versión ${r.version})`); done(ctx);
  },
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
