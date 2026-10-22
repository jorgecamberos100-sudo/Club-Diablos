// Mezcla los datos en vivo (resultados, votos, fotos) con los archivos del equipo.
import { on, init, api } from "./cloud.js";

export async function enrich(clubId, team, players) {
  if (!on) return { team, players, live: null };
  const live = { on: true, user: null, member: null, approved: false, admin: false, avail: [], mine: { attr: [], rating: [], mvp: [] }, error: null };
  let results = [], profiles = [], votes = { attr: [], rating: [], mvp: [] };
  try {
    await init();
    live.user = await api.user();
    [results, profiles] = await Promise.all([api.results(clubId, team.id), api.profiles(clubId)]);
    if (live.user) live.member = await api.membership(clubId, team.id);
    live.approved = !!live.member && live.member.status === "approved";
    live.admin = live.approved && live.member.role === "admin";
    if (live.approved) [votes, live.avail, live.mine] = await Promise.all([api.votes(clubId, team.id), api.avail(clubId, team.id), api.mine(clubId, team.id)]);
  } catch (e) { console.error(e); live.error = e; }

  const byMatch = Object.fromEntries(results.map((r) => [r.match_id, r]));
  const matches = (team.matches || []).map((m) => {
    const r = byMatch[m.id];
    if (!r) return m;
    return { ...m, score: { for: r.score_for, against: r.score_against }, played: r.played, stats: r.stats || {},
      ratings: votes.rating.filter((x) => x.match === m.id), mvp: votes.mvp.filter((x) => x.match === m.id), cloud: true };
  });
  const prof = Object.fromEntries(profiles.map((p) => [p.player_id, p]));
  const ps = players.map((p) => {
    const f = prof[p.id]; if (!f) return p;
    return { ...p, photo: f.photo_url || p.photo, positions: f.positions && f.positions.length ? f.positions : p.positions };
  });
  return { team: { ...team, matches, evaluations: (team.evaluations || []).concat(votes.attr) }, players: ps, live };
}
