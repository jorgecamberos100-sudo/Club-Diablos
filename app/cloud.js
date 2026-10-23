// Cuentas y datos en vivo. Dos motores con la misma interfaz:
//   supabase -> base de datos real (config.js con url y key)
//   demo     -> todo en este navegador, para probar y enseñar la app sin servidor
import { CLOUD } from "./config.js";
import { DEFAULTS, defaultPlan } from "./plans.js";

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
  "provider is not enabled": "La entrada con Google todavía no está activada. Avísale a Metra.",
  "payments_amount": "Escribe una cantidad mayor a cero.",
  "Escribe el nombre de la liga": "Escribe el nombre de la liga.",
};

// Al volver de Google se regresa a la misma sección de la app.
const BACK = "auth:back";
export function restoreRoute() {
  try {
    const u = new URL(location.href), back = localStorage.getItem(BACK);
    if (u.searchParams.has("code") || u.searchParams.has("error")) return { back, clean: () => { try { localStorage.removeItem(BACK); } catch (e) { /* nada */ } history.replaceState(null, "", location.pathname + location.hash); } };
  } catch (e) { /* sin almacenamiento */ }
  return null;
}
const rpath = (c, t, u) => `${c}/${t}/${u}/${Date.now()}.jpg`;
export function friendly(e) {
  const m = (e && (e.message || e.details)) || String(e);
  const k = Object.keys(ERR).find((x) => m.includes(x));
  return k ? ERR[k] : "No se pudo completar. Revisa tu conexión e inténtalo de nuevo.";
}

// ---------- Supabase ----------
async function supa() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(CLOUD.url, CLOUD.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  const back = restoreRoute();
  if (back) { await sb.auth.getSession(); back.clean(); }
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
    async signInGoogle() {
      try { localStorage.setItem(BACK, location.hash); } catch (e) { /* sin almacenamiento */ }
      ok(await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }));
    },
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
    // ----- cuenta, roles y ligas -----
    async account() { const u = await uid(); if (!u) return null; return ok(await sb.from("accounts").select("roles").eq("user_id", u).maybeSingle()) || { roles: [] }; },
    async setRoles(roles) { return ok(await sb.rpc("set_roles", { r: roles })); },
    async myTeams() { return ok(await sb.rpc("my_teams")) || []; },
    async myLeagues() { return ok(await sb.rpc("my_leagues")) || []; },
    async createLeague(name) { return ok(await sb.rpc("create_league", { nm: name })); },
    async league(id) {
      const u = await uid(); if (!u) return null;
      const l = ok(await sb.from("leagues").select("*").eq("id", id).maybeSingle()); if (!l) return null;
      const a = ok(await sb.from("league_admins").select("role, perms").eq("league_id", id).eq("user_id", u).maybeSingle());
      return { ...l, me: a };
    },
    async plans() { return ok(await sb.from("plans").select("*").order("tier")); },
    async entitlement(st, sid) { return ok(await sb.rpc("entitlement", { st, sid })) || defaultPlan(st); },
    // ----- pagos -----
    async paid(c, t) { return ok(await sb.rpc("team_paid", { c, t })) || []; },
    async myPayments(c, t) {
      const u = await uid(); if (!u) return [];
      return ok(await sb.from("payments").select("*").eq("club_id", c).eq("team_id", t).eq("user_id", u).neq("kind", "salida").order("created_at", { ascending: false }).limit(20));
    },
    async pendingPayments(c, t) {
      const rows = ok(await sb.from("payments").select("*").eq("club_id", c).eq("team_id", t).eq("status", "pending").order("created_at"));
      await Promise.all(rows.filter((r) => r.receipt).map(async (r) => {
        const { data } = await sb.storage.from("receipts").createSignedUrl(r.receipt, 3600); r.receipt_url = data ? data.signedUrl : null;
      }));
      return rows;
    },
    async reportPayment(c, t, { kind, amount, detail, file }) {
      const m = await me(c, t); if (!m || m.status !== "approved" || !m.player_id) throw new Error("Sin permiso");
      if (!(amount > 0)) throw new Error("payments_amount");
      let receipt = null;
      if (file) { receipt = rpath(c, t, m.user_id); ok(await sb.storage.from("receipts").upload(receipt, file, { contentType: "image/jpeg" })); }
      ok(await sb.from("payments").insert({ club_id: c, team_id: t, user_id: m.user_id, player_id: m.player_id, kind, amount, detail: detail || null, receipt }));
    },
    async adminPayment(c, t, { kind, item, player, amount, detail }) {
      if (!(amount > 0)) throw new Error("payments_amount");
      const u = await uid(), now = new Date().toISOString();
      ok(await sb.from("payments").insert({ club_id: c, team_id: t, user_id: u, player_id: player || null, kind, item: item || null, amount, detail: detail || null, status: "approved", decided_at: now }));
    },
    async decidePayment(c, t, id, status) {
      ok(await sb.from("payments").update({ status, decided_at: new Date().toISOString() }).eq("club_id", c).eq("team_id", t).eq("id", id));
    },
  };
}

// ---------- Demo (navegador) ----------
function demo() {
  const K = "demo-db";
  const load = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const db = () => Object.assign({ users: [], session: null, members: [], profiles: [], avail: [], results: [], attr: [], rating: [], mvp: [], pays: [], accounts: [], leagues: [], ladmins: [], subs: [] }, load());
  const dataURL = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
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
    // En la prueba, "Google" crea una cuenta nueva al instante.
    async signInGoogle() {
      const d = db(), n = d.users.length + 1;
      const u = { id: "g" + n + Math.random().toString(36).slice(2, 6), email: "jugador" + n + "@gmail.com", pw: null }; d.users.push(u); d.session = u.id; save(d);
      setTimeout(() => window.__reload && window.__reload(), 0);
    },
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
    // ----- cuenta, roles y ligas -----
    async account() { const d = db(); if (!d.session) return null; return d.accounts.find((a) => a.user_id === d.session) || { roles: [] }; },
    async setRoles(roles) {
      const d = db(); const u = cur(d); ensure(roles.every((r) => r === "team" || r === "league"));
      d.accounts = d.accounts.filter((a) => a.user_id !== u.id); d.accounts.push({ user_id: u.id, roles }); save(d); return roles;
    },
    async myTeams() { const d = db(); return d.members.filter((m) => m.user_id === d.session && m.status === "approved" && m.role === "admin").map(({ club_id, team_id }) => ({ club_id, team_id })); },
    async myLeagues() {
      const d = db(); return d.ladmins.filter((a) => a.user_id === d.session && a.status === "active")
        .map((a) => ({ id: a.league_id, name: (d.leagues.find((l) => l.id === a.league_id) || {}).name, role: a.role }));
    },
    async createLeague(name) {
      const d = db(); const u = cur(d); ensure(name && name.trim().length > 1, "Escribe el nombre de la liga");
      const base = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "liga";
      let id = ["cuenta", "liga"].includes(base) ? "liga-1" : base, n = 1;
      while (d.leagues.some((l) => l.id === id)) id = base.slice(0, 36) + "-" + ++n;
      d.leagues.push({ id, name: name.trim().slice(0, 80), owner: u.id, settings: {}, created_at: new Date().toISOString() });
      d.ladmins.push({ league_id: id, user_id: u.id, role: "owner", perms: ["*"], status: "active" });
      const acc = d.accounts.find((a) => a.user_id === u.id);
      if (acc) { if (!acc.roles.includes("league")) acc.roles.push("league"); } else d.accounts.push({ user_id: u.id, roles: ["league"] });
      save(d); return id;
    },
    async league(id) {
      const d = db(); if (!d.session) return null;
      const a = d.ladmins.find((x) => x.league_id === id && x.user_id === d.session && x.status === "active");
      const l = d.leagues.find((x) => x.id === id); return a && l ? { ...l, me: { role: a.role, perms: a.perms } } : null;
    },
    async plans() { return DEFAULTS; },
    async entitlement(st, sid) {
      const s = db().subs.filter((x) => x.subject_type === st && x.subject_id === sid && x.status === "active")
        .map((x) => ({ ...DEFAULTS.find((p) => p.id === x.plan_id), source: x.source })).sort((a, b) => b.tier - a.tier)[0];
      return s || defaultPlan(st);
    },
    // ----- pagos -----
    async paid(c, t) { return db().pays.filter((p) => same(c, t)(p) && p.status === "approved").map(({ kind, item, player_id, amount, detail, decided_at }) => ({ kind, item, player_id, amount, detail, decided_at })); },
    async myPayments(c, t) { const d = db(); return d.pays.filter((p) => same(c, t)(p) && p.user_id === d.session && p.kind !== "salida").reverse().slice(0, 20); },
    async pendingPayments(c, t) { const d = db(); ensure(isAdmin(d, c, t)); return d.pays.filter((p) => same(c, t)(p) && p.status === "pending").map((p) => ({ ...p, receipt_url: p.receipt })); },
    async reportPayment(c, t, { kind, amount, detail, file }) {
      const d = db(); const m = approved(d, c, t); ensure(m && m.player_id); ensure(amount > 0, "payments_amount");
      d.pays.push({ id: "p" + Date.now(), club_id: c, team_id: t, user_id: m.user_id, player_id: m.player_id, kind, amount, detail: detail || null, receipt: file ? await dataURL(file) : null, status: "pending", created_at: new Date().toISOString(), decided_at: null });
      save(d);
    },
    async adminPayment(c, t, { kind, item, player, amount, detail }) {
      const d = db(); ensure(isAdmin(d, c, t)); ensure(amount > 0, "payments_amount"); const now = new Date().toISOString();
      d.pays.push({ id: "p" + Date.now(), club_id: c, team_id: t, user_id: d.session, player_id: player || null, kind, item: item || null, amount, detail: detail || null, receipt: null, status: "approved", created_at: now, decided_at: now });
      save(d);
    },
    async decidePayment(c, t, id, status) { const d = db(); ensure(isAdmin(d, c, t)); const p = d.pays.find((x) => x.id === id); p.status = status; p.decided_at = new Date().toISOString(); save(d); },
  };
}
