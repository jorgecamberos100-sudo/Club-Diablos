// Mi entrenamiento: plan semanal por reglas locales, según la edad, la posición
// en el campo y lo que el jugador quiere mejorar.
// Rutas:
//   #/mi-entrenamiento                  solo, sin liga: se guarda en este celular.
//   #/mi-entrenamiento/<liga>           jugador de la liga: se identifica con su
//                                        nombre + fecha de nacimiento (la misma
//                                        identidad del padrón) y su plan se guarda
//                                        en la liga.
//   #/mi-entrenamiento/<liga>/<jugador> la liga lo abre desde el padrón.
// No hay portal del jugador todavía: esta vista es el primer paso y no pide cuenta.
import { esc, store } from "../util.js";
import { api, init, on } from "../cloud.js";
import { applyTheme } from "../theme.js";
import { themeFrom } from "../color.js";
import { POSICIONES, ROL_LABELS, ROLES_POR_FORMATO, FOCUS_LABELS, ATTR_LABELS, ATTR_KEYS, lineaDeRol, bandaDeEdad, edadDe, validarPerfil, normalizarPerfil, generarPlan, hashPerfil } from "../entrenamiento.js";

let S = null;

const aGuardado = (p) => ({ position: p.posicion, role: p.rol || null, format: p.formato || null, focuses: p.focos, days: p.dias, minutes: p.minutos, attrs: p.attrs || null });
const aApp = (g, edad) => ({ edad, posicion: g.position, rol: g.role || null, formato: g.format || null, focos: g.focuses || [], dias: g.days, minutos: g.minutes, attrs: g.attrs || null });

const focoChecks = (sel = []) => Object.entries(FOCUS_LABELS).map(([k, v]) => `<label class="opt"><input type="checkbox" name="foco" value="${k}"${sel.includes(k) ? " checked" : ""}><span>${v}</span></label>`).join("");
const attrSelects = (attrs = {}) => ATTR_KEYS.map((k) => `<label>${ATTR_LABELS[k]}<select name="attr-${k}"><option value="">Sin calificar</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}"${attrs[k] === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>`).join("");
const rolOptions = (posicion, formato, sel) => {
  const roles = (ROLES_POR_FORMATO[formato] || ROLES_POR_FORMATO[7]).filter((r) => lineaDeRol(r) === posicion);
  return `<option value="">Sin rol específico</option>` + roles.map((r) => `<option value="${r}"${sel === r ? " selected" : ""}>${ROL_LABELS[r]}</option>`).join("");
};

function formHTML(p, edad) {
  const banda = bandaDeEdad(edad);
  return `<form data-tr="perfil" class="fld">
    ${edad == null ? `<label>Edad<input name="edad" type="number" min="6" max="99" required></label>` : ""}
    <div class="two">
      <label>Posición en el campo<select name="posicion" required>${Object.entries(POSICIONES).map(([k, v]) => `<option value="${k}"${p.posicion === k ? " selected" : ""}>${v.linea}</option>`).join("")}</select></label>
      <label>Fútbol<select name="formato">${[7, 11].map((n) => `<option value="${n}"${p.formato === n ? " selected" : ""}>Fútbol ${n}</option>`).join("")}</select></label>
    </div>
    <label>Rol en el campo<select name="rol" data-rol>${rolOptions(p.posicion, p.formato || 7, p.rol)}</select></label>
    <p class="hint">${esc((POSICIONES[p.posicion] || {}).desc || "")}</p>
    <fieldset><legend>¿Qué quieres mejorar? (de 1 a 3)</legend><div class="pick">${focoChecks(p.focos)}</div></fieldset>
    <div class="two">
      <label>Días por semana<select name="dias">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${p.dias === n ? " selected" : ""}>${n} día${n > 1 ? "s" : ""}</option>`).join("")}</select></label>
      <label>Minutos por sesión<select name="minutos">${[30, 45, 60].map((n) => `<option value="${n}"${p.minutos === n ? " selected" : ""}>${n} minutos</option>`).join("")}</select></label>
    </div>
    <details><summary>¿Cómo te calificas? (opcional)</summary><p class="hint">Del 1 al 10, como te calificarían tus compañeros. Sirve para sugerirte qué mejorar.</p><div class="two">${attrSelects(p.attrs || {})}</div></details>
    ${banda ? `<p class="hint">Tu banda: <b>${esc(banda.nombre)}</b> · sesiones de hasta ${banda.maxMin} minutos.</p>` : ""}
    <button class="btn" type="submit">Generar mi plan</button><p class="msg" role="alert" hidden></p></form>`;
}

function planHTML(plan) {
  const sesiones = plan.sesiones.map((s) => `<h3>${esc(s.titulo)} · ${s.minutos} min</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ejercicio</th><th>Series / duración</th><th>Min</th></tr></thead><tbody>${s.ejercicios.map((e) => `<tr><td class="nm"><b>${esc(e.nombre)}</b><small>${esc(e.desc)}</small></td><td>${esc(e.detalle)}</td><td>${e.min}</td></tr>`).join("")}</tbody></table></div>`).join("");
  return `<section class="s cl-card"><h2>Tu plan de la semana</h2>
    <p>${esc(POSICIONES[plan.posicion].linea)}${plan.rol ? " · " + esc(ROL_LABELS[plan.rol]) : ""} · ${esc(plan.focos.map((f) => FOCUS_LABELS[f]).join(", "))} · ${plan.dias} días · ${plan.minutos} min por sesión · <b>${plan.resumen.minutosSemana} min por semana</b></p>
    <p class="hint">${esc(plan.resumen.nota)}</p>
    ${plan.resumen.sugerencia ? `<p class="hint">${esc(plan.resumen.sugerencia)}</p>` : ""}
    ${sesiones}
    <div class="row-acts"><button type="button" class="btn ghost" data-tr="otro">Generar otro plan</button></div>
    <p class="hint">Si algo te duele o te cansas de más, baja la intensidad: el plan es una guía, no una obligación.</p></section>`;
}

const shell = (titulo, sub, body) => `<header class="top"><div class="top-t"><h1>${esc(titulo)}</h1><p>${esc(sub || "")}</p></div></header><div class="view">${body}</div>`;
const card = (h, body) => `<section class="s cl-card">${h ? `<h2>${esc(h)}</h2>` : ""}${body}</section>`;

function leerForm(f) {
  const fd = new FormData(f);
  const attrs = {};
  for (const k of ATTR_KEYS) { const v = fd.get("attr-" + k); if (v !== "" && v != null) attrs[k] = +v; }
  return {
    edad: S.edad != null ? S.edad : +fd.get("edad"),
    posicion: fd.get("posicion"),
    rol: fd.get("rol") || null,
    formato: +fd.get("formato") || null,
    focos: fd.getAll("foco"),
    dias: +fd.get("dias"),
    minutos: +fd.get("minutos"),
    attrs: Object.keys(attrs).length ? attrs : null,
  };
}

async function guardar(perfil, plan) {
  const g = aGuardado(perfil), h = hashPerfil(perfil);
  if (!S.liga) { store("entrenamiento:local", { perfil, plan, variante: S.variante, birth: S.birth || null }); return true; }
  try {
    const r = S.admin
      ? await api.trainingSave(S.liga, S.pid, { profile: g, plan, hash: h })
      : await api.trainingSaveSelf(S.liga, { name: S.ident.name, birth_date: S.ident.birth_date, profile: g, plan, hash: h });
    if (r && r.error) { S.msg(r.message || "No se pudo guardar el plan."); return false; }
    return true;
  } catch (e) { S.msg("No se pudo guardar el plan: revisa tu conexión."); return false; }
}

function pintarPlan() {
  const el = document.getElementById("tr-plan");
  if (el && S.plan) el.innerHTML = planHTML(S.plan);
  const otro = document.querySelector("[data-tr=otro]");
  if (otro) otro.onclick = async () => { S.variante++; await generarDesdeForm(); };
}

async function generarDesdeForm() {
  const f = document.querySelector("[data-tr=perfil]");
  const msg = f.querySelector(".msg");
  const perfil = leerForm(f);
  const err = validarPerfil(perfil);
  if (err.length) { msg.hidden = false; msg.textContent = err[0]; return; }
  msg.hidden = true;
  const p = normalizarPerfil(perfil);
  S.perfil = p; S.edad = p.edad;
  try { S.plan = generarPlan(p, S.variante); } catch (e) { msg.hidden = false; msg.textContent = e.message; return; }
  const ok = await guardar(p, S.plan);
  if (!ok) return;
  pintarPlan();
  document.getElementById("tr-plan").scrollIntoView({ block: "start" });
}

function cablearPerfil() {
  const f = document.querySelector("[data-tr=perfil]");
  if (!f) return;
  const pos = f.querySelector("[name=posicion]"), fmt = f.querySelector("[name=formato]"), rol = f.querySelector("[data-rol]");
  const rehacerRol = () => { const sel = rol.value; rol.innerHTML = rolOptions(pos.value, +fmt.value || 7, sel); };
  pos.onchange = rehacerRol; fmt.onchange = rehacerRol;
  f.querySelectorAll("[name=foco]").forEach((c) => (c.onchange = () => {
    const marcados = [...f.querySelectorAll("[name=foco]:checked")];
    if (marcados.length > 3) { c.checked = false; const m = f.querySelector(".msg"); m.hidden = false; m.textContent = "Elige máximo 3 cosas para mejorar."; }
  }));
  f.querySelectorAll("[name^=attr-]").forEach((s) => (s.onchange = () => {
    const marcados = [...f.querySelectorAll("[name=foco]:checked")];
    if (marcados.length) return;
    const vals = ATTR_KEYS.map((k) => [k, +(f.querySelector(`[name=attr-${k}]`).value || 11)]).filter(([, v]) => v <= 10).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => k);
    vals.forEach((k) => { const c = f.querySelector(`[name=foco][value=${k}]`); if (c) c.checked = true; });
  }));
  f.onsubmit = async (e) => { e.preventDefault(); await generarDesdeForm(); };
}

function identHTML(prefill) {
  return card("¿Quién eres?", `<p>Escribe tu nombre y tu fecha de nacimiento tal como están en el padrón de la liga.</p>
    <form data-tr="ident" class="fld">
      <label>Nombre completo<input name="name" required minlength="2" maxlength="80" autocomplete="name" value="${esc((prefill && prefill.name) || "")}"></label>
      <label>Fecha de nacimiento<input name="birth" type="date" required max="${new Date().toISOString().slice(0, 10)}" value="${esc((prefill && prefill.birth_date) || "")}"></label>
      <button class="btn" type="submit">Ver mi plan</button><p class="msg" role="alert" hidden></p></form>`);
}

async function pasoPerfil() {
  const edad = S.edad;
  const p = S.perfil || { edad, posicion: "mediocampo", rol: null, formato: 7, focos: [], dias: 3, minutos: Math.min(45, (bandaDeEdad(edad) || {}).maxMin || 45), attrs: null };
  const quien = S.ident ? `<p><b>${esc(S.ident.name)}</b>${S.ident.team ? " · " + esc(S.ident.team) : ""} · ${edad} años</p>` : "";
  const volver = S.liga ? `<p><a href="#/p/${esc(S.liga)}">Volver a la página de la liga</a></p>` : `<p><a href="#/">Volver a la app</a></p>`;
  S.app.innerHTML = shell("Mi entrenamiento", S.liga ? "Plan semanal de entrenamiento" : "Plan semanal de entrenamiento (se guarda en este celular)", card("Tu perfil", quien + formHTML(p, edad)) + `<div id="tr-plan">${S.plan ? planHTML(S.plan) : ""}</div>` + volver);
  cablearPerfil();
  pintarPlan();
}

export async function renderEntrenamiento(app, [kind, liga, pid]) {
  document.body.classList.remove("embed");
  document.title = "Mi entrenamiento";
  S = { app, liga: liga || null, pid: pid || null, ident: null, perfil: null, plan: null, variante: 0, edad: null, admin: false, msg: (t) => { const m = document.querySelector(".msg"); if (m) { m.hidden = false; m.textContent = t; } } };
  applyTheme({ name: "Mi entrenamiento" });
  if (on) await init();
  let lgName = null;
  if (liga && on) {
    try { const r = await api.publicLeague(liga); if (r && r.league) { lgName = r.league.name; if (r.league.brand) applyTheme({ name: lgName, theme: { colors: themeFrom(r.league.brand.color || "#c8102e"), card: "recta", pattern: "liso" } }); } } catch (e) { /* sin página pública */ }
  }
  // Sin liga: planificador solo, sin cuentas ni base de datos.
  if (!liga) {
    const saved = store("entrenamiento:local");
    if (saved && saved.perfil && saved.plan) { S.perfil = saved.perfil; S.plan = saved.plan; S.variante = saved.variante || 0; S.edad = saved.perfil.edad; S.birth = saved.birth || null; }
    S.app.innerHTML = shell("Mi entrenamiento", "Plan semanal de entrenamiento (se guarda en este celular)", card("Tu perfil", `<form data-tr="solo" class="fld"><label>Fecha de nacimiento<input name="birth" type="date" required max="${new Date().toISOString().slice(0, 10)}" value="${esc(S.birth || "")}"></label><button class="btn" type="submit">Continuar</button><p class="msg" role="alert" hidden></p></form>`) + `<div id="tr-perfil"></div><div id="tr-plan"></div><p><a href="#/">Volver a la app</a></p>`);
    const f = document.querySelector("[data-tr=solo]");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f), birth = fd.get("birth"), edad = edadDe(birth);
      const m = f.querySelector(".msg");
      if (edad == null || edad < 6 || edad > 99) { m.hidden = false; m.textContent = "Revisa tu fecha de nacimiento."; return; }
      S.edad = edad; S.birth = birth;
      const p = S.perfil && S.perfil.edad === edad ? S.perfil : { edad, posicion: "mediocampo", rol: null, formato: 7, focos: [], dias: 3, minutos: Math.min(45, (bandaDeEdad(edad) || {}).maxMin || 45), attrs: null };
      S.perfil = p;
      document.getElementById("tr-perfil").innerHTML = card("Tu perfil", formHTML(p, edad));
      cablearPerfil();
      if (S.plan) pintarPlan();
    };
    return;
  }
  // Con liga: la base de datos es obligatoria.
  if (!on) {
    S.app.innerHTML = shell("Mi entrenamiento", "", card("Falta la base de datos", `<p>El plan de la liga necesita la base de datos conectada. Mientras tanto puedes usar el planificador solo en <a href="#/mi-entrenamiento">Mi entrenamiento</a>.</p>`));
    return;
  }
  // Con jugador: si quien mira es administrador de la liga, entra directo.
  if (pid) {
    try {
      const g = await api.trainingGet(liga, pid);
      if (g) {
        S.admin = true; S.ident = g; S.edad = edadDe(g.birth_date);
        if (g.profile) S.perfil = aApp(g.profile, S.edad);
        if (g.plan) S.plan = g.plan;
        await pasoPerfil();
        return;
      }
    } catch (e) { /* no es administrador: se identifica como jugador */ }
  }
  // Identificación del jugador (nombre + fecha de nacimiento del padrón).
  const prefill = store("entrenamiento:ident:" + liga);
  S.app.innerHTML = shell("Mi entrenamiento", lgName ? lgName + " · Plan semanal de entrenamiento" : "Plan semanal de entrenamiento", identHTML(prefill) + `<p><a href="#/p/${esc(liga)}">Volver a la página de la liga</a></p>`);
  const f = document.querySelector("[data-tr=ident]");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(f), name = (fd.get("name") || "").trim(), birth = fd.get("birth");
    const m = f.querySelector(".msg");
    let r;
    try { r = await api.trainingIdentify(liga, { name, birth_date: birth }); } catch (err) { m.hidden = false; m.textContent = "No se pudo conectar: revisa tu conexión."; return; }
    if (!r || r.error) { m.hidden = false; m.textContent = r && r.error === "rate" ? "Demasiados intentos: espera unos minutos." : "No te encontré en el padrón de la liga con esos datos. Revisa el nombre y la fecha, o pídele a tu liga que revise tu registro."; return; }
    if (pid && r.player_id !== pid) { m.hidden = false; m.textContent = "Ese jugador no coincide con el enlace que abriste."; return; }
    store("entrenamiento:ident:" + liga, { name, birth_date: birth });
    S.ident = r; S.edad = edadDe(r.birth_date);
    if (r.profile) S.perfil = aApp(r.profile, S.edad);
    if (r.plan) S.plan = r.plan;
    await pasoPerfil();
  };
}
