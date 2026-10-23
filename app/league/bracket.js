// Grupos y eliminatorias: cálculos puros (sin pantalla ni base de datos), con pruebas en tests/unit/test_bracket.mjs.
// La base de datos vuelve a validar lo importante (equipos del grupo correcto, ganadores de la ronda anterior, penales).
import { standings, roundRobin } from "./standings.js";

export const GROUPS = "ABCDEFGH";
export const FORMATS = { league: "Liga (todos contra todos)", groups: "Grupos", knockout: "Eliminación directa", groups_knockout: "Grupos y eliminación directa" };
export const hasGroups = (t) => t.format === "groups" || t.format === "groups_knockout";
export const hasKO = (t) => t.format === "knockout" || t.format === "groups_knockout";
export const isPow2 = (n) => n >= 2 && (n & (n - 1)) === 0;

// Reparte equipos en n grupos "en serpiente" según el orden recibido (1º a A, 2º a B, …, luego de regreso), para equilibrar.
export function drawGroups(ids, n) {
  const out = {}; if (n < 1) return out;
  ids.forEach((id, i) => { const r = Math.floor(i / n), k = i % n; out[id] = GROUPS[r % 2 ? n - 1 - k : k]; });
  return out;
}

// Partidos de todos contra todos dentro de cada grupo. teams: [{id, group_label}]
export function groupFixtures(teams, vueltas = 1) {
  const by = {}; teams.forEach((t) => t.group_label && (by[t.group_label] ||= []).push(t.id));
  return Object.keys(by).sort().flatMap((g) => roundRobin(by[g], vueltas).map((m) => ({ ...m, stage: "group", group: g })));
}

// Una tabla por grupo, con los mismos criterios de desempate del torneo. Solo cuentan partidos de grupo.
export function groupTables(t, teams, matches, events = [], adjust = []) {
  const gs = [...new Set(teams.map((x) => x.group_label).filter(Boolean))].sort();
  return gs.map((g) => {
    const tm = teams.filter((x) => x.group_label === g), ids = new Set(tm.map((x) => x.id));
    const ms = matches.filter((m) => m.stage === "group" && m.group_label === g);
    const ev = events.filter((e) => ms.some((m) => m.id === e.match_id));
    return { group: g, rows: standings(t, tm, ms, ev, adjust.filter((a) => ids.has(a.team_id))) };
  });
}

export const groupsDone = (matches) => matches.some((m) => m.stage === "group") && matches.filter((m) => m.stage === "group" && m.status !== "canceled").every((m) => m.status === "played");

// Clasificados en orden de siembra: todos los primeros (A, B, …), luego todos los segundos, etc.
export function qualifiers(tables, advance) {
  const out = [];
  for (let p = 0; p < advance; p++) tables.forEach((g) => { const r = g.rows.filter((x) => !x.withdrawn)[p]; if (r) out.push({ id: r.id, group: g.group, pos: p + 1 }); });
  return out;
}

// Orden clásico de llaves: el 1 y el 2 solo se pueden cruzar en la final. bracketOrder(8) = [1,8,4,5,2,7,3,6]
export function bracketOrder(n) {
  let o = [1];
  while (o.length < n) { const m = o.length * 2 + 1; o = o.flatMap((s) => [s, m - s]); }
  return o;
}

// Primera ronda a partir de una lista sembrada (ids). Devuelve [{home, away, ko_round:1, ko_slot}]. Exige potencia de 2.
export function firstRound(seeded) {
  const n = seeded.length; if (!isPow2(n)) throw new Error("Para la eliminatoria se necesitan 2, 4, 8, 16 o 32 equipos");
  const o = bracketOrder(n), out = [];
  for (let i = 0; i < n; i += 2) out.push({ home: seeded[o[i] - 1], away: seeded[o[i + 1] - 1], ko_round: 1, ko_slot: i / 2 + 1 });
  return out;
}

// Ganador de un partido de eliminatoria (goles y, si empatan, penales). null si no se ha jugado.
export function koWinner(m) {
  if (!m || m.status !== "played") return null;
  if (m.home_goals !== m.away_goals) return m.home_goals > m.away_goals ? m.home_id : m.away_id;
  if (m.home_pens == null || m.away_pens == null || m.home_pens === m.away_pens) return null;
  return m.home_pens > m.away_pens ? m.home_id : m.away_id;
}

export const roundName = (nMatches) => ({ 1: "Final", 2: "Semifinal", 4: "Cuartos", 8: "Octavos", 16: "Dieciseisavos" })[nMatches] || "Ronda";

// Rondas de la eliminatoria, ordenadas, con su nombre.
export function koRounds(matches) {
  const ko = matches.filter((m) => m.stage === "knockout" && m.status !== "canceled"), by = {};
  ko.forEach((m) => (by[m.ko_round] ||= []).push(m));
  return Object.keys(by).map(Number).sort((a, b) => a - b).map((r) => ({ round: r, name: roundName(by[r].length), matches: by[r].sort((a, b) => a.ko_slot - b.ko_slot) }));
}

// Siguiente ronda: los ganadores de las llaves 1-2, 3-4, … Devuelve [] si falta algún resultado o ya terminó.
export function nextRound(matches) {
  const rs = koRounds(matches); if (!rs.length) return [];
  const last = rs[rs.length - 1]; if (last.matches.length < 2) return [];
  const w = last.matches.map(koWinner); if (w.some((x) => !x)) return [];
  const out = [];
  for (let i = 0; i < w.length; i += 2) out.push({ home: w[i], away: w[i + 1], ko_round: last.round + 1, ko_slot: i / 2 + 1 });
  return out;
}

export const champion = (matches) => { const rs = koRounds(matches), f = rs[rs.length - 1]; return f && f.matches.length === 1 ? koWinner(f.matches[0]) : null; };
