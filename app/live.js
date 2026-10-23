// Mezcla los datos en vivo (resultados, votos, fotos, pagos) con los archivos del equipo.
import { on, init, api } from "./cloud.js";

export async function enrich(clubId, team, players) {
  if (!on) return { team, players, live: null };
  const live = { on: true, user: null, member: null, approved: false, admin: false, avail: [], mine: { attr: [], rating: [], mvp: [] },
    myPays: [], pendingPays: [], pendingMembers: [], error: null };
  let results = [], profiles = [], votes = { attr: [], rating: [], mvp: [] }, paid = [];
  try {
    await init();
    live.user = await api.user();
    [results, profiles, paid] = await Promise.all([api.results(clubId, team.id), api.profiles(clubId), team.finance ? api.paid(clubId, team.id) : []]);
    if (live.user) live.member = await api.membership(clubId, team.id);
    live.approved = !!live.member && live.member.status === "approved";
    live.admin = live.approved && live.member.role === "admin";
    if (live.approved) [votes, live.avail, live.mine, live.myPays] = await Promise.all([api.votes(clubId, team.id), api.avail(clubId, team.id), api.mine(clubId, team.id), team.finance ? api.myPayments(clubId, team.id) : []]);
    if (live.admin) [live.pendingPays, live.pendingMembers] = await Promise.all([team.finance ? api.pendingPayments(clubId, team.id) : [], api.pending(clubId, team.id)]);
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
  const finance = team.finance ? addPayments(team.finance, paid, ps) : team.finance;
  return { team: { ...team, matches, finance, evaluations: (team.evaluations || []).concat(votes.attr) }, players: ps, live };
}

// Suma los pagos aprobados a las cuentas: cuotas a "aportado", uniformes a su lista y salidas a lo pagado de la liga o gastos.
export function addPayments(fin0, paid, players) {
  if (!paid.length) return fin0;
  const fin = JSON.parse(JSON.stringify(fin0));
  const name = (id) => (players.find((p) => p.id === id) || {}).name || id;
  let last = fin.updated ? new Date(fin.updated) : null;
  paid.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (p.kind === "cuota") {
      let c = fin.cuentas.find((x) => x.player === p.player_id);
      if (!c) { c = { player: p.player_id, aportado: 0, multa: false, why: "" }; fin.cuentas.push(c); }
      c.aportado = (c.aportado || 0) + amt;
    } else if (p.kind === "uniforme") {
      fin.uniformes = fin.uniformes || { texto: "", items: [] };
      fin.uniformes.items.push({ n: name(p.player_id), items: p.detail || "Uniforme", costo: amt, pagado: amt, estado: "Pagado" });
    } else if (p.kind === "salida") {
      const x = (fin.liga || []).find((y) => y.k === p.item) || (fin.gastos || []).find((y) => y.k === p.item);
      if (x) x.pagado = (x.pagado || 0) + amt;
    }
    const d = p.decided_at ? new Date(p.decided_at) : null;
    if (d && (!last || d > last)) last = d;
  });
  if (last) fin.updated = last.toISOString();
  return fin;
}
