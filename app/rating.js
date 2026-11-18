// Sistema de calificación de jugadores.
//
// Tres fuentes, todas votadas por los compañeros (nadie se califica a sí mismo):
//  1. Evaluación de atributos (1 a 10): cada jugador califica velocidad, tiro, pase,
//     regate, defensa y físico de sus compañeros. Se hace al inicio y a mitad de temporada.
//  2. Calificación de partido (1 a 10): al terminar cada partido, los que jugaron se
//     califican entre sí y votan al mejor del partido.
//  3. Compromiso: porcentaje de partidos jugados.
//
// Media = 50% atributos + 40% forma (últimos 5 partidos) + 10% compromiso,
// en escala 40 a 99. Con 5 votos o más se quitan el más alto y el más bajo,
// para que ni los amigos ni los enemigos muevan el número. Con menos de 3 votos no cuenta.

export const DEFAULT_CFG = { weights: { atributos: 0.5, forma: 0.4, compromiso: 0.1 }, minVotes: 3, formMatches: 5, trimFrom: 5 };
export const ATTR_KEYS = ["vel", "tir", "pas", "reg", "def", "fis"];

const to99 = (x) => Math.round(40 + ((x - 1) * 59) / 9); // 1..10 -> 40..99
const mean = (a) => (a && a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function robust(votes, cfg) {
  if (!Array.isArray(votes)) return null;
  const v = votes.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < (cfg?.minVotes ?? DEFAULT_CFG.minVotes)) return null;
  const trim = (cfg?.trimFrom ?? DEFAULT_CFG.trimFrom);
  return mean(v.length > 2 && v.length >= trim ? v.slice(1, -1) : v);
}

export function computeRatings(team, players, cfgIn) {
  if (!team || !Array.isArray(players)) return {};
  const cfg = { ...DEFAULT_CFG, ...(cfgIn || {}), weights: { ...DEFAULT_CFG.weights, ...((cfgIn || {}).weights || {}) } };
  const out = {};
  const evals = Array.isArray(team.evaluations) ? team.evaluations : [];
  const matches = (Array.isArray(team.matches) ? team.matches : []).filter((m) => m && m.score).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  players.forEach((p) => {
    if (!p || !p.id) return;
    // 1. atributos
    let attrs = null;
    const mine = evals.filter((e) => e && e.target === p.id && e.voter && e.voter !== p.id);
    if (mine.length) {
      const a = {};
      ATTR_KEYS.forEach((k) => { const r = robust(mine.map((e) => e[k]), cfg); if (r != null) a[k] = to99(r); });
      if (Object.keys(a).length === ATTR_KEYS.length) attrs = a;
    }
    if (!attrs && p.attrs && ATTR_KEYS.every((k) => typeof p.attrs[k] === "number" && Number.isFinite(p.attrs[k]))) attrs = p.attrs; // valores fijados a mano

    // 2. forma
    const perMatch = [];
    let played = 0, mvps = 0, goals = 0, assists = 0;
    matches.forEach((m) => {
      if (!Array.isArray(m.played) || !m.played.includes(p.id)) return;
      played++;
      const ratings = Array.isArray(m.ratings) ? m.ratings : [];
      const r = robust(ratings.filter((x) => x && x.target === p.id && x.voter && x.voter !== p.id).map((x) => x.score), cfg);
      if (r != null) perMatch.push({ id: m.id, r });
      if (mvpOf(m) === p.id) mvps++;
      const st = (m.stats || {})[p.id];
      if (st) { goals += st.g || 0; assists += st.a || 0; }
    });
    const recent = perMatch.slice(-cfg.formMatches);
    const forma = recent.length ? to99(mean(recent.map((x) => x.r))) : null;

    // 3. compromiso
    const compromiso = matches.length ? Math.round(40 + 59 * (played / matches.length)) : null;

    // media
    const parts = [];
    if (attrs) parts.push([mean(ATTR_KEYS.map((k) => attrs[k])), cfg.weights.atributos]);
    if (forma != null) parts.push([forma, cfg.weights.forma]);
    if (parts.length && compromiso != null) parts.push([compromiso, cfg.weights.compromiso]);
    const wsum = parts.reduce((s, [, w]) => s + w, 0);
    const media = parts.length && wsum > 0 ? Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / wsum) : null;

    const last = perMatch.length ? to99(perMatch[perMatch.length - 1].r) : null;
    const trend = media != null && last != null ? (last >= media + 3 ? 1 : last <= media - 3 ? -1 : 0) : 0;

    out[p.id] = { attrs, forma, compromiso, media, played, mvps, goals, assists, trend, matchScores: Object.fromEntries(perMatch.map((x) => [x.id, Math.round(x.r * 10) / 10])) };
  });
  return out;
}

export function mvpOf(m) {
  if (!m || !Array.isArray(m.mvp)) return null;
  const votes = m.mvp.filter((v) => v && v.voter && v.target && v.voter !== v.target);
  if (votes.length < DEFAULT_CFG.minVotes) return null;
  const c = {};
  votes.forEach((v) => { c[v.target] = (c[v.target] || 0) + 1; });
  const best = Object.entries(c).sort((a, b) => b[1] - a[1]);
  return best.length && (best.length === 1 || best[0][1] > best[1][1]) ? best[0][0] : null;
}

export const tierOf = (o) => (typeof o !== "number" || !Number.isFinite(o) ? "t-club" : o >= 75 ? "t-oro" : o >= 65 ? "t-plata" : "t-bronce");
