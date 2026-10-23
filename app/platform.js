// Experiencias fuera de un equipo:
//   #/cuenta                  -> Mi cuenta: elegir qué organizas (equipo, liga o ambos) y ver tus equipos y ligas
//   #/liga/<liga>/<sección>   -> Panel del organizador de liga
// Los equipos siguen en #/<club>/<equipo>/<vista>; nada de eso cambia.
import { esc, icon } from "./util.js";
import { applyTheme } from "./theme.js";
import { on, init, api, friendly, mode } from "./cloud.js";
import { openAuth, googleBtn } from "./cloudui.js";
import { loadClubs } from "./data.js";
import { FEATURES, can } from "./plans.js";
import { card, chip, toast, dshort } from "./ui.js";
import { consentFields, consentFrom } from "./consent.js";
import * as equipos from "./league/equipos.js";
import * as torneos from "./league/torneos.js";
import * as sanciones from "./league/sanciones.js";
import * as finanzas from "./league/finanzas.js";
import * as ajustes from "./league/ajustes.js";
import * as jugadores from "./league/jugadores.js";
import * as delegate from "./league/delegate.js";

// Cada sección con módulo propio exporta render(ctx), actions y forms. Las demás muestran su descripción.
const MODULES = { equipos, torneos, jugadores, sanciones, finanzas, ajustes };

const THEME = {
  name: "Mi cuenta",
  theme: {
    colors: { bg: "#0e1110", panel: "#151a18", raise: "#1c2321", line: "#2a3330", text: "#ffffff", muted: "#a0aaa6", primary: "#1f9d61", primarySoft: "#3fd18a", onPrimary: "#ffffff" },
    card: "recta", pattern: "liso",
  },
};
const ROLES = {
  team: ["Organizador de equipo", "Plantel, asistencia, alineación, partidos, calificaciones y finanzas de tu equipo."],
  league: ["Organizador de liga", "Torneos, roles, tablas, sanciones, credenciales y la página de tu liga."],
};
const SECTIONS = {
  inicio: { label: "Inicio" },
  torneos: { label: "Torneos", f: ["tournaments", "schedule", "standings"], txt: "Temporadas, torneos, categorías y modalidades de fútbol 5 a 11; jornadas, horarios, canchas, resultados, tablas y goleo." },
  equipos: { label: "Equipos", f: ["registration", "credentials", "team_pro_grant"], txt: "Equipos inscritos, invitaciones con código, registro de jugadores por el delegado o en oficina, y credenciales para imprimir." },
  jugadores: { label: "Jugadores", f: ["registration", "credentials"], txt: "Padrón de jugadores de la liga, registro por delegado, enlace o en oficina, y credenciales para imprimir." },
  sanciones: { label: "Sanciones", f: ["sanctions"], txt: "Sanciones con motivo, fechas y evidencia; objeciones, actas (también por foto) e incidencias con su resolución." },
  finanzas: { label: "Finanzas", f: ["league_finance"], txt: "Conceptos de cobro configurables y qué debe y ha pagado cada equipo. Son registros administrativos, no cobros dentro de la app." },
  ajustes: { label: "Ajustes", f: ["public_page"], txt: "Reglamento, precios, marca de la liga, página pública y administradores con permisos." },
};
const ROLE_NAME = { owner: "Superadministrador", admin: "Administrador" };

const shell = (title, sub, body, extra = "") => `<header class="top"><div class="top-t"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${extra}</header><div id="view" class="view">${body}</div>`;

export async function renderPlatform(app, [kind, id, sec]) {
  applyTheme(THEME);
  document.title = kind === "liga" ? "Liga" : kind === "registro" ? "Registro de jugadores" : "Mi cuenta";
  if (!on) {
    app.innerHTML = shell("Mi cuenta", "", card("Cuentas apagadas", `<p>Las cuentas se activan al conectar la base de datos. Para probar ahora, agrega <b>?demo</b> antes del # en el enlace.</p>`));
    return;
  }
  await init();
  if (kind === "registro") { await registro(app, id); wire(app); return; }
  const user = await api.user();
  if (!user) {
    app.innerHTML = shell("Mi cuenta", "", card("Entra para organizar", `<p>Con tu cuenta administras tus equipos y tus ligas desde un solo lugar.</p>${googleBtn()}<button type="button" class="link" data-cl="auth-in">Entrar con correo</button>`));
  } else if (kind === "liga") {
    await league(app, user, id, SECTIONS[sec] ? sec : "inicio");
  } else {
    await hub(app, user);
  }
  wire(app);
}

// ---------- Mi cuenta ----------
async function hub(app, user) {
  const acc = (await api.account()) || { roles: [] };
  const roles = acc.roles || [];
  const demoNote = mode === "demo" ? `<p class="hint">Modo de prueba: todo se guarda solo en este navegador.</p>` : "";
  const out = `<div class="row-acts"><button type="button" class="btn ghost" data-cl="out">Salir</button></div>`;
  if (!roles.length) {
    app.innerHTML = shell("Mi cuenta", user.email, card("¿Qué vas a organizar?", `<p>Puedes elegir los dos. Después puedes cambiarlo.</p>
      <form data-pf="roles" class="fld">${roleChoices(roles)}<button class="btn" type="submit">Continuar</button><p class="msg" role="alert" hidden></p></form>${demoNote}`) + out);
    return;
  }
  const parts = [];
  if (roles.includes("team")) parts.push(await teamsCard());
  if (roles.includes("league")) parts.push(await leaguesCard());
  parts.push(card("¿Te invitaron a administrar una liga?", `<form data-pf="adminjoin" class="fld"><label>Código de administrador<input name="code" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" required></label>
    <button class="btn ghost" type="submit">Entrar a la liga</button><p class="msg" role="alert" hidden></p><p class="hint">La liga te da el código y define qué puedes hacer. Cada código sirve una sola vez.</p></form>`));
  const missing = Object.keys(ROLES).filter((r) => !roles.includes(r));
  parts.push(card("Lo que organizas", `<p>${roles.map((r) => ROLES[r][0]).join(" y ")}.</p>
    ${missing.length ? `<div class="row-acts">${missing.map((r) => `<button type="button" class="btn ghost" data-cl="add-role" data-r="${r}">Agregar: ${esc(ROLES[r][0].toLowerCase())}</button>`).join("")}</div>` : ""}`));
  app.innerHTML = shell("Mi cuenta", user.email, parts.join("") + demoNote + out);
}

function roleChoices(sel) {
  return `<div class="pick">${Object.entries(ROLES).map(([k, [t, d]]) => `<label class="pick-o"><input type="checkbox" name="role" value="${k}"${sel.includes(k) ? " checked" : ""}><span><b>${esc(t)}</b><small>${esc(d)}</small></span></label>`).join("")}</div>`;
}

async function teamsCard() {
  const [mine, clubs] = await Promise.all([api.myTeams(), loadClubs().catch(() => [])]);
  // Los clubes de archivo salen de clubs.json; los creados en la app, de la base de datos.
  const names = Object.fromEntries(clubs.map((x) => [x.id, x.name]));
  await Promise.all([...new Set(mine.map((m) => m.club_id))].filter((c) => !names[c]).map(async (c) => { const r = await api.dbClub(c).catch(() => null); if (r) names[c] = r.club.name; }));
  const name = (c) => names[c] || c;
  const ents = await Promise.all(mine.map((m) => api.entitlement("team", m.club_id + "/" + m.team_id).catch(() => null)));
  const links = await Promise.all(mine.map((m) => api.teamLinks(m.club_id, m.team_id).catch(() => [])));
  const LST = { pending: ["due", "Esperando a la liga"], approved: ["ok", "Vinculado"] };
  const rows = mine.map((m, i) => {
    const e = ents[i], act = links[i].filter((x) => ["pending", "approved"].includes(x.status));
    const why = e && e.source === "league" ? " · Pro de la liga" : "";
    return `<a class="cl-row" href="#/${esc(m.club_id)}/${esc(m.team_id)}/inicio"><span><b>${esc(name(m.club_id))}</b><small>${esc(m.team_id)}${esc(why)}</small></span><span class="chip ok">${esc(e ? e.name : "")}</span></a>`
      + act.map((x) => `<div class="cl-row static sub"><span><b>${esc(x.league_name || x.league_id)}</b><small>${x.status === "approved" && x.pro ? "Pro cubierto por la liga" : ""}</small></span><span class="acts">${chip(LST[x.status][1], LST[x.status][0])}${x.status === "approved" ? `<button type="button" class="btn sm" data-cl="regleague" data-c="${esc(m.club_id)}" data-t="${esc(m.team_id)}">Registrar jugadores</button>` : ""}<button type="button" class="btn sm ghost" data-cl="unlink" data-id="${esc(x.id)}">${x.status === "pending" ? "Cancelar" : "Dejar la liga"}</button></span></div>`).join("");
  }).join("");
  const linkForm = mine.length ? `<form data-pf="link" class="fld"><label>Vincular con una liga<input name="code" placeholder="Código de la liga" autocomplete="off" autocapitalize="characters" required></label>
    ${mine.length > 1 ? `<label>Equipo<select name="team">${mine.map((m) => `<option value="${esc(m.club_id)}/${esc(m.team_id)}">${esc(name(m.club_id))}</option>`).join("")}</select></label>` : `<input type="hidden" name="team" value="${esc(mine[0].club_id)}/${esc(mine[0].team_id)}">`}
    <button class="btn ghost" type="submit">Pedir vinculación</button><p class="msg" role="alert" hidden></p><p class="hint">Tu liga te da el código. Al vincularte, la liga puede darte Pro sin costo mientras su contrato siga vigente.</p></form>` : "";
  const form = `<form data-pf="team" class="fld"><label>${mine.length ? "Crear otro equipo" : "Crea tu equipo"}<input name="nm" placeholder="Nombre del equipo" maxlength="60" required></label>
    <div class="pickgrid fmts">${[5, 6, 7, 8, 9, 11].map((n) => `<label class="opt"><input type="radio" name="fmt" value="${n}"${n === 7 ? " checked" : ""}><span>Fútbol ${n}</span></label>`).join("")}</div>
    <button class="btn" type="submit">Crear equipo</button><p class="msg" role="alert" hidden></p></form>`;
  return card("Mis equipos", `${rows}${rows ? "" : `<p>Todavía no administras ningún equipo. Si ya existe, abre su enlace y entra con esta cuenta.</p>`}${linkForm}${form}`);
}

async function leaguesCard() {
  const mine = await api.myLeagues();
  const rows = mine.map((l) => `<a class="cl-row" href="#/liga/${esc(l.id)}/inicio"><span><b>${esc(l.name)}</b></span><span class="chip ok">${esc(ROLE_NAME[l.role] || l.role)}</span></a>`).join("");
  return card("Mis ligas", `${rows}<form data-pf="league" class="fld"><label>${mine.length ? "Crear otra liga" : "Crea tu liga"}<input name="nm" placeholder="Nombre de la liga" maxlength="80" required></label><button class="btn" type="submit">Crear liga</button><p class="msg" role="alert" hidden></p></form>`);
}

// ---------- Registro por enlace (sin cuenta) ----------
async function registro(app, code) {
  const info = await api.regLinkInfo(code || "").catch(() => ({ error: "invalid" }));
  if (info.error === "rate") { app.innerHTML = shell("Registro de jugadores", "", card("Espera un momento", `<p>Hubo demasiados intentos desde esta conexión. Vuelve a intentarlo en unos minutos.</p>`)); return; }
  if (info.error) { app.innerHTML = shell("Registro de jugadores", "", card("Enlace no válido", `<p>Este enlace no existe, ya venció o ya no admite más registros. Pídele uno nuevo a tu liga.</p>`)); return; }
  const r = info.rules;
  app.innerHTML = shell("Registro de jugadores", info.league, card(info.team, `<p>${esc(info.tournament)}</p>
    <form data-pf="reglink" data-code="${esc(code)}" class="fld"><label>Nombre completo<input name="name" required minlength="2" maxlength="80" autocomplete="name"></label>
    <label>Fecha de nacimiento<input name="birth" type="date" required max="${new Date().toISOString().slice(0, 10)}"></label>
    ${r.doc === "off" ? "" : `<label>Documento de identidad${r.doc === "required" ? " (obligatorio)" : " (opcional)"}<input name="doc" maxlength="30"${r.doc === "required" ? " required" : ""}></label>`}
    <p class="hint">Tu registro queda pendiente hasta que la liga lo apruebe.${r.photo === "off" ? "" : " La foto la toma tu delegado o la liga."} Tus datos solo los ve la administración de la liga.</p>
    ${consentFields(info.privacy, "self")}
    <button class="btn" type="submit"${info.privacy ? "" : " disabled"}>Enviar mi registro</button><p class="msg" role="alert" hidden></p></form>`));
}

// ---------- Panel de liga ----------
let curLeague = null;
async function league(app, user, id, sec) {
  const [l, ent] = await Promise.all([api.league(id), api.entitlement("league", id).catch(() => null)]);
  const acc = `<a class="top-acc" href="#/cuenta" aria-label="Mi cuenta">${icon.cuenta}</a>`;
  if (!l) {
    app.innerHTML = shell("Liga", "", card("Sin acceso", `<p>Esta liga no existe o tu cuenta no es administradora.</p><div class="row-acts"><a class="btn" href="#/cuenta">Ir a Mi cuenta</a></div>`), acc);
    return;
  }
  document.title = l.name;
  const S = SECTIONS[sec];
  const can2 = (perm) => l.me.role === "owner" || (l.me.perms || []).includes("*") || (l.me.perms || []).includes(perm);
  curLeague = { id, l, ent, user, can: can2, sec, reload: () => window.__reload() };
  torneos.wireSheets(() => curLeague);
  let body;
  if (MODULES[sec]) {
    try { body = await MODULES[sec].render(curLeague); } catch (e) { console.error(e); body = card(S.label, `<p class="hint">${esc(friendly(e))}</p>`); }
  } else if (sec === "inicio") {
    body = card("Tu liga", `<div class="cl-who"><b>${esc(l.name)}</b><span>${esc(ROLE_NAME[l.me.role] || "")}</span></div><p class="hint">Plan: ${esc(ent ? ent.name : "—")}</p>`)
      + card("Cómo se arma", `<ol class="steps">${Object.entries(SECTIONS).filter(([k]) => k !== "inicio").map(([k, s]) => `<li><a href="#/liga/${esc(id)}/${k}"><b>${esc(s.label)}</b></a><small>${esc(s.txt)}</small></li>`).join("")}</ol>`);
  } else {
    body = card(S.label, `<p>${esc(S.txt)}</p><p class="hint">Esta sección se construye en las siguientes etapas.</p>
      <ul class="feat">${S.f.map((f) => `<li><span>${esc(FEATURES[f])}</span><span class="chip ${can(ent, f) ? "ok" : "due"}">${can(ent, f) ? "En tu plan" : "No incluido"}</span></li>`).join("")}</ul>`);
    if (sec === "ajustes") body += card("Administradores", `<div class="cl-row static"><span><b>${esc(user.email)}</b><small>${esc(ROLE_NAME[l.me.role] || "")}</small></span></div><p class="hint">Invitar administradores con permisos y revocarlos llega en la siguiente etapa.</p>`);
  }
  const tabs = Object.entries(SECTIONS);
  app.innerHTML = shell(l.name, "Panel de liga", body, acc)
    + `<nav class="tabbar" style="--n:${tabs.length}" aria-label="Secciones">${tabs.map(([k, v]) => `<a href="#/liga/${esc(id)}/${k}"${k === sec ? ' aria-current="page"' : ""}>${icon[k] || icon.inicio}<span>${v.label}</span></a>`).join("")}</nav>`;
}

// ---------- Acciones ----------
function wire(app) {
  const say = (f, t) => { const m = f.querySelector(".msg"); if (m) { m.textContent = t; m.hidden = !t; } };
  app.onclick = async (e) => {
    const la = e.target.closest("[data-la]");
    if (la && curLeague && MODULES[curLeague.sec]) {
      const fn = MODULES[curLeague.sec].actions[la.dataset.la]; la.disabled = true;
      try { if (fn) await fn(curLeague, la); } catch (err) { toast(friendly(err), true); } finally { la.disabled = false; }
      return;
    }
    const t = e.target.closest("[data-cl]"); if (!t) return;
    const a = t.dataset.cl;
    try {
      if (a === "auth-in") return openAuth(false);
      if (a === "google") return await api.signInGoogle();
      if (a === "out") { await api.signOut(); return window.__reload(); }
      if (a === "regleague") return await delegate.open(t.dataset.c, t.dataset.t);
      if (a === "unlink") { if (!confirm("¿Salir de esta liga? Tu equipo conserva todo; solo pierde el Pro que venía de la liga.")) return; await api.unlinkTeam(t.dataset.id); toast("Saliste de la liga"); return window.__reload(); }
      if (a === "add-role") { const acc = (await api.account()) || { roles: [] }; await api.setRoles([...new Set([...(acc.roles || []), t.dataset.r])]); return window.__reload(); }
    } catch (err) { toast(friendly(err), true); }
  };
  app.onsubmit = async (e) => {
    const lf = e.target.closest("form[data-lf]");
    if (lf && curLeague && MODULES[curLeague.sec]) {
      e.preventDefault(); const b = lf.querySelector("button[type=submit]"); if (b) b.disabled = true;
      try { await MODULES[curLeague.sec].forms[lf.dataset.lf](curLeague, lf, new FormData(lf)); } catch (err) { toast(friendly(err), true); } finally { if (b) b.disabled = false; }
      return;
    }
    const f = e.target.closest("form[data-pf]"); if (!f) return;
    e.preventDefault();
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      if (f.dataset.pf === "roles") {
        const roles = new FormData(f).getAll("role");
        if (!roles.length) { btn.disabled = false; return say(f, "Elige al menos una opción."); }
        await api.setRoles(roles);
        // Si solo eligió liga y aún no tiene una, la pantalla siguiente le pide crearla.
        return window.__reload();
      }
      if (f.dataset.pf === "link") {
        const fd = new FormData(f), [c, t] = String(fd.get("team")).split("/");
        const r = await api.requestLink(fd.get("code"), c, t);
        const M = { invalid: "Ese código no es válido o ya venció.", duplicate: "Ese equipo ya está vinculado o pendiente con esa liga.", throttled: "Demasiados intentos. Prueba de nuevo en una hora." };
        if (r.error) { btn.disabled = false; return say(f, M[r.error] || "No se pudo vincular."); }
        toast("Solicitud enviada a " + r.league + ". Te avisará cuando la apruebe."); return window.__reload();
      }
      if (f.dataset.pf === "team") {
        const fd = new FormData(f), r = await api.createTeam(fd.get("nm").trim(), +fd.get("fmt"));
        location.hash = `#/${r.club}/${r.team}/plantel`;
        return;
      }
      if (f.dataset.pf === "reglink") {
        const fd = new FormData(f), r = await api.registerByLink(f.dataset.code, { name: fd.get("name").trim(), birth_date: fd.get("birth") || null, doc_id: (fd.get("doc") || "").trim() || null, consent: consentFrom(fd) });
        if (r.error) { btn.disabled = false; return say(f, r.error === "rate" ? "Hubo demasiados intentos. Espera unos minutos y vuelve a intentarlo." : r.error === "data" ? friendly({ message: r.message }) : "Este enlace ya no es válido. Pídele uno nuevo a tu liga."); }
        f.closest(".cl-card").innerHTML = `<h2>¡Listo!</h2><p>Recibimos tus datos para ${esc(r.team)}. La liga los revisará; si todo está en orden, te aprobará.</p>`; return;
      }
      if (f.dataset.pf === "adminjoin") {
        const r = await api.acceptAdminInvite(new FormData(f).get("code"));
        const M = { invalid: "Ese código no es válido, ya se usó o venció.", already: "Ya administras esa liga con esta cuenta.", limit: "Esa liga llegó al máximo de administradores de su plan.", throttled: "Demasiados intentos. Prueba de nuevo en una hora." };
        if (r.error) { btn.disabled = false; return say(f, M[r.error] || "No se pudo entrar."); }
        const acc = (await api.account()) || { roles: [] }; if (!(acc.roles || []).includes("league")) await api.setRoles([...(acc.roles || []), "league"]);
        toast("Ahora administras " + r.league); location.hash = `#/liga/${r.league_id}/inicio`; return;
      }
      if (f.dataset.pf === "league") {
        const lid = await api.createLeague(new FormData(f).get("nm").trim());
        location.hash = `#/liga/${lid}/inicio`;
      }
    } catch (err) { btn.disabled = false; say(f, friendly(err)); }
  };
}
