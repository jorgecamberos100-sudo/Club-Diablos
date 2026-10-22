// Pantallas de cuenta: entrar, elegir nombre, aprobar, perfil, asistencia, resultados y votos.
import { esc } from "./util.js";
import { api, friendly } from "./cloud.js";
import { POS, ATTRS } from "./views/plantel.js";
import { nextMatch, sorted, versus, whenText } from "./matches.js";

const sheet = () => document.getElementById("sheet");
const ANS = [["va", "Voy"], ["duda", "Duda"], ["no", "No voy"]];
const active = (ctx) => ctx.team.roster.filter((r) => r.status !== "congelado" && ctx.playersById[r.player]);
const nameOf = (ctx, id) => (ctx.playersById[id] || {}).name || id;

function open(title, sub, body) {
  const h = sheet();
  h.innerHTML = `<div class="bd" data-cl="close"></div><div class="sp cl" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sp-h"><div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ""}</div><button type="button" class="x" data-cl="close" aria-label="Cerrar">×</button></div>
    <div class="cl-body">${body}</div><p class="msg" role="alert" hidden></p></div>`;
  h.hidden = false;
  const f = h.querySelector("input, select, button.btn"); if (f) f.focus();
}
const close = () => { const h = sheet(); h.hidden = true; h.innerHTML = ""; };
const say = (t) => { const m = sheet().querySelector(".msg"); if (m) { m.textContent = t; m.hidden = !t; } };

// ---------- Tarjetas dentro de las vistas ----------
function accountCard(ctx) {
  const L = ctx.live;
  if (L.error) return `<section class="s cl-card"><h2>Tu cuenta</h2><p class="hint">No se pudo conectar con el servidor. Revisa tu conexión.</p></section>`;
  if (!L.user) return `<section class="s cl-card"><h2>Entra al equipo</h2><p>Con tu cuenta confirmas asistencia, calificas a tus compañeros y subes tu foto.</p>
    <div class="row-acts"><button type="button" class="btn" data-cl="auth-up">Crear cuenta</button><button type="button" class="btn ghost" data-cl="auth-in">Ya tengo cuenta</button></div></section>`;
  if (!L.member) return `<section class="s cl-card"><h2>Elige tu nombre</h2><p>Dinos quién eres en ${esc(ctx.team.name)}. Metra aprobará tu solicitud.</p>
    <div class="row-acts"><button type="button" class="btn" data-cl="join">Elegir mi nombre</button><button type="button" class="btn ghost" data-cl="out">Salir</button></div></section>`;
  if (L.member.status === "pending") return `<section class="s cl-card"><h2>Solicitud enviada</h2><p>Esperando que el administrador apruebe a <b>${esc(L.member.display_name)}</b>. Vuelve a abrir la app en un rato.</p>
    <div class="row-acts"><button type="button" class="btn ghost" data-cl="out">Salir</button></div></section>`;
  if (L.member.status === "rejected") return `<section class="s cl-card"><h2>Solicitud no aprobada</h2><p>Habla con el administrador del equipo.</p><div class="row-acts"><button type="button" class="btn ghost" data-cl="out">Salir</button></div></section>`;
  return `<section class="s cl-card"><div class="cl-who"><b>${esc(L.member.display_name)}</b><span>${L.admin ? "Administrador" : "Jugador"}</span></div>
    <div class="row-acts">${L.member.player_id ? '<button type="button" class="btn" data-cl="profile">Mi foto y posiciones</button>' : ""}${L.admin ? '<button type="button" class="btn" data-cl="admin">Panel de administrador</button>' : ""}<button type="button" class="btn ghost" data-cl="out">Salir</button></div></section>`;
}

function availCard(ctx) {
  const L = ctx.live, nx = nextMatch(ctx.team);
  if (!L.approved || !nx) return "";
  const rows = L.avail.filter((a) => a.match_id === nx.id), mine = rows.find((a) => a.user_id === L.member.user_id);
  const by = (k) => rows.filter((a) => a.answer === k);
  const names = (k) => by(k).map((a) => nameOf(ctx, a.player_id)).join(", ");
  const left = active(ctx).length - rows.length;
  return `<section class="s cl-card"><h2>¿Vas al partido?</h2>
    <div class="ans" role="group" aria-label="Asistencia">${ANS.map(([k, t]) => `<button type="button" class="${mine && mine.answer === k ? "on" : ""}" aria-pressed="${!!mine && mine.answer === k}" data-cl="avail" data-v="${k}">${t}</button>`).join("")}</div>
    <p class="hint"><b>${by("va").length}</b> van · ${by("duda").length} en duda · ${by("no").length} no van${left > 0 ? " · " + left + " sin responder" : ""}</p>
    ${by("va").length ? `<details class="cl-list"><summary>Quiénes van</summary><p>${esc(names("va"))}</p>${by("duda").length ? `<p><b>Duda:</b> ${esc(names("duda"))}</p>` : ""}${by("no").length ? `<p><b>No van:</b> ${esc(names("no"))}</p>` : ""}</details>` : ""}</section>`;
}

function pendingVotes(ctx) {
  const L = ctx.live; if (!L.approved) return [];
  const out = [], me = L.member.player_id;
  sorted(ctx.team).forEach((m) => {
    if (m.cloud && me && (m.played || []).includes(me)) {
      const done = L.mine.rating.some((x) => x.match === m.id);
      out.push({ kind: "rate", m, done });
    }
    if (L.admin && !m.cloud && new Date(m.date) < new Date()) out.push({ kind: "result", m });
  });
  return out;
}

function matchesCard(ctx) {
  const L = ctx.live; if (!L.approved) return "";
  const rows = pendingVotes(ctx).filter((x) => x.kind === "result" || !x.done);
  if (!rows.length) return "";
  return `<section class="s cl-card"><h2>Pendiente</h2>${rows.map((x) => `<button type="button" class="cl-row" data-cl="${x.kind}" data-m="${esc(x.m.id)}"><span><b>${esc(versus(x.m, ctx.club.name))}</b><small>${esc(x.m.jornada || "")}</small></span><span class="chip due">${x.kind === "rate" ? "Calificar" : "Anotar resultado"}</span></button>`).join("")}</section>`;
}

function attrsCard(ctx) {
  const L = ctx.live; if (!L.approved || !L.member.player_id) return "";
  const others = active(ctx).filter((r) => r.player !== L.member.player_id);
  const done = new Set(L.mine.attr.map((a) => a.target));
  return `<section class="s cl-card"><h2>Evalúa a tus compañeros</h2><p>Califica velocidad, tiro, pase, regate, defensa y físico. Es anónimo y de eso sale la media de cada tarjeta.</p>
    <div class="row-acts"><button type="button" class="btn" data-cl="attrs">${done.size >= others.length ? "Revisar mis evaluaciones" : "Evaluar"} · ${done.size} de ${others.length}</button></div></section>`;
}

export function mount(root, ctx, view) {
  if (!ctx.live) return;
  const html = view === "inicio" ? accountCard(ctx) + availCard(ctx) : view === "partidos" ? matchesCard(ctx) : view === "plantel" ? attrsCard(ctx) : "";
  if (view === "inicio") {
    const hero = root.querySelector(".hero-match");
    const parts = availCard(ctx) + accountCard(ctx);
    if (hero) hero.insertAdjacentHTML("afterend", parts); else root.insertAdjacentHTML("afterbegin", parts);
  } else if (html) root.insertAdjacentHTML("afterbegin", html);
  if (view === "partidos" && !ctx.live.user) root.insertAdjacentHTML("afterbegin", `<section class="s cl-card"><p class="hint">Entra desde Inicio para calificar los partidos.</p></section>`);
  root.addEventListener("click", (e) => { const t = e.target.closest("[data-cl]"); if (t && !t.closest("#sheet")) act(ctx, t.dataset.cl, t); });
}

// ---------- Acciones ----------
let wired = false;
const reload = () => { window.__reload && window.__reload(); };
export function wireSheet(ctxGet) {
  if (wired) return; wired = true;
  sheet().addEventListener("click", (e) => { const t = e.target.closest("[data-cl]"); if (t && t.closest(".cl, .bd")) act(ctxGet(), t.dataset.cl, t); });
  sheet().addEventListener("submit", (e) => { e.preventDefault(); const f = e.target.closest("form[data-form]"); if (f) act(ctxGet(), "submit-" + f.dataset.form, f); });
}

async function guard(fn) { try { say(""); await fn(); } catch (e) { say(friendly(e)); } }

function act(ctx, a, el) {
  const c = ctx.clubId, t = ctx.team.id;
  if (a === "close") return close();
  if (a === "auth-in" || a === "auth-up") return authSheet(a === "auth-up");
  if (a === "submit-auth") return guard(async () => {
    const f = new FormData(el), up = el.dataset.up === "1";
    await (up ? api.signUp(f.get("email").trim().toLowerCase(), f.get("pw")) : api.signIn(f.get("email").trim().toLowerCase(), f.get("pw")));
    close(); reload();
  });
  if (a === "out") return guard(async () => { await api.signOut(); reload(); });
  if (a === "join") return guard(async () => joinSheet(ctx, await api.claimed(c, t)));
  if (a === "submit-join") return guard(async () => {
    const f = new FormData(el), pid = f.get("pid") || "", nm = pid ? nameOf(ctx, pid) : (f.get("nm") || "").trim();
    await api.join(c, t, pid, nm); close(); reload();
  });
  if (a === "avail") return guard(async () => { await api.setAvail(c, t, nextMatch(ctx.team).id, el.dataset.v); reload(); });
  if (a === "profile") return profileSheet(ctx);
  if (a === "submit-profile") return guard(async () => {
    const f = new FormData(el), file = el.querySelector("input[type=file]").files[0];
    const photo = file ? await shrink(file) : null;
    await api.saveProfile(c, ctx.live.member.player_id, { positions: f.getAll("pos"), photo }); close(); reload();
  });
  if (a === "admin") return guard(async () => adminSheet(ctx, await api.pending(c, t)));
  if (a === "ok" || a === "no") return guard(async () => { await api.decide(c, t, el.dataset.u, a === "ok" ? "approved" : "rejected"); adminSheet(ctx, await api.pending(c, t)); reload(true); });
  if (a === "result") return resultSheet(ctx, el.dataset.m);
  if (a === "submit-result") return guard(async () => {
    const f = new FormData(el), played = f.getAll("pl"), stats = {};
    played.forEach((p) => { const g = +f.get("g_" + p) || 0, s = +f.get("a_" + p) || 0; if (g || s) stats[p] = { g, a: s }; });
    await api.saveResult(c, t, { match: el.dataset.m, for: +f.get("sf"), against: +f.get("sa"), played, stats }); close(); reload();
  });
  if (a === "rate") return rateSheet(ctx, el.dataset.m);
  if (a === "submit-rate") return guard(async () => {
    const f = new FormData(el), scores = {};
    [...el.querySelectorAll("input[type=range]")].forEach((r) => { scores[r.dataset.t] = +r.value; });
    await api.saveMatchVotes(c, t, el.dataset.m, scores, f.get("mvp") || null); close(); reload();
  });
  if (a === "attrs") return attrsList(ctx);
  if (a === "attr") return attrSheet(ctx, el.dataset.p);
  if (a === "submit-attr") return guard(async () => {
    const v = {}; [...el.querySelectorAll("input[type=range]")].forEach((r) => { v[r.name] = +r.value; });
    await api.saveAttr(c, t, el.dataset.p, v);
    ctx.live.mine = await api.mine(c, t); attrsList(ctx); reload(false);
  });
}

function authSheet(up) {
  open(up ? "Crear cuenta" : "Entrar", up ? "Usa un correo que revises y una contraseña de 6 o más caracteres." : "", `<form data-form="auth" data-up="${up ? 1 : 0}" class="fld">
    <label>Correo<input name="email" type="email" inputmode="email" autocomplete="email" required></label>
    <label>Contraseña<input name="pw" type="password" minlength="6" autocomplete="${up ? "new-password" : "current-password"}" required></label>
    <button class="btn" type="submit">${up ? "Crear cuenta" : "Entrar"}</button>
    <button type="button" class="link" data-cl="${up ? "auth-in" : "auth-up"}">${up ? "Ya tengo cuenta" : "No tengo cuenta"}</button></form>`);
}

function joinSheet(ctx, claimed) {
  const free = active(ctx).map((r) => ctx.playersById[r.player]).filter((p) => !claimed.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, "es"));
  open("¿Quién eres?", "Elige tu nombre en " + ctx.team.name, `<form data-form="join" class="fld">
    <div class="pickgrid">${free.map((p) => `<label class="opt"><input type="radio" name="pid" value="${esc(p.id)}"><span>${esc(p.name)}</span></label>`).join("")}</div>
    <p class="hint">¿No estás en la lista? Escribe tu nombre:</p><input name="nm" placeholder="Tu nombre" autocomplete="name">
    <button class="btn" type="submit">Pedir entrada</button></form>`);
}

function profileSheet(ctx) {
  const p = ctx.playersById[ctx.live.member.player_id] || {};
  open("Mi perfil", "Tu foto sale en tu tarjeta. Al subirla aceptas que la vea tu equipo.", `<form data-form="profile" class="fld">
    <label>Foto (de frente, cuadrada)<input type="file" accept="image/*"></label>
    <span class="lbl">Posiciones donde juegas</span>
    <div class="pickgrid">${Object.entries(POS).map(([k, n]) => `<label class="opt"><input type="checkbox" name="pos" value="${k}"${(p.positions || []).includes(k) ? " checked" : ""}><span>${esc(n)}</span></label>`).join("")}</div>
    <button class="btn" type="submit">Guardar</button></form>`);
}

async function adminSheet(ctx, pending) {
  const miss = sorted(ctx.team).filter((m) => !m.cloud && new Date(m.date) < new Date());
  open("Panel de administrador", ctx.team.name, `<span class="lbl">Solicitudes para entrar (${pending.length})</span>
    ${pending.map((m) => `<div class="cl-row static"><span><b>${esc(m.display_name)}</b><small>${m.player_id ? "Dice ser " + esc(nameOf(ctx, m.player_id)) : "No está en la lista"}</small></span>
      <span class="acts"><button type="button" class="btn" data-cl="ok" data-u="${esc(m.user_id)}">Aprobar</button><button type="button" class="btn ghost" data-cl="no" data-u="${esc(m.user_id)}">Rechazar</button></span></div>`).join("") || '<p class="hint">No hay solicitudes pendientes.</p>'}
    <span class="lbl">Partidos sin resultado</span>
    ${miss.map((m) => `<button type="button" class="cl-row" data-cl="result" data-m="${esc(m.id)}"><span><b>${esc(versus(m, ctx.club.name))}</b><small>${esc(m.jornada || "")}</small></span><span class="chip due">Anotar</span></button>`).join("") || '<p class="hint">No hay partidos pendientes de resultado.</p>'}`);
}

function resultSheet(ctx, mid) {
  const m = ctx.team.matches.find((x) => x.id === mid), rows = active(ctx);
  open("Resultado", versus(m, ctx.club.name) + " · " + whenText(m.date), `<form data-form="result" data-m="${esc(mid)}" class="fld">
    <div class="score"><label>${esc(ctx.club.name)}<input name="sf" type="number" min="0" max="99" inputmode="numeric" required></label><label>${esc(m.rival)}<input name="sa" type="number" min="0" max="99" inputmode="numeric" required></label></div>
    <span class="lbl">Quiénes jugaron (marca) y sus goles / asistencias</span>
    ${rows.map((r) => `<div class="pl"><label class="opt"><input type="checkbox" name="pl" value="${esc(r.player)}"><span>${esc(nameOf(ctx, r.player))}</span></label><input name="g_${esc(r.player)}" type="number" min="0" max="20" placeholder="G" aria-label="Goles"><input name="a_${esc(r.player)}" type="number" min="0" max="20" placeholder="A" aria-label="Asistencias"></div>`).join("")}
    <button class="btn" type="submit">Guardar resultado</button></form>`);
}

function rateSheet(ctx, mid) {
  const m = ctx.team.matches.find((x) => x.id === mid), me = ctx.live.member.player_id;
  const prev = Object.fromEntries(ctx.live.mine.rating.filter((x) => x.match === mid).map((x) => [x.target, x.score]));
  const pm = (ctx.live.mine.mvp.find((x) => x.match === mid) || {}).target;
  const who = (m.played || []).filter((p) => p !== me);
  open("Califica el partido", versus(m, ctx.club.name), `<form data-form="rate" data-m="${esc(mid)}" class="fld">
    <p class="hint">De 1 a 10 qué tanto aportó cada quien. Es anónimo.</p>
    ${who.map((p) => `<label class="rg"><span>${esc(nameOf(ctx, p))}<b>${prev[p] || 6}</b></span><input type="range" min="1" max="10" step="1" value="${prev[p] || 6}" data-t="${esc(p)}" oninput="this.previousElementSibling.lastChild.textContent=this.value"></label>`).join("")}
    <span class="lbl">Mejor del partido</span>
    <div class="pickgrid">${who.map((p) => `<label class="opt"><input type="radio" name="mvp" value="${esc(p)}"${pm === p ? " checked" : ""}><span>${esc(nameOf(ctx, p))}</span></label>`).join("")}</div>
    <button class="btn" type="submit">Enviar calificación</button></form>`);
}

function attrsList(ctx) {
  const me = ctx.live.member.player_id, done = new Set(ctx.live.mine.attr.map((a) => a.target));
  open("Evalúa a tus compañeros", "Toca un nombre. Lo ya evaluado se puede corregir.", active(ctx).filter((r) => r.player !== me).map((r) =>
    `<button type="button" class="cl-row" data-cl="attr" data-p="${esc(r.player)}"><span><b>${esc(nameOf(ctx, r.player))}</b></span><span class="chip ${done.has(r.player) ? "ok" : "due"}">${done.has(r.player) ? "Listo" : "Pendiente"}</span></button>`).join(""));
}

function attrSheet(ctx, pid) {
  const prev = ctx.live.mine.attr.find((a) => a.target === pid) || {};
  open(nameOf(ctx, pid), "1 es bajo y 10 es excelente", `<form data-form="attr" data-p="${esc(pid)}" class="fld">
    ${ATTRS.map(([k, , n]) => `<label class="rg"><span>${n}<b>${prev[k] || 6}</b></span><input type="range" min="1" max="10" step="1" name="${k}" value="${prev[k] || 6}" oninput="this.previousElementSibling.lastChild.textContent=this.value"></label>`).join("")}
    <button class="btn" type="submit">Guardar</button><button type="button" class="link" data-cl="attrs">Volver a la lista</button></form>`);
}

// Reduce la foto antes de subirla (celdas de 600 px, JPG)
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("foto"))), "image/jpeg", 0.82);
    };
    img.onerror = () => rej(new Error("No se pudo leer la foto"));
    img.src = url;
  });
}
