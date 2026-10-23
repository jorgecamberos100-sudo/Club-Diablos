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
  sanciones: { label: "Sanciones", f: ["sanctions"], txt: "Sanciones con motivo, fechas y evidencia; objeciones, actas (también por foto) e incidencias con su resolución." },
  finanzas: { label: "Finanzas", f: ["league_finance"], txt: "Conceptos de cobro configurables y qué debe y ha pagado cada equipo. Son registros administrativos, no cobros dentro de la app." },
  ajustes: { label: "Ajustes", f: ["public_page"], txt: "Reglamento, precios, marca de la liga, página pública y administradores con permisos." },
};
const ROLE_NAME = { owner: "Superadministrador", admin: "Administrador" };

const shell = (title, sub, body, extra = "") => `<header class="top"><div class="top-t"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${extra}</header><div id="view" class="view">${body}</div>`;
const card = (h, body) => `<section class="s cl-card">${h ? `<h2>${esc(h)}</h2>` : ""}${body}</section>`;

export async function renderPlatform(app, [kind, id, sec]) {
  applyTheme(THEME);
  document.title = kind === "liga" ? "Liga" : "Mi cuenta";
  if (!on) {
    app.innerHTML = shell("Mi cuenta", "", card("Cuentas apagadas", `<p>Las cuentas se activan al conectar la base de datos. Para probar ahora, agrega <b>?demo</b> antes del # en el enlace.</p>`));
    return;
  }
  await init();
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
  const name = (c) => (clubs.find((x) => x.id === c) || {}).name || c;
  const ents = await Promise.all(mine.map((m) => api.entitlement("team", m.club_id + "/" + m.team_id).catch(() => null)));
  const rows = mine.map((m, i) => `<a class="cl-row" href="#/${esc(m.club_id)}/${esc(m.team_id)}/inicio"><span><b>${esc(name(m.club_id))}</b><small>${esc(m.team_id)}</small></span><span class="chip ok">${esc(ents[i] ? ents[i].name : "")}</span></a>`).join("");
  return card("Mis equipos", rows || `<p>Todavía no administras ningún equipo. Abre el enlace de tu equipo y entra con esta cuenta: la primera cuenta de un equipo queda como administrador.</p><p class="hint">Crear un equipo nuevo desde aquí llega en la siguiente etapa.</p>`);
}

async function leaguesCard() {
  const mine = await api.myLeagues();
  const rows = mine.map((l) => `<a class="cl-row" href="#/liga/${esc(l.id)}/inicio"><span><b>${esc(l.name)}</b></span><span class="chip ok">${esc(ROLE_NAME[l.role] || l.role)}</span></a>`).join("");
  return card("Mis ligas", `${rows}<form data-pf="league" class="fld"><label>${mine.length ? "Crear otra liga" : "Crea tu liga"}<input name="nm" placeholder="Nombre de la liga" maxlength="80" required></label><button class="btn" type="submit">Crear liga</button><p class="msg" role="alert" hidden></p></form>`);
}

// ---------- Panel de liga ----------
async function league(app, user, id, sec) {
  const [l, ent] = await Promise.all([api.league(id), api.entitlement("league", id).catch(() => null)]);
  const acc = `<a class="top-acc" href="#/cuenta" aria-label="Mi cuenta">${icon.cuenta}</a>`;
  if (!l) {
    app.innerHTML = shell("Liga", "", card("Sin acceso", `<p>Esta liga no existe o tu cuenta no es administradora.</p><div class="row-acts"><a class="btn" href="#/cuenta">Ir a Mi cuenta</a></div>`), acc);
    return;
  }
  document.title = l.name;
  const S = SECTIONS[sec];
  let body;
  if (sec === "inicio") {
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
    const t = e.target.closest("[data-cl]"); if (!t) return;
    const a = t.dataset.cl;
    try {
      if (a === "auth-in") return openAuth(false);
      if (a === "google") return await api.signInGoogle();
      if (a === "out") { await api.signOut(); return window.__reload(); }
      if (a === "add-role") { const acc = (await api.account()) || { roles: [] }; await api.setRoles([...new Set([...(acc.roles || []), t.dataset.r])]); return window.__reload(); }
    } catch (err) { alert(friendly(err)); }
  };
  app.onsubmit = async (e) => {
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
      if (f.dataset.pf === "league") {
        const lid = await api.createLeague(new FormData(f).get("nm").trim());
        location.hash = `#/liga/${lid}/inicio`;
      }
    } catch (err) { btn.disabled = false; say(f, friendly(err)); }
  };
}
