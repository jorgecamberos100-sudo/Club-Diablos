// Cuentas y datos en vivo. Dos motores con la misma interfaz:
//   supabase -> base de datos real (config.js con url y key)
//   demo     -> todo en este navegador, para probar y enseñar la app sin servidor
import { CLOUD } from "./config.js";

const DEMO = CLOUD.url === "demo" || /[?&]demo\b/.test(location.search);
export const mode = DEMO ? "demo" : CLOUD.url && CLOUD.key ? "supabase" : "off";
export const on = mode !== "off";
let B = null;
export async function init() {
  if (!on || B) return;
  B = mode === "demo" ? demo() : await supa();
}
export const api = new Proxy({}, { get: (_, k) => (...a) => B[k](...a) });

const ERR = {
  "members_one_claim": "Ese nombre ya lo tiene otra cuenta. Si eres tú, pídele a Metra que lo libere.",
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "User already registered": "Ese correo ya tiene cuenta. Toca «Ya tengo cuenta».",
  "Password should be at least": "La contraseña debe tener al menos 6 caracteres.",
  "Unable to validate email": "Escribe un correo válido.",
};
export function friendly(e) {
  const m = (e && (e.message || e.details)) || String(e);
  const k = Object.keys(ERR).find((x) => m.includes(x));
  return k ? ERR[k] : "No se pudo completar. Revisa tu conexión e inténtalo de nuevo.";
}

// ---------- Supabase ----------
async function supa() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(CLOUD.url, CLOUD.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const uid = async () => { const { data } = await sb.auth.getSession(); return data.session ? data.session.user.id : null; };
  const me = async (c, t) => {
    const u = await uid(); if (!u) return null;
    return ok(await sb.from("members").select("*").eq("club_id", c).eq("team_id", t).eq("user_id", u).maybeSingle());
  };
  return {
    async user() { const { data } = await sb.auth.getSession(); const u = data.session && data.session.user; return u ? { id: u.id, email: u.email } : null; },
    async signUp(email, pw) {
      const { data, error } = await sb.auth.signUp({ email, password: pw }); if (error) throw error;
      if (!data.session) throw new Error("Unable to validate email: la cuenta necesita confirmar correo; desactiva «Confirm email» en Supabase.");
    },
    async signIn(email, pw) { ok(await sb.auth.signInWithPassword({ email, password: pw })); },
    async signOut() { await sb.auth.signOut(); },
    membership: me,
    async claimed(c, t) { return ok(await sb.rpc("claimed", { c, t })) || []; },
    async join(c, t, pid, nm) { return ok(await sb.rpc("join_team", { c, t, pid: pid || "", nm })); },
    async pending(c, t) { return ok(await sb.from("members").select("*").eq("club_id", c).eq("team_id", t).eq("status", "pending").order("created_at")); },
    async decide(c, t, user, status) { ok(await sb.from("members").update({ status }).eq("club_id", c).eq("team_id", t).eq("user_id", user)); },
    async profiles(c) { return ok(await sb.from("profiles").select("*").eq("club_id", c)); },
    async saveProfile(c, pid, { positions, photo }) {
      const u = await uid(); const row = { club_id: c, player_id: pid, positions, updated_at: new Date().toISOString() };
      if (photo) {
        const path = `${u}/${c}-${pid}.jpg`;
        ok(await sb.storage.from("photos").upload(path, photo, { upsert: true, contentType: "image/jpeg" }));
        row.photo_url = sb.storage.from("photos").getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
      }
      ok(await sb.from("profiles").upsert(row, { onConflict: "club_id,player_id" }));
    },
    async avail(c, t) { return ok(await sb.rpc("team_availability", { c, t })) || []; },
    async setAvail(c, t, match, answer) {
      const m = await me(c, t);
      ok(await sb.from("availability").upsert({ club_id: c, team_id: t, match_id: match, user_id: m.user_id, player_id: m.player_id, answer, updated_at: new Date().toISOString() }, { onConflict: "club_id,team_id,match_id,user_id" }));
    },
    async results(c, t) { return ok(await sb.from("results").select("*").eq("club_id", c).eq("team_id", t)); },
    async saveResult(c, t, r) { ok(await sb.from("results").upsert({ club_id: c, team_id: t, match_id: r.match, score_for: r.for, score_against: r.against, played: r.played, stats: r.stats || {}, updated_at: new Date().toISOString() }, { onConflict: "club_id,team_id,match_id" })); },
    async votes(c, t) { return ok(await sb.rpc("team_votes", { c, t })); },
    async mine(c, t) {
      const u = await uid(); if (!u) return { attr: [], rating: [], mvp: [] };
      const [attr, rating, mvp] = await Promise.all(["attr_votes", "match_votes", "mvp_votes"].map(async (tb) => ok(await sb.from(tb).select("*").eq("club_id", c).eq("team_id", t).eq("voter", u))));
      return { attr, rating: rating.map((r) => ({ match: r.match_id, target: r.target, score: r.score })), mvp: mvp.map((r) => ({ match: r.match_id, target: r.target })) };
    },
    async saveAttr(c, t, target, v) {
      const u = await uid();
      ok(await sb.from("attr_votes").upsert({ club_id: c, team_id: t, voter: u, target, ...v, updated_at: new Date().toISOString() }, { onConflict: "club_id,team_id,voter,target" }));
    },
    async saveMatchVotes(c, t, match, scores, mvp) {
      const u = await uid();
      ok(await sb.from("match_votes").delete().eq("club_id", c).eq("team_id", t).eq("match_id", match).eq("voter", u));
      ok(await sb.from("mvp_votes").delete().eq("club_id", c).eq("team_id", t).eq("match_id", match).eq("voter", u));
      const rows = Object.entries(scores).map(([target, score]) => ({ club_id: c, team_id: t, match_id: match, voter: u, target, score }));
      if (rows.length) ok(await sb.from("match_votes").insert(rows));
      if (mvp) ok(await sb.from("mvp_votes").insert({ club_id: c, team_id: t, match_id: match, voter: u, target: mvp }));
    },
  };
}

// ---------- Demo (navegador) ----------
function demo() {
  const K = "demo-db";
  const load = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const db = () => Object.assign({ users: [], session: null, members: [], profiles: [], avail: [], results: [], attr: [], rating: [], mvp: [] }, load());
  const save = (d) => { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } };
  const cur = (d) => { const u = d.users.find((x) => x.id === d.session); if (!u) throw new Error("Inicia sesión primero"); return u; };
  const same = (c, t) => (x) => x.club_id === c && x.team_id === t;
  const code = (id, c, t) => { let h = 0; for (const ch of id + c + t) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h.toString(16); };
  const mem = (d, c, t) => d.members.find((m) => same(c, t)(m) && m.user_id === d.session);
  const approved = (d, c, t) => { const m = mem(d, c, t); return m && m.status === "approved" ? m : null; };
  const isAdmin = (d, c, t) => { const m = approved(d, c, t); return !!m && m.role === "admin"; };
  const ensure = (v, msg) => { if (!v) throw new Error(msg || "Sin permiso"); };
  return {
    async user() { const d = db(); const u = d.users.find((x) => x.id === d.session); return u ? { id: u.id, email: u.email } : null; },
    async signUp(email, pw) {
      const d = db(); ensure(/.+@.+\..+/.test(email), "Unable to validate email"); ensure(pw.length >= 6, "Password should be at least 6");
      ensure(!d.users.some((u) => u.email === email), "User already registered");
      const u = { id: "u" + (d.users.length + 1) + Math.random().toString(36).slice(2, 6), email, pw }; d.users.push(u); d.session = u.id; save(d);
    },
    async signIn(email, pw) { const d = db(); const u = d.users.find((x) => x.email === email && x.pw === pw); ensure(u, "Invalid login credentials"); d.session = u.id; save(d); },
    async signOut() { const d = db(); d.session = null; save(d); },
    async membership(c, t) { const d = db(); return d.session ? mem(d, c, t) || null : null; },
    async claimed(c, t) { return db().members.filter((m) => same(c, t)(m) && m.player_id && m.status !== "rejected").map((m) => m.player_id); },
    async join(c, t, pid, nm) {
      const d = db(); const u = cur(d); ensure(nm && nm.trim().length > 1, "Escribe tu nombre");
      ensure(!pid || !d.members.some((m) => same(c, t)(m) && m.player_id === pid && m.status !== "rejected" && m.user_id !== u.id), "members_one_claim");
      const has = d.members.some((m) => same(c, t)(m) && m.role === "admin" && m.status === "approved");
      const old = mem(d, c, t);
      if (old) { if (old.status === "pending") { old.player_id = pid || null; old.display_name = nm; } }
      else d.members.push({ club_id: c, team_id: t, user_id: u.id, player_id: pid || null, display_name: nm.trim(), role: has ? "player" : "admin", status: has ? "pending" : "approved", created_at: new Date().toISOString() });
      save(d); return mem(d, c, t).status;
    },
    async pending(c, t) { const d = db(); ensure(isAdmin(d, c, t)); return d.members.filter((m) => same(c, t)(m) && m.status === "pending"); },
    async decide(c, t, user, status) { const d = db(); ensure(isAdmin(d, c, t)); const m = d.members.find((x) => same(c, t)(x) && x.user_id === user); m.status = status; save(d); },
    async profiles(c) { return db().profiles.filter((p) => p.club_id === c); },
    async saveProfile(c, pid, { positions, photo }) {
      const d = db(); const m = d.members.find((x) => x.user_id === d.session && x.club_id === c && x.status === "approved"); ensure(m && (m.player_id === pid || m.role === "admin"));
      let row = d.profiles.find((p) => p.club_id === c && p.player_id === pid); if (!row) { row = { club_id: c, player_id: pid }; d.profiles.push(row); }
      row.positions = positions;
      if (photo) row.photo_url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(photo); });
      save(d);
    },
    async avail(c, t) { const d = db(); return approved(d, c, t) ? d.avail.filter(same(c, t)) : []; },
    async setAvail(c, t, match, answer) {
      const d = db(); const m = approved(d, c, t); ensure(m);
      d.avail = d.avail.filter((a) => !(same(c, t)(a) && a.match_id === match && a.user_id === m.user_id));
      d.avail.push({ club_id: c, team_id: t, match_id: match, user_id: m.user_id, player_id: m.player_id, answer }); save(d);
    },
    async results(c, t) { return db().results.filter(same(c, t)); },
    async saveResult(c, t, r) {
      const d = db(); ensure(isAdmin(d, c, t));
      d.results = d.results.filter((x) => !(same(c, t)(x) && x.match_id === r.match));
      d.results.push({ club_id: c, team_id: t, match_id: r.match, score_for: r.for, score_against: r.against, played: r.played, stats: r.stats || {} }); save(d);
    },
    async votes(c, t) {
      const d = db(); if (!approved(d, c, t)) return { attr: [], rating: [], mvp: [] };
      const f = (x) => ({ ...x, voter: code(x.voter, c, t) });
      return { attr: d.attr.filter(same(c, t)).map(f), rating: d.rating.filter(same(c, t)).map(f), mvp: d.mvp.filter(same(c, t)).map(f) };
    },
    async mine(c, t) {
      const d = db(); const u = d.session; const mine = (a) => a.filter((x) => same(c, t)(x) && x.voter === u);
      return { attr: mine(d.attr), rating: mine(d.rating), mvp: mine(d.mvp) };
    },
    async saveAttr(c, t, target, v) {
      const d = db(); const m = approved(d, c, t); ensure(m && target !== m.player_id);
      d.attr = d.attr.filter((x) => !(same(c, t)(x) && x.voter === m.user_id && x.target === target));
      d.attr.push({ club_id: c, team_id: t, voter: m.user_id, target, ...v }); save(d);
    },
    async saveMatchVotes(c, t, match, scores, mvp) {
      const d = db(); const m = approved(d, c, t); ensure(m);
      const r = d.results.find((x) => same(c, t)(x) && x.match_id === match); ensure(r && r.played.includes(m.player_id));
      const mine = (x) => !(same(c, t)(x) && x.match === match && x.voter === m.user_id);
      d.rating = d.rating.filter(mine); d.mvp = d.mvp.filter(mine);
      Object.entries(scores).forEach(([target, score]) => { ensure(target !== m.player_id && r.played.includes(target)); d.rating.push({ club_id: c, team_id: t, match, voter: m.user_id, target, score }); });
      if (mvp) { ensure(mvp !== m.player_id); d.mvp.push({ club_id: c, team_id: t, match, voter: m.user_id, target: mvp }); }
      save(d);
    },
  };
}
