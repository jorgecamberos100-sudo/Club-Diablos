// Página pública de liga y versión integrable (iframe). Solo lee datos públicos: no hay cuentas, notas ni datos de jugadores.
// Rutas: #/p/<liga>[/<torneo>/<tabla|calendario|goleo>]   y   #/embed/<liga>/<torneo>/<tabla|calendario|goleo>
import { esc } from "./util.js";
import { api, init, on } from "./cloud.js";
import { applyTheme } from "./theme.js";
import { themeFrom } from "./color.js";
import { standings, scorers } from "./league/standings.js";
import { dtime } from "./ui.js";

export const TABS = { tabla: "Tabla", calendario: "Calendario", goleo: "Goleo" };
const STATUS = { published: "En curso", paused: "En pausa", finished: "Terminado" };
const ERRBOX = (t, p) => `<div class="error"><h1>${esc(t)}</h1><p>${esc(p)}</p></div>`;

export function tablaHTML(t, d) {
  const rows = standings(t, d.teams, d.matches, d.events, d.adjust || []);
  if (!rows.length) return `<p class="hint">Todavía no hay equipos inscritos.</p>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Equipo</th><th title="Jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th><th title="Perdidos">P</th><th title="Goles a favor">GF</th><th title="Goles en contra">GC</th><th title="Diferencia">DG</th><th title="Puntos">Pts</th></tr></thead><tbody>${rows.map((r) =>
    `<tr><td>${r.pos}</td><td class="nm">${esc(r.name)}${r.withdrawn ? " (baja)" : ""}</td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.gf}</td><td>${r.gc}</td><td>${r.dg}</td><td><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div>`;
}

export function calendarioHTML(d) {
  const name = new Map(d.teams.map((x) => [x.id, x.name])), ms = d.matches.slice().sort((a, b) => (a.starts_at || "~").localeCompare(b.starts_at || "~"));
  if (!ms.length) return `<p class="hint">El calendario todavía no está publicado.</p>`;
  const groups = new Map(); ms.forEach((m) => { const k = m.round || "Partidos"; (groups.get(k) || groups.set(k, []).get(k)).push(m); });
  return [...groups].map(([r, list]) => `<h3>${esc(r)}</h3>` + list.map((m) => {
    const played = m.status === "played", sc = played ? `<b class="sc">${m.home_goals} - ${m.away_goals}</b>` : `<span class="sc">vs</span>`;
    const sub = [m.starts_at ? dtime(m.starts_at) : "", m.venue || "", m.status === "postponed" ? "Pospuesto" : m.status === "canceled" ? "Cancelado" : ""].filter(Boolean).join(" · ");
    return `<div class="cl-row static pm"><span><b>${esc(name.get(m.home_id) || "—")} ${sc} ${esc(name.get(m.away_id) || "—")}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></div>`;
  }).join("")).join("");
}

export function goleoHTML(d) {
  if (!d.scorers) return `<p class="hint">Esta liga no publica el goleo.</p>`;
  const sc = scorers(d.teams, d.matches, d.events);
  return sc.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr></thead><tbody>${sc.map((s, i) => `<tr><td>${i + 1}</td><td class="nm">${esc(s.player)}</td><td>${esc(s.team)}</td><td><b>${s.goals}</b></td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">Todavía no hay goles registrados.</p>`;
}

function brandTheme(lg) {
  applyTheme({ name: lg.name, theme: { colors: themeFrom(/^#[0-9a-f]{6}$/i.test(lg.brand.color) ? lg.brand.color : "#c8102e"), card: "recta", pattern: "liso" } });
  document.title = lg.name;
}

export async function renderPublic(app, [kind, l, tid, tab], { chatMount } = {}) {
  const embed = kind === "embed";
  document.body.classList.toggle("embed", embed);
  if (on) await init();
  let lg = null;
  try { lg = on && l ? await api.publicLeague(l) : null; } catch (e) { console.error(e); }
  if (!lg || lg.error) { applyTheme({ name: "Liga" }); app.innerHTML = ERRBOX("Página no disponible", "Esta liga no tiene página pública o aún no la ha activado."); return; }
  brandTheme(lg.league);
  const T = lg.tournaments;
  if (!tid && T.length && !embed) { location.replace(`#/p/${l}/${T[0].id}/tabla`); return; }
  const t0 = T.find((x) => x.id === tid);
  const head = embed ? "" : `<header class="top">${lg.league.brand.logo ? `<img class="top-cr" src="${esc(lg.league.brand.logo)}" alt="Logo de ${esc(lg.league.name)}">` : ""}<div class="top-t"><h1>${esc(lg.league.name)}</h1><p>${t0 ? esc(t0.name) + (t0.season ? " · " + esc(t0.season) : "") + (t0.category ? " · " + esc(t0.category) : "") : "Página pública"}</p></div></header>`;
  if (!t0) { app.innerHTML = head + `<div class="view"><section class="s cl-card"><h2>Torneos</h2>${T.length ? T.map((x) => `<a class="cl-row" href="#/p/${l}/${x.id}/tabla"><span><b>${esc(x.name)}</b><small>${esc([x.season, x.category, STATUS[x.status]].filter(Boolean).join(" · "))}</small></span></a>`).join("") : `<p class="hint">Todavía no hay torneos publicados.</p>`}</section></div>`; return; }
  const d = await api.publicTournament(l, tid);
  if (!d || d.error) { app.innerHTML = head + `<div class="view">${ERRBOX("Torneo no disponible", "Este torneo no está publicado.")}</div>`; return; }
  const cur = TABS[tab] ? tab : "tabla";
  const pre = embed ? "#/embed" : "#/p";
  const body = cur === "tabla" ? tablaHTML(d.tournament, d) : cur === "calendario" ? calendarioHTML(d) : goleoHTML(d);
  const switcher = T.length > 1 && !embed ? `<label class="fld-inline">Torneo<select class="pub-t" aria-label="Torneo">${T.map((x) => `<option value="${esc(x.id)}"${x.id === tid ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>` : "";
  app.innerHTML = head + `<div class="view pub">${switcher}<div class="seg-tabs" role="tablist">${Object.entries(TABS).map(([k, v]) => `<button type="button" role="tab" aria-selected="${k === cur}" data-pt="${k}">${v}</button>`).join("")}</div>
    <section class="s cl-card" aria-live="polite">${body}</section>${embed ? `<p class="hint pub-foot">${esc(lg.league.name)} · ${esc(d.tournament.name)}</p>` : ""}<div id="pub-chat"></div></div>`;
  app.querySelectorAll("[data-pt]").forEach((b) => (b.onclick = () => { location.hash = `${pre}/${l}/${tid}/${b.dataset.pt}`; }));
  const sel = app.querySelector(".pub-t"); if (sel) sel.onchange = () => { location.hash = `#/p/${l}/${sel.value}/${cur}`; };
  if (!embed && lg.chat && chatMount) chatMount(document.getElementById("pub-chat"), l, d);
}
