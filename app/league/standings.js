// Tabla de posiciones y goleo. Funciones puras: reciben datos, devuelven datos (se prueban sin navegador).
// Los criterios de desempate son configurables por torneo y se aplican en orden sobre los equipos empatados en puntos.
export const TIEBREAKERS = {
  dg: "Diferencia de goles",
  gf: "Goles a favor",
  wins: "Partidos ganados",
  gc_low: "Menos goles en contra",
  h2h: "Enfrentamiento directo",
  fairplay: "Juego limpio (menos tarjetas)",
  alpha: "Orden alfabético",
};
export const FAIR = { yellow: 1, red: 3 };   // puntos de indisciplina: menos es mejor

const blank = (t) => ({ id: t.id, name: t.name, withdrawn: t.status === "withdrawn", pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0, fair: 0 });

function tally(teams, matches, events, rules, only) {
  const R = new Map(teams.filter((t) => !only || only.has(t.id)).map((t) => [t.id, blank(t)]));
  for (const m of matches) {
    if (m.status !== "played" || !R.has(m.home_id) || !R.has(m.away_id)) continue;
    const h = R.get(m.home_id), a = R.get(m.away_id), hg = +m.home_goals, ag = +m.away_goals;
    h.pj++; a.pj++; h.gf += hg; h.gc += ag; a.gf += ag; a.gc += hg;
    if (hg > ag) { h.g++; a.p++; h.pts += rules.pts_win; a.pts += rules.pts_loss; }
    else if (hg < ag) { a.g++; h.p++; a.pts += rules.pts_win; h.pts += rules.pts_loss; }
    else { h.e++; a.e++; h.pts += rules.pts_draw; a.pts += rules.pts_draw; }
  }
  const played = new Set(matches.filter((m) => m.status === "played").map((m) => m.id));
  for (const e of events || []) {
    if (!played.has(e.match_id) || !FAIR[e.kind]) continue;
    if (!only || (matches.find((m) => m.id === e.match_id) && only.has(e.team_id) )) { const r = R.get(e.team_id); if (r) r.fair += FAIR[e.kind] * (e.n || 1); }
  }
  for (const r of R.values()) r.dg = r.gf - r.gc;
  return R;
}

// Separa un grupo empatado en subgrupos ordenados según un criterio. Devuelve lista de grupos (cada grupo sigue empatado).
function split(group, crit, ctx) {
  const by = (fn, dir) => {   // dir 1 = mayor es mejor, -1 = menor es mejor
    const keys = [...new Set(group.map(fn))].sort((x, y) => (y - x) * dir);
    return keys.map((k) => group.filter((r) => fn(r) === k));
  };
  switch (crit) {
    case "dg": return by((r) => r.dg, 1);
    case "gf": return by((r) => r.gf, 1);
    case "wins": return by((r) => r.g, 1);
    case "gc_low": return by((r) => r.gc, -1);
    case "fairplay": return by((r) => r.fair, -1);
    case "alpha": return group.slice().sort((a, b) => a.name.localeCompare(b.name, "es")).map((r) => [r]);
    case "h2h": {
      if (group.length < 2) return [group];
      const ids = new Set(group.map((r) => r.id));
      const mini = tally(ctx.teams, ctx.matches.filter((m) => ids.has(m.home_id) && ids.has(m.away_id)), [], ctx.rules, ids);
      const score = (r) => { const x = mini.get(r.id); return x.pts * 1e6 + (x.dg + 500) * 1e3 + x.gf; };   // puntos, luego diferencia, luego goles entre ellos
      return by(score, 1);
    }
    default: return [group];
  }
}

export function standings(tournament, teams, matches, events = [], adjust = []) {
  const rules = { pts_win: tournament.pts_win ?? 3, pts_draw: tournament.pts_draw ?? 1, pts_loss: tournament.pts_loss ?? 0 };
  const ctx = { teams, matches, rules };
  const R = tally(teams, matches, events, rules);
  for (const a of adjust) { const r = R.get(a.team_id); if (r) { r.pts -= a.points; r.adj = (r.adj || 0) - a.points; } }   // descuentos por sanción
  const rows = [...R.values()];
  const crits = (tournament.tiebreakers || []).filter((c) => TIEBREAKERS[c]);
  if (!crits.includes("alpha")) crits.push("alpha");        // al final, para que el orden sea siempre el mismo
  const groups = [];
  const byPts = [...new Set(rows.map((r) => r.pts))].sort((a, b) => b - a);
  const resolve = (g, i) => {                               // aplica los criterios uno tras otro solo a quienes siguen empatados
    if (g.length < 2 || i >= crits.length) return g.slice();
    return split(g, crits[i], ctx).flatMap((sub) => (sub.length > 1 ? resolve(sub, i + 1) : sub));
  };
  for (const p of byPts) groups.push(...resolve(rows.filter((r) => r.pts === p), 0));
  return groups.map((r, i) => ({ ...r, pos: i + 1 }));
}

// Goleo: solo goles a favor de jugadores (los autogoles no cuentan). Un mismo nombre en dos equipos son dos jugadores.
export function scorers(teams, matches, events) {
  const played = new Set(matches.filter((m) => m.status === "played").map((m) => m.id));
  const name = new Map(teams.map((t) => [t.id, t.name]));
  const S = new Map();
  for (const e of events || []) {
    if (e.kind !== "goal" || !played.has(e.match_id)) continue;
    const k = e.team_id + "|" + e.player.trim().toLowerCase();
    const s = S.get(k) || { player: e.player.trim(), team_id: e.team_id, team: name.get(e.team_id) || "", goals: 0 };
    s.goals += e.n || 1; S.set(k, s);
  }
  return [...S.values()].sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player, "es"));
}

// Jornadas de todos contra todos (método del círculo). vueltas = 1 o 2 (ida y vuelta). Devuelve [{round, home, away}].
export function roundRobin(ids, vueltas = 1) {
  const t = ids.slice(); if (t.length % 2) t.push(null);
  const n = t.length, out = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) out.push({ round: "J" + (r + 1), home: r % 2 ? b : a, away: r % 2 ? a : b });
    }
    t.splice(1, 0, t.pop());
  }
  if (vueltas === 2) { const k = n - 1; out.push(...out.slice().map((m) => ({ round: "J" + (+m.round.slice(1) + k), home: m.away, away: m.home }))); }
  return out;
}
