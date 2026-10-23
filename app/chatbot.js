// Asistente de preguntas de la página pública de una liga.
// REGLA: solo conoce lo que ya es público (lo que devuelve public_tournament). No tiene acceso a nada más.
// Motores intercambiables:
//   local   -> reglas sobre los datos públicos. Sin costo, sin servidor, sin inventar nada: si no sabe, lo dice.
//   server  -> un servicio propio con un modelo de lenguaje (ver docs/ASISTENTE.md). Recibe la pregunta y un contexto recortado.
//              El servicio es quien aplica el tope diario (chat_take); aquí solo se acotan tamaños.
import { esc } from "./util.js";
import { CHAT } from "./config.js";
import { standings, scorers } from "./league/standings.js";
import { hasGroups, groupTables, champion } from "./league/bracket.js";
import { dtime } from "./ui.js";

export const LIMITS = { question: 300, context: 6000, perSession: 30, gapMs: 1500 };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const has = (n, ...ws) => ws.some((w) => new RegExp("\\b" + w).test(n));
const NO = "No tengo ese dato. Puedo contestar sobre la tabla de posiciones, los próximos partidos, los últimos resultados y el goleo.";

// Datos mínimos y ordenados que ve cualquier motor.
export function view(d) {
  const t = d.tournament, name = new Map(d.teams.map((x) => [x.id, x.name]));
  // En grupos, la posición es dentro de su grupo; en eliminación directa no hay tabla.
  const rows = hasGroups(t) ? groupTables(t, d.teams, d.matches, d.events, d.adjust || []).flatMap((g) => g.rows.map((r) => ({ ...r, name: r.name, grp: g.group })))
    : t.format === "knockout" ? [] : standings(t, d.teams, d.matches, d.events, d.adjust || []);
  const played = d.matches.filter((m) => m.status === "played").sort((a, b) => (b.starts_at || "").localeCompare(a.starts_at || ""));
  const next = d.matches.filter((m) => m.status === "scheduled").sort((a, b) => (a.starts_at || "~").localeCompare(b.starts_at || "~"));
  return { t, name, rows, played, next, sc: d.scorers ? scorers(d.teams, d.matches, d.events) : null };
}

const line = (v, m) => `${v.name.get(m.home_id)} ${m.status === "played" ? m.home_goals + " - " + m.away_goals : "vs"} ${v.name.get(m.away_id)}${m.round ? " (" + m.round + ")" : ""}${m.status !== "played" && m.starts_at ? ", " + dtime(m.starts_at) : ""}${m.venue ? ", " + m.venue : ""}`;

export function localAnswer(q, d) {
  const n = norm(q).slice(0, LIMITS.question);
  if (!n) return "Escribe tu pregunta.";
  const v = view(d), t = v.t;
  const team = [...v.name.values()].map((x) => [x, norm(x)]).filter(([, k]) => k && n.includes(k)).sort((a, b) => b[1].length - a[1].length)[0];
  const id = team && [...v.name].find(([, nm]) => nm === team[0])[0];
  const row = id && v.rows.find((r) => r.id === id);
  const mine = (ms) => ms.filter((m) => m.home_id === id || m.away_id === id);

  if (has(n, "goleador", "goleo", "maximo", "mas goles", "pichichi")) {
    if (!v.sc) return "Esta liga no publica el goleo.";
    return v.sc.length ? "Goleo: " + v.sc.slice(0, 3).map((s, i) => `${i + 1}. ${s.player} (${s.team}) ${s.goals}`).join("; ") + "." : "Todavía no hay goles registrados.";
  }
  if (has(n, "proxim", "siguiente", "cuando juega", "cuando es", "calendario", "que partidos", "juega")) {
    const list = (id ? mine(v.next) : v.next).slice(0, id ? 1 : 3);
    return list.length ? (id ? `El próximo partido de ${team[0]}: ` : "Próximos partidos: ") + list.map((m) => line(v, m)).join("; ") + "." : id ? `${team[0]} no tiene partidos pendientes en el calendario.` : "No hay partidos pendientes en el calendario.";
  }
  if (has(n, "ultimo", "resultado", "marcador", "como quedo", "como le fue", "gano", "perdio", "empato")) {
    const list = (id ? mine(v.played) : v.played).slice(0, id ? 1 : 3);
    return list.length ? (id ? `Último resultado de ${team[0]}: ` : "Últimos resultados: ") + list.map((m) => line(v, m)).join("; ") + "." : "Todavía no hay resultados registrados.";
  }
  if (has(n, "puntos por", "desempate", "reglamento", "como se desempata")) {
    return `Victoria ${t.pts_win}, empate ${t.pts_draw}, derrota ${t.pts_loss}.` + ((t.tiebreakers || []).length ? " Desempates en orden: " + t.tiebreakers.join(", ") + "." : "");
  }
  if (row && has(n, "punto", "lugar", "posicion", "va ", "como va", "tabla", "clasific", "esta")) {
    return `${row.name} va en el lugar ${row.pos}${row.grp ? " del grupo " + row.grp : ""} con ${row.pts} punto${row.pts === 1 ? "" : "s"} (${row.pj} jugado${row.pj === 1 ? "" : "s"}, ${row.g} ganado${row.g === 1 ? "" : "s"}, ${row.e} empatado${row.e === 1 ? "" : "s"}, ${row.p} perdido${row.p === 1 ? "" : "s"}; goles ${row.gf} a favor y ${row.gc} en contra).`;
  }
  if (has(n, "campeon", "gano el torneo", "ganador del torneo")) { const c = champion(d.matches); return c ? `El campeón es ${v.name.get(c)}.` : "Todavía no hay campeón."; }
  if (has(n, "lider", "primero", "primer lugar", "quien va", "tabla", "posicion", "clasific", "punta")) {
    if (!v.rows.length) return t.format === "knockout" ? "Este torneo es de eliminación directa: no hay tabla. Pregúntame por los próximos partidos o el campeón." : "Todavía no hay equipos en la tabla.";
    if (v.rows.some((r) => r.grp)) return "Líderes de grupo: " + v.rows.filter((r) => r.pos === 1).map((r) => `grupo ${r.grp}: ${r.name} (${r.pts} pts)`).join("; ") + ".";
    return "Tabla: " + v.rows.slice(0, 3).map((r) => `${r.pos}. ${r.name} (${r.pts} pts)`).join("; ") + (v.rows.length > 3 ? `; hay ${v.rows.length} equipos en total.` : ".");
  }
  if (row) return `${row.name} va en el lugar ${row.pos} con ${row.pts} puntos. Pregúntame también por su próximo partido o su último resultado.`;
  return NO;
}

// Contexto recortado para un motor externo: solo datos públicos, con tope de tamaño.
export function compactContext(d) {
  const v = view(d), m = (x) => ({ local: v.name.get(x.home_id), visitante: v.name.get(x.away_id), jornada: x.round, fecha: x.starts_at, cancha: x.venue, goles: x.status === "played" ? [x.home_goals, x.away_goals] : null });
  const ctx = { torneo: v.t.name, puntos: { victoria: v.t.pts_win, empate: v.t.pts_draw, derrota: v.t.pts_loss },
    tabla: v.rows.map((r) => ({ pos: r.pos, equipo: r.name, pj: r.pj, pts: r.pts, dg: r.dg })), proximos: v.next.slice(0, 10).map(m), resultados: v.played.slice(0, 10).map(m), goleo: v.sc ? v.sc.slice(0, 5).map((s) => ({ jugador: s.player, equipo: s.team, goles: s.goals })) : "no publicado" };
  let s = JSON.stringify(ctx);
  while (s.length > LIMITS.context && (ctx.tabla.length > 5 || ctx.proximos.length || ctx.resultados.length)) {
    if (ctx.resultados.length) ctx.resultados.pop(); else if (ctx.proximos.length) ctx.proximos.pop(); else ctx.tabla.pop(); s = JSON.stringify(ctx);
  }
  return s.slice(0, LIMITS.context);
}

export async function serverAnswer(url, league, q, d, fetchFn = fetch) {
  const r = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ league, question: String(q).slice(0, LIMITS.question), context: compactContext(d) }) });
  if (r.status === 429) throw new Error("limit");
  if (!r.ok) throw new Error("El asistente no respondió (" + r.status + ").");
  const j = await r.json(); if (!j || typeof j.answer !== "string") throw new Error("El asistente respondió algo inesperado.");
  return j.answer.slice(0, 1200);
}

export async function answer(q, league, d, fetchFn) {
  if (CHAT && CHAT.server) {
    try { return { text: await serverAnswer(CHAT.server, league, q, d, fetchFn), engine: "server" }; }
    catch (e) { if (e.message === "limit") return { text: "Se agotaron las preguntas de hoy para este asistente. " + localAnswer(q, d), engine: "local" }; console.error(e); }
  }
  return { text: localAnswer(q, d), engine: "local" };
}

// ---------- Interfaz ----------
export function mountChat(el, league, d) {
  let n = 0, last = 0;
  const ideas = ["¿Quién va primero?", "¿Cuándo es el próximo partido?", "¿Cómo quedaron los últimos partidos?", ...(d.scorers ? ["¿Quién es el goleador?"] : [])];
  el.innerHTML = `<section class="s cl-card chat"><h2>Pregúntale a la liga</h2><div class="chat-log" role="log" aria-live="polite"></div>
    <div class="chat-ideas">${ideas.map((i) => `<button type="button" class="btn sm ghost" data-q="${esc(i)}">${esc(i)}</button>`).join("")}</div>
    <form class="chat-form"><input name="q" maxlength="${LIMITS.question}" placeholder="Escribe tu pregunta" aria-label="Tu pregunta" autocomplete="off"><button class="btn" type="submit">Preguntar</button></form>
    <p class="hint">Solo responde con lo que ya está publicado en esta página. Puede equivocarse: confirma con tu liga.</p></section>`;
  const log = el.querySelector(".chat-log"), form = el.querySelector("form");
  const say = (who, text) => { log.insertAdjacentHTML("beforeend", `<p class="chat-${who}">${esc(text)}</p>`); log.scrollTop = log.scrollHeight; };
  async function ask(q) {
    q = q.trim(); if (!q) return;
    if (n >= LIMITS.perSession) return say("bot", "Llegaste al máximo de preguntas de esta visita. Vuelve a abrir la página para seguir.");
    if (Date.now() - last < LIMITS.gapMs) return say("bot", "Un momento, estoy respondiendo la anterior.");
    n++; last = Date.now(); say("me", q);
    const r = await answer(q, league, d); say("bot", r.text);
  }
  form.onsubmit = (e) => { e.preventDefault(); const i = form.q; const q = i.value; i.value = ""; ask(q); };
  el.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { last = 0; ask(b.dataset.q); }));
}
