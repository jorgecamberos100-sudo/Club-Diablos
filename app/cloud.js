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
  "Escribe el nombre del equipo": "Escribe el nombre del equipo.",
  "Elige el formato": "Elige el formato del equipo.",
  "máximo de equipos": "Tu plan ya llegó al máximo de equipos.",
  "límite de jugadores": "Tu plan llegó al límite de jugadores.",
  "Escribe el nombre del jugador": "Escribe el nombre del jugador.",
  "Sin permiso": "No tienes permiso para hacer esto.",
  "row-level security": "Esa función no está incluida en el plan de tu equipo o no tienes permiso.",
  "Tu plan no incluye": "Esa función no está incluida en el plan de tu equipo.",
  "ya tiene resultado": "Ese partido ya tiene resultado: es historial y no se borra.",
  "Escribe el rival": "Escribe el nombre del rival.",
  "Fecha no válida": "Revisa la fecha y la hora.",
  "Jugador no encontrado": "No se encontró a ese jugador.",
  "Partido no encontrado": "No se encontró ese partido.",
  "No quedan espacios de Pro": "No quedan espacios de Pro en el contrato de tu liga.",
  "contrato vigente": "La liga no tiene un contrato vigente.",
  "ya no está pendiente": "Esa solicitud ya fue atendida.",
  "ya no está activa": "Esa vinculación ya no está activa.",
  "Datos no válidos": "Revisa los datos e inténtalo de nuevo.",
  "Torneo no encontrado": "No se encontró ese torneo.",
  "Equipo no encontrado": "No se encontró ese equipo.",
  "El torneo ya terminó": "El torneo ya terminó. Reábrelo para hacer cambios.",
  "límite de torneos": "Tu plan llegó al límite de torneos activos.",
  "ya está inscrito en": "Ese jugador ya está inscrito en otro equipo de este torneo. Primero hay que darlo de baja.",
  "ya está inscrito": "Ese equipo ya está inscrito en el torneo.",
  "no está vinculado a la liga": "Ese equipo no está vinculado a tu liga.",
  "ya juega en esa jornada": "Uno de esos equipos ya juega en esa jornada.",
  "inscritos y activos": "Los dos equipos deben estar inscritos y activos en el torneo.",
  "superan el marcador": "Los goles de los jugadores superan el marcador.",
  "check constraint": "Revisa los datos: alguno no es válido.",
  "Falta la foto": "Falta la foto del jugador: esta liga la exige para activarlo.",
  "Falta el documento": "Falta el documento del jugador: esta liga lo exige.",
  "pide documento": "Esta liga pide el documento de identidad.",
  "fecha de nacimiento": "Indica la fecha de nacimiento (o un documento) para identificar al jugador.",
  "Ese número ya lo usa": "Ese número de camiseta ya lo usa otro jugador del equipo.",
  "Registro no encontrado": "No se encontró ese registro.",
  "Jugador no encontrado": "No se encontró a ese jugador.",
  "Ya existe un jugador": "Ya existe otro jugador con esos datos (mismo documento, o mismo nombre y fecha de nacimiento).",
  "Sanción no encontrada": "No se encontró esa sanción.",
  "Objeción no encontrada": "No se encontró esa objeción.",
  "Cargo no encontrado": "No se encontró ese cargo.",
  "Movimiento no encontrado": "No se encontró ese movimiento.",
  "Administrador no encontrado": "No se encontró a ese administrador.",
  "superadministrador no se modifica": "El superadministrador no se puede modificar.",
  "está revocada": "Esa sanción está revocada y ya no se edita.",
  "Escribe el motivo": "Escribe el motivo.",
  "Escribe la resolución": "Escribe la resolución.",
  "Escribe el concepto": "Escribe el concepto.",
  "Elige el equipo que pagó": "Elige el equipo que pagó.",
  "Ese cargo ya existe": "Ese cargo ya existe para el equipo.",
  "límite de administradores": "Tu plan llegó al límite de administradores.",
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
    // ----- equipos en la base de datos -----
    async dbClub(id) { const r = ok(await sb.from("club_docs").select("club, players").eq("id", id).maybeSingle()); return r ? { club: r.club, players: r.players } : null; },
    async dbTeam(c, t) { const r = ok(await sb.from("team_docs").select("data").eq("club_id", c).eq("team_id", t).maybeSingle()); return r ? r.data : null; },
    async createTeam(name, format) { return ok(await sb.rpc("create_team", { nm: name, fmt: format })); },
    async addPlayer(c, t, { name, number, pos }) { return ok(await sb.rpc("add_player", { c, t, nm: name, num: number || "", pos: pos || "" })); },
    async entitlement(st, sid) { return ok(await sb.rpc("entitlement", { st, sid })) || defaultPlan(st); },
    // ----- gestión del equipo -----
    async updateTeam(c, t, { name, comp, format }) { ok(await sb.rpc("update_team", { c, t, nm: name, comp: comp || "", fmt: format })); },
    async updatePlayer(c, t, pid, { name, number, pos }) { ok(await sb.rpc("update_player", { c, t, pid, nm: name, num: number || "", pos: pos || "" })); },
    async setPlayerStatus(c, t, pid, st) { ok(await sb.rpc("set_player_status", { c, t, pid, st })); },
    async saveMatch(c, t, m) { return ok(await sb.rpc("save_match", { c, t, m })); },
    async deleteMatch(c, t, id) { ok(await sb.rpc("delete_match", { c, t, mid: id })); },
    async saveFinance(c, t, fin) { ok(await sb.rpc("save_finance", { c, t, fin })); },
    async setTheme(c, t, { colors, card, pattern }) { ok(await sb.rpc("set_theme", { c, t, colors, card, pattern })); },
    async setCrest(c, blob) {
      const u = await uid(), path = `${u}/crest-${c}-${Date.now()}.png`;
      ok(await sb.storage.from("photos").upload(path, blob, { upsert: true, contentType: blob.type || "image/png" }));
      const url = sb.storage.from("photos").getPublicUrl(path).data.publicUrl; ok(await sb.rpc("set_crest", { c, url })); return url;
    },
    // ----- invitaciones y vinculación -----
    async createInvite(l, { label, maxUses, days }) { return ok(await sb.rpc("create_invite", { l, lbl: label || "", max_uses: maxUses || null, days: days || null })); },
    async revokeInvite(l, code) { ok(await sb.rpc("revoke_invite", { l, c: code })); },
    async invites(l) { return ok(await sb.from("league_invites").select("*").eq("league_id", l).order("created_at", { ascending: false })); },
    async requestLink(code, c, t, name) { return ok(await sb.rpc("request_link", { p_code: code, c, t, nm: name || null })); },
    async leagueLinks(l) { return ok(await sb.from("league_teams").select("*").eq("league_id", l).order("requested_at", { ascending: false })); },
    async decideLink(l, id, approve) { return ok(await sb.rpc("decide_link", { l, lt: id, approve })); },
    async setTeamPro(l, id, want) { ok(await sb.rpc("set_team_pro", { l, lt: id, want })); },
    async unlinkTeam(id) { ok(await sb.rpc("unlink_team", { lt: id })); },
    async leagueContract(l) { return ok(await sb.rpc("league_contract", { l })); },
    async teamLinks(c, t) { return ok(await sb.rpc("team_links", { c, t })) || []; },
    async auditLog(l) { return ok(await sb.from("audit_log").select("*").eq("league_id", l).order("at", { ascending: false }).limit(100)); },
    // Solo para pruebas en modo demo; en Supabase el contrato lo administra la plataforma.
    async demoContract() { throw new Error("Sin permiso"); },
    async leagueBrand(l) { return ok(await sb.rpc("league_brand", { l })); },
    async setLeagueBrand(l, color, blob) {
      let logo = null;
      if (blob) { const u = await uid(), path = `${u}/league-${l}-${Date.now()}.png`; ok(await sb.storage.from("photos").upload(path, blob, { upsert: true, contentType: blob.type || "image/png" })); logo = sb.storage.from("photos").getPublicUrl(path).data.publicUrl; }
      ok(await sb.rpc("set_league_brand", { l, color, logo }));
    },
    // ----- página pública (lectura sin cuenta; solo datos públicos) -----
    async publicLeague(l) { return ok(await sb.rpc("public_league", { l })); },
    async publicTournament(l, tid) { return ok(await sb.rpc("public_tournament", { l, tid })); },
    async publicState(l) { return ok(await sb.rpc("public_page_state", { l })); },
    async setPublicPage(l, enabled, scorers, chat, chatDaily) { ok(await sb.rpc("set_public_page", { l, enabled, scorers, chat: !!chat, chat_daily: chatDaily ?? 100 })); },
    // ----- registro de jugadores, padrón y credenciales -----
    async registrationRules(l) { return ok(await sb.rpc("registration_rules", { l })); },
    async setRegistrationRules(l, r) { ok(await sb.rpc("set_registration_rules", { l, r })); },
    async registry(l) {
      const [p, r] = await Promise.all([sb.from("league_players").select("*").eq("league_id", l).order("norm"), sb.from("player_registrations").select("*").eq("league_id", l).order("created_at", { ascending: false })]);
      return { players: ok(p), regs: ok(r) };
    },
    async uploadPlayerPhoto(l, blob) {
      const path = `${l}/${crypto.randomUUID()}/p-${Date.now()}.jpg`;
      ok(await sb.storage.from("player-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false })); return path;
    },
    async playerPhotoUrl(path) { if (!path) return null; const r = await sb.storage.from("player-photos").createSignedUrl(path, 3600); return r.error ? null : r.data.signedUrl; },
    async officeRegister(l, tt, p) { return ok(await sb.rpc("office_register", { l, ttid: tt, p })); },
    async updateLeaguePlayer(l, pid, p) { ok(await sb.rpc("update_league_player", { l, pid, p })); },
    async decideRegistration(l, rid, approve, num, why) { ok(await sb.rpc("decide_registration", { l, rid, approve, num: num ?? null, why: why || null })); },
    async removeRegistration(l, rid, why) { ok(await sb.rpc("remove_registration", { l, rid, why })); },
    async regLinks(l) { return ok(await sb.from("registration_links").select("*").eq("league_id", l).order("created_at", { ascending: false }).limit(30)); },
    async createRegLink(l, tt, max, days) { return ok(await sb.rpc("create_reg_link", { l, ttid: tt, max_uses: max || 30, days: days || 14 })); },
    async revokeRegLink(l, c) { ok(await sb.rpc("revoke_reg_link", { l, c })); },
    async regLinkInfo(code) { return ok(await sb.rpc("reg_link_info", { p_code: code })); },
    async registerByLink(code, p) { return ok(await sb.rpc("register_by_link", { p_code: code, p })); },
    async delegateTargets(c, t) { return ok(await sb.rpc("delegate_targets", { c, t })); },
    async delegateRegister(c, t, tt, p) { return ok(await sb.rpc("delegate_register", { c, t, ttid: tt, p })); },
    async delegateRegistrations(c, t) { return ok(await sb.rpc("delegate_registrations", { c, t })); },
    // ----- administradores, sanciones, objeciones y finanzas de la liga -----
    async leagueAdmins(l) { return ok(await sb.rpc("league_admins_list", { l })); },
    async adminInvites(l) { return ok(await sb.from("admin_invites").select("*").eq("league_id", l).order("created_at", { ascending: false }).limit(30)); },
    async createAdminInvite(l, perms, label, days) { return ok(await sb.rpc("create_admin_invite", { l, p: perms, lbl: label || null, days: days || 7 })); },
    async revokeAdminInvite(l, code) { ok(await sb.rpc("revoke_admin_invite", { l, c: code })); },
    async acceptAdminInvite(code) { return ok(await sb.rpc("accept_admin_invite", { p_code: code })); },
    async setAdminPerms(l, u, perms) { ok(await sb.rpc("set_admin_perms", { l, u, p: perms })); },
    async revokeAdmin(l, u) { ok(await sb.rpc("revoke_admin", { l, u })); },
    async auditView(l, lim, ref) { return ok(await sb.rpc("audit_view", { l, lim: lim || 100, ref: ref || null })); },
    async adjustments(l, tid) { return ok(await sb.rpc("standings_adjustments", { l, tid })); },
    async sanctions(l) { return ok(await sb.from("sanctions").select("*").eq("league_id", l).order("created_at", { ascending: false })); },
    async saveSanction(l, s) { return ok(await sb.rpc("save_sanction", { l, s })); },
    async setSanctionStatus(l, id, st, note) { ok(await sb.rpc("set_sanction_status", { l, sid: id, st, note: note || null })); },
    async disputes(l) { return ok(await sb.from("disputes").select("*").eq("league_id", l).order("created_at", { ascending: false })); },
    async fileDispute(l, d) { return ok(await sb.rpc("file_dispute", { l, d })); },
    async resolveDispute(l, id, st, res) { ok(await sb.rpc("resolve_dispute", { l, did: id, st, res: res || null })); },
    async leagueFinance(l) {
      const [c, m] = await Promise.all([sb.from("league_charges").select("*").eq("league_id", l).order("created_at"), sb.from("league_movements").select("*").eq("league_id", l).order("paid_on", { ascending: false })]);
      return { charges: ok(c), movements: ok(m) };
    },
    async createCharges(l, tid, concept, amount, due, team) { return ok(await sb.rpc("create_charges", { l, tid, p_concept: concept, p_amount: amount, p_due: due || null, p_team: team || null })); },
    async voidCharge(l, id, reason) { ok(await sb.rpc("void_charge", { l, cid: id, reason })); },
    async recordMovement(l, m) { return ok(await sb.rpc("record_movement", { l, m })); },
    async voidMovement(l, id, reason) { ok(await sb.rpc("void_movement", { l, mid: id, reason })); },
    // ----- torneos, calendario y resultados (la liga; todo se escribe por funciones con permiso) -----
    async tournaments(l) { return ok(await sb.from("tournaments").select("*").eq("league_id", l).order("created_at", { ascending: false })); },
    async leagueTeams(l) { return ok(await sb.from("tournament_teams").select("*").eq("league_id", l).eq("status", "active").order("created_at")); },
    async tournamentData(l, tid) {
      const [teams, matches] = await Promise.all([
        sb.from("tournament_teams").select("*").eq("tournament_id", tid).order("created_at"),
        sb.from("league_matches").select("*").eq("tournament_id", tid).order("starts_at", { nullsFirst: false })]);
      const ms = ok(matches), events = ms.length ? ok(await sb.from("match_events").select("*").in("match_id", ms.map((m) => m.id))) : [];
      return { teams: ok(teams), matches: ms, events };
    },
    async createTournament(l, t) { return ok(await sb.rpc("create_tournament", { l, t })); },
    async updateTournament(l, id, t) { ok(await sb.rpc("update_tournament", { l, tid: id, t })); },
    async setTournamentStatus(l, id, st) { ok(await sb.rpc("set_tournament_status", { l, tid: id, st })); },
    async addTournamentTeam(l, tid, { name, link, contact }) { return ok(await sb.rpc("add_tournament_team", { l, tid, nm: name || null, link: link || null, contact: contact || null })); },
    async removeTournamentTeam(l, id) { ok(await sb.rpc("remove_tournament_team", { l, ttid: id })); },
    async leagueSaveMatch(l, m) { return ok(await sb.rpc("league_save_match", { l, m })); },
    async leagueCreateMatches(l, tid, ms) { return ok(await sb.rpc("league_create_matches", { l, tid, ms })); },
    async leagueDeleteMatch(l, id) { ok(await sb.rpc("league_delete_match", { l, mid: id })); },
    async recordResult(l, id, hg, ag, events, notes) { ok(await sb.rpc("record_result", { l, mid: id, hg, ag, events: events || [], note: notes || null })); },
    async clearResult(l, id) { ok(await sb.rpc("clear_result", { l, mid: id })); },
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
  const db = () => Object.assign({ users: [], session: null, members: [], profiles: [], avail: [], results: [], attr: [], rating: [], mvp: [], pays: [], accounts: [], leagues: [], ladmins: [], subs: [], clubdocs: [], teamdocs: [], contracts: [], invites: [], lteams: [], attempts: [], audit: [], tourn: [], ttems: [], lmatches: [], mevents: [], ainv: [], sanc: [], disp: [], chg: [], mov: [], lplayers: [], lregs: [], rlinks: [] }, load());
  const dataURL = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  const save = (d) => { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } };
  const cur = (d) => { const u = d.users.find((x) => x.id === d.session); if (!u) throw new Error("Inicia sesión primero"); return u; };
  const same = (c, t) => (x) => x.club_id === c && x.team_id === t;
  const code = (id, c, t) => { let h = 0; for (const ch of id + c + t) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h.toString(16); };
  const mem = (d, c, t) => d.members.find((m) => same(c, t)(m) && m.user_id === d.session);
  const approved = (d, c, t) => { const m = mem(d, c, t); return m && m.status === "approved" ? m : null; };
  const isAdmin = (d, c, t) => { const m = approved(d, c, t); return !!m && m.role === "admin"; };
  const ensure = (v, msg) => { if (!v) throw new Error(msg || "Sin permiso"); };
  const isLeagueAdmin = (d, l, perm) => d.ladmins.some((a) => a.league_id === l && a.user_id === d.session && a.status === "active" && (a.role === "owner" || !perm || a.perms.includes("*") || a.perms.includes(perm)));
  const contractValid = (c) => !!c && c.status === "active" && (!c.ends_at || new Date(c.ends_at) > Date.now()) && new Date(c.starts_at) <= Date.now();
  const FMTS = [5, 6, 7, 8, 9, 11], POSS = ["POR", "LAT", "DFC", "MCD", "MCO", "EXT", "DC"];
  const isDbTeam = (d, c, t) => d.teamdocs.some((x) => x.club_id === c && x.team_id === t);
  // Igual que has_feature() en la base de datos: los equipos de archivo no tienen restricción.
  const need = async (c, t, f) => { if (isDbTeam(db(), c, t)) { const e = await api.entitlement("team", c + "/" + t); ensure((e.features || []).includes(f), "Tu plan no incluye esa función"); } };
  const docs = (d, c, t) => { const cd = d.clubdocs.find((x) => x.id === c), td = d.teamdocs.find((x) => x.club_id === c && x.team_id === t); ensure(cd && td, "Este equipo se administra desde archivos"); return [cd, td]; };
  const slug = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const log = (d, l, action, detail) => d.audit.push({ id: d.audit.length + 1, league_id: l, actor: d.session, action, detail: detail || {}, at: new Date().toISOString() });
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === "x" ? 0 : 8)).toString(16)));
  const normName = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const docNorm = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || null;
  const photoOk = (p, l) => new RegExp("^" + l + "/[0-9a-f-]{36}/[A-Za-z0-9._-]+(#.*)?$").test(p);
  const regRules = (d, l) => ({ photo: "optional", doc: "optional", delegate_approval: true, ...((d.leagues.find((x) => x.id === l) || {}).settings || {}).registration });
  const liveLink = (d, code) => {
    const c = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), k = c.slice(0, 4) + "-" + c.slice(4, 8) + "-" + c.slice(8, 12), x = d.rlinks.find((y) => y.code === k);
    const t = x && d.ttems.find((y) => y.id === x.team_id); return x && x.active && new Date(x.expires_at) > Date.now() && x.uses < x.max_uses && t && t.status === "active" && d.tourn.find((y) => y.id === t.tournament_id).status !== "finished" ? x : null;
  };
  // Encuentra o crea al jugador del padrón: mismo documento, o mismo nombre y fecha de nacimiento, es la misma persona.
  const upsertPlayer = (d, l, p, st) => {
    const r = regRules(d, l), nm = String(p.name || "").trim().slice(0, 80), bd = p.birth_date || null; let dn = docNorm(p.doc_id);
    ensure(nm.length >= 2, "Escribe el nombre del jugador"); ensure(bd || dn, "Indica la fecha de nacimiento o un documento"); ensure(r.doc !== "required" || dn, "Esta liga pide documento de identidad"); if (r.doc === "off") dn = null; ensure(bd || dn, "Indica la fecha de nacimiento");
    ensure(!bd || (bd > "1900-01-01" && bd <= new Date().toISOString().slice(0, 10)), "Datos no válidos");
    const ex = d.lplayers.find((x) => x.league_id === l && ((dn && x.doc_norm === dn) || (bd && x.norm === normName(nm) && x.birth_date === bd)));
    if (ex) { ex.doc_id = ex.doc_id || (dn ? String(p.doc_id).trim().slice(0, 30) : null); ex.doc_norm = ex.doc_norm || dn; ex.birth_date = ex.birth_date || bd; return ex; }
    const x = { id: uuid(), league_id: l, name: nm, norm: normName(nm), birth_date: bd, doc_id: dn ? String(p.doc_id).trim().slice(0, 30) : null, doc_norm: dn, photo_path: null, status: st, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    d.lplayers.push(x); return x;
  };
  const canActivate = (d, l, pl) => { const r = regRules(d, l); ensure(r.photo !== "required" || pl.photo_path, "Falta la foto del jugador"); ensure(r.doc !== "required" || pl.doc_norm, "Falta el documento del jugador"); };
  const addReg = (d, l, t, pl, num, st, via) => {
    const other = d.lregs.find((x) => x.tournament_id === t.tournament_id && x.player_id === pl.id && ["pending", "active"].includes(x.status)); ensure(!other, "Ese jugador ya está inscrito en " + (other && d.ttems.find((x) => x.id === other.team_id).name));
    ensure(st !== "active" || num == null || !d.lregs.some((x) => x.team_id === t.id && x.number === num && x.status === "active"), "Ese número ya lo usa otro jugador del equipo");
    const r = { id: uuid(), league_id: l, player_id: pl.id, tournament_id: t.tournament_id, team_id: t.id, number: num, status: st, via, requested_by: d.session, decided_by: st === "active" ? d.session : null, decided_at: st === "active" ? new Date().toISOString() : null, note: null, created_at: new Date().toISOString() };
    d.lregs.push(r); if (st === "active") pl.status = "active"; return r;
  };
  const pubSettings = (d, l) => ({ enabled: false, scorers: true, chat: false, chat_daily: 100, ...((d.leagues.find((x) => x.id === l) || {}).settings || {}).public });
  const PERMS = ["teams", "tournaments", "schedule", "results", "sanctions", "finance", "registration", "audit", "settings"];
  const validPerms = (p) => Array.isArray(p) && p.every((x) => PERMS.includes(x));
  // Mismas restricciones que las columnas de la tabla sanctions.
  const sanctionChecks = (r) => {
    ensure(r.team_id || r.player, "Datos no válidos"); ensure(["amonestacion", "suspension", "multa", "puntos", "expulsion"].includes(r.kind), "Datos no válidos"); ensure(r.reason.length >= 3, "Datos no válidos");
    ensure(r.kind !== "multa" || (r.amount > 0 && r.amount <= 100000), "Datos no válidos"); ensure(r.kind !== "puntos" || (r.points >= 1 && r.points <= 50 && r.team_id), "Datos no válidos");
    ensure(r.kind !== "suspension" || r.matches || r.ends_on, "Datos no válidos"); ensure(!r.ends_on || !r.starts_on || r.ends_on >= r.starts_on, "Datos no válidos");
  };
  const TB = ["dg", "gf", "wins", "gc_low", "h2h", "fairplay", "alpha"];
  const lneed = async (l, f) => { const e = await api.entitlement("league", l); ensure((e.features || []).includes(f), "Tu plan no incluye esa función"); };
  // Campos de un torneo con las mismas validaciones y límites que las columnas de la base de datos.
  const tFields = (cur, t) => {
    const has = (k) => k in t, txt = (k, n) => (has(k) ? String(t[k] ?? "").trim().slice(0, n) || null : cur[k] ?? null), pts = (k, v) => { const x = has(k) ? +t[k] : cur[k] ?? v; ensure(Number.isInteger(x) && x >= 0 && x <= 10, "Datos no válidos"); return x; };
    const name = has("name") ? String(t.name || "").trim().slice(0, 80) : cur.name; ensure(name && name.length >= 2, "Datos no válidos");
    const modality = has("modality") ? +t.modality : cur.modality ?? 7; ensure(FMTS.includes(modality), "Datos no válidos");
    const tb = has("tiebreakers") ? t.tiebreakers : cur.tiebreakers ?? ["dg", "gf", "h2h", "fairplay"]; ensure(tb.every((x) => TB.includes(x)), "Datos no válidos");
    const fee = has("fee") ? (t.fee === "" || t.fee == null ? null : +t.fee) : cur.fee ?? null; ensure(fee == null || (fee >= 0 && fee <= 100000), "Datos no válidos");
    return { name, season: txt("season", 40), category: txt("category", 40), modality, day: txt("day", 20), shift: txt("shift", 20), fee, fee_note: txt("fee_note", 200), rules: txt("rules", 8000), pts_win: pts("pts_win", 3), pts_draw: pts("pts_draw", 1), pts_loss: pts("pts_loss", 0), tiebreakers: tb };
  };
  // Igual que el disparador lm_guard: equipos inscritos y activos, y un solo partido por equipo en cada jornada.
  const matchGuard = (d, m, extra = []) => {
    ensure(d.tourn.find((x) => x.id === m.tournament_id).status !== "finished", "El torneo ya terminó"); ensure(m.home_id !== m.away_id, "Datos no válidos");
    ensure([m.home_id, m.away_id].every((id) => d.ttems.some((x) => x.id === id && x.tournament_id === m.tournament_id && x.status === "active")), "Los equipos deben estar inscritos y activos en el torneo");
    if (m.round && m.status !== "canceled") ensure(![...d.lmatches, ...extra].some((o) => o.id !== m.id && o.tournament_id === m.tournament_id && o.round === m.round && o.status !== "canceled" && [o.home_id, o.away_id].some((t) => t === m.home_id || t === m.away_id)), "Un equipo ya juega en esa jornada");
  };
  // Equipos que hoy reciben Pro de su liga (mismo criterio que la base de datos: contrato vigente y dentro del cupo, los más antiguos primero).
  const proTeams = (d) => d.contracts.filter(contractValid).flatMap((c) => d.lteams.filter((x) => x.league_id === c.league_id && x.status === "approved" && x.pro)
    .sort((a, b) => String(a.decided_at).localeCompare(String(b.decided_at))).slice(0, c.pro_slots).map((x) => ({ ...x, plan: c.pro_plan || "team-pro" })));
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
      await need(c, t, "ratings"); const d = db(); const m = approved(d, c, t); ensure(m && target !== m.player_id);
      d.attr = d.attr.filter((x) => !(same(c, t)(x) && x.voter === m.user_id && x.target === target));
      d.attr.push({ club_id: c, team_id: t, voter: m.user_id, target, ...v }); save(d);
    },
    async saveMatchVotes(c, t, match, scores, mvp) {
      await need(c, t, "ratings"); const d = db(); const m = approved(d, c, t); ensure(m);
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
    // ----- equipos en la base de datos (navegador) -----
    async dbClub(id) { const r = db().clubdocs.find((x) => x.id === id); return r ? { club: r.club, players: r.players } : null; },
    async dbTeam(c, t) { const r = db().teamdocs.find((x) => x.club_id === c && x.team_id === t); return r ? r.data : null; },
    async createTeam(name, format) {
      const d = db(); const u = cur(d);
      ensure(name && name.trim().length > 1, "Escribe el nombre del equipo"); ensure(FMTS.includes(format), "Elige el formato");
      const mine = d.members.filter((m) => m.user_id === u.id && m.status === "approved" && m.role === "admin");
      let cap = (DEFAULTS.find((p) => p.id === "team-free").limits.teams) || 1;
      for (const m of mine) { const e = await this.entitlement("team", m.club_id + "/" + m.team_id); cap = Math.max(cap, e.limits && e.limits.teams != null ? e.limits.teams : 1e6); }
      ensure(mine.length < cap, "máximo de equipos");
      const base = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      let id = !base || ["cuenta", "liga", "diablos", "ejemplo"].includes(base) ? "equipo" : base, n = 1;
      while (d.clubdocs.some((x) => x.id === id) || ["cuenta", "liga", "diablos", "ejemplo"].includes(id)) id = (base || "equipo").slice(0, 36) + "-" + ++n;
      d.clubdocs.push({ id, owner: u.id, players: [], club: { id, name: name.trim().slice(0, 60), shortName: name.trim().slice(0, 24), crest: "", contact: "el administrador",
        teams: [{ id: "principal", name: "Principal" }], theme: { colors: { bg: "#0e1110", panel: "#151a18", raise: "#1c2321", line: "#2a3330", text: "#ffffff", muted: "#a0aaa6", primary: "#1f9d61", primarySoft: "#3fd18a", onPrimary: "#ffffff" }, card: "escudo", pattern: "franjas" } } });
      d.teamdocs.push({ club_id: id, team_id: "principal", data: { id: "principal", name: "Principal", competition: "", format, roster: [], matches: [], evaluations: [], lineups: [] } });
      d.members.push({ club_id: id, team_id: "principal", user_id: u.id, player_id: null, display_name: u.email.split("@")[0], role: "admin", status: "approved", created_at: new Date().toISOString() });
      save(d); return { club: id, team: "principal" };
    },
    async addPlayer(c, t, { name, number, pos }) {
      const d = db(); ensure(isAdmin(d, c, t)); ensure(name && name.trim().length > 1, "Escribe el nombre del jugador");
      const cd = d.clubdocs.find((x) => x.id === c), td = d.teamdocs.find((x) => x.club_id === c && x.team_id === t); ensure(cd && td, "Este equipo se administra desde archivos");
      const e = await this.entitlement("team", c + "/" + t); ensure(e.limits.players == null || td.data.roster.filter((r) => r.status !== "congelado").length < e.limits.players, "límite de jugadores");
      const pid = "p" + (cd.players.length + 1);
      cd.players.push({ id: pid, name: name.trim().slice(0, 40), positions: pos ? [pos] : [], photo: null, attrs: null }); td.data.roster.push({ player: pid, number: String(number || "").slice(0, 3) });
      save(d); return pid;
    },
    async entitlement(st, sid) {
      const d = db(), own = d.subs.filter((x) => x.subject_type === st && x.subject_id === sid && x.status === "active" && (!x.ends_at || new Date(x.ends_at) > Date.now()))
        .map((x) => ({ ...DEFAULTS.find((p) => p.id === x.plan_id), source: x.source, pri: 0 }));
      const lg = st === "team" ? proTeams(d).filter((x) => x.club_id + "/" + x.team_id === sid).map((x) => ({ ...DEFAULTS.find((p) => p.id === x.plan), source: "league", league_id: x.league_id, pri: 1 })) : [];
      const best = [...own, ...lg].sort((a, b) => b.tier - a.tier || a.pri - b.pri)[0];
      return best || defaultPlan(st);
    },
    // ----- gestión del equipo (navegador) -----
    async updateTeam(c, t, { name, comp, format }) {
      const d = db(); ensure(isAdmin(d, c, t)); ensure(name && name.trim().length > 1, "Escribe el nombre del equipo"); ensure(FMTS.includes(format), "Elige el formato"); const [cd, td] = docs(d, c, t);
      cd.club.name = name.trim().slice(0, 60); cd.club.shortName = name.trim().slice(0, 24); td.data.competition = String(comp || "").trim().slice(0, 80); td.data.format = format; save(d);
    },
    async updatePlayer(c, t, pid, { name, number, pos }) {
      const d = db(); ensure(isAdmin(d, c, t)); ensure(name && name.trim().length > 1, "Escribe el nombre del jugador"); ensure(!pos || POSS.includes(pos), "Posición no válida"); const [cd, td] = docs(d, c, t);
      const r = td.data.roster.find((x) => x.player === pid), p = cd.players.find((x) => x.id === pid); ensure(r && p, "Jugador no encontrado");
      p.name = name.trim().slice(0, 40); p.positions = pos ? [pos] : []; r.number = String(number || "").slice(0, 3); save(d);
    },
    async setPlayerStatus(c, t, pid, st) {
      const d = db(); ensure(isAdmin(d, c, t)); ensure(["activo", "congelado"].includes(st), "Datos no válidos"); const [, td] = docs(d, c, t);
      const r = td.data.roster.find((x) => x.player === pid); ensure(r, "Jugador no encontrado"); if (st === "activo") delete r.status; else r.status = "congelado"; save(d);
    },
    async saveMatch(c, t, m) {
      const d = db(); ensure(isAdmin(d, c, t)); const [, td] = docs(d, c, t); const rival = String(m.rival || "").trim().slice(0, 40);
      ensure(rival, "Escribe el rival"); ensure(m.date && !isNaN(new Date(m.date)), "Fecha no válida");
      const item = { jornada: String(m.jornada || "").trim().slice(0, 20), date: m.date, rival, home: m.home !== false, venue: String(m.venue || "").trim().slice(0, 40) };
      if (!m.id) { const id = "m" + Math.random().toString(36).slice(2, 8); td.data.matches.push({ id, ...item }); save(d); return id; }
      const i = td.data.matches.findIndex((x) => x.id === m.id); ensure(i > -1, "Partido no encontrado"); td.data.matches[i] = { ...td.data.matches[i], ...item }; save(d); return m.id;
    },
    async deleteMatch(c, t, id) {
      const d = db(); ensure(isAdmin(d, c, t)); const [, td] = docs(d, c, t);
      ensure(!d.results.some((r) => same(c, t)(r) && r.match_id === id), "ya tiene resultado"); td.data.matches = td.data.matches.filter((x) => x.id !== id); save(d);
    },
    async setTheme(c, t, { colors, card, pattern }) {
      const d = db(); ensure(isAdmin(d, c, t)); await need(c, t, "themes"); const [cd] = docs(d, c, t);
      ensure(["escudo", "redonda", "recta"].includes(card) && ["franjas", "diagonal", "liso"].includes(pattern), "Datos no válidos");
      Object.entries(colors).forEach(([k, v]) => ensure(["bg", "panel", "raise", "line", "text", "muted", "primary", "primarySoft", "onPrimary"].includes(k) && /^#[0-9a-fA-F]{6}$/.test(v), "Datos no válidos"));
      cd.club.theme = { ...cd.club.theme, colors: { ...cd.club.theme.colors, ...colors }, card, pattern }; save(d);
    },
    async setCrest(c, blob) { const d = db(); const t = (d.teamdocs.find((x) => x.club_id === c) || {}).team_id; ensure(isAdmin(d, c, t)); const [cd] = docs(d, c, t); cd.club.crest = await dataURL(blob); save(d); return cd.club.crest; },
    async saveFinance(c, t, fin) {
      const d = db(); ensure(isAdmin(d, c, t)); const [, td] = docs(d, c, t); await need(c, t, "finance");
      const num = (v, max) => { const n = Number(v); ensure(Number.isFinite(n) && n >= 0 && n <= max, "Datos no válidos"); return n; };
      const cuota = num(fin.cuota, 50000), used = [], orden = [], liga = [], gastos = [];
      const items = [...(fin.liga || []).map((x) => ["liga", x]), ...(fin.gastos || []).map((x) => ["gastos", x])]; ensure(items.length <= 40, "Datos no válidos");
      items.forEach(([src, x], n) => {
        const label = String(x.label || "").trim().slice(0, 40); ensure(label, "Datos no válidos"); const costo = num(x.costo, 500000);
        let k = (slug(x.k) || slug(label) || "x").slice(0, 24); while (used.includes(k)) k = k.slice(0, 21) + "-" + (n + 1);
        used.push(k); orden.push(k); (src === "liga" ? liga : gastos).push({ k, label, costo, pagado: 0, desc: String(x.desc || "").trim().slice(0, 120) });
      });
      const mt = num(fin.multaTotal || 0, 50000), flags = fin.multas || []; let multa;
      if (mt > 0) { multa = { total: mt, original: mt }; liga.push({ k: "multa", label: "Multas", costo: mt, pagado: 0, desc: "" }); orden.push("multa"); }
      const cuentas = td.data.roster.filter((r) => r.status !== "congelado").map((r) => { const f = flags.find((x) => x.player === r.player); return { player: r.player, aportado: 0, multa: mt > 0 && !!f, why: mt > 0 && f ? String(f.why || "").slice(0, 60) : "" }; });
      td.data.finance = { updated: new Date().toISOString(), cuota, ...(multa ? { multa } : {}), liga, gastos, orden, cuotaNota: String(fin.cuotaNota || "").trim().slice(0, 200), cuentas, faq: [] }; save(d);
    },
    // ----- invitaciones y vinculación (navegador) -----
    async createInvite(l, { label, maxUses, days }) {
      const d = db(); ensure(isLeagueAdmin(d, l, "teams"));
      const raw = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
      const code = raw.slice(0, 4) + "-" + raw.slice(4, 8) + "-" + raw.slice(8, 12);
      d.invites.push({ code, league_id: l, label: (label || "").trim().slice(0, 60) || null, max_uses: maxUses || null, uses: 0, active: true,
        expires_at: days ? new Date(Date.now() + days * 864e5).toISOString() : null, created_by: d.session, created_at: new Date().toISOString() });
      log(d, l, "invite.create", { code, max_uses: maxUses || null }); save(d); return code;
    },
    async revokeInvite(l, code) { const d = db(); ensure(isLeagueAdmin(d, l, "teams")); const i = d.invites.find((x) => x.league_id === l && x.code === code); if (i) i.active = false; log(d, l, "invite.revoke", { code }); save(d); },
    async invites(l) { const d = db(); return isLeagueAdmin(d, l, "teams") ? d.invites.filter((x) => x.league_id === l).slice().reverse() : []; },
    async requestLink(code, c, t, name) {
      const d = db(); const u = cur(d); ensure(isAdmin(d, c, t));
      const now = Date.now(), recent = d.attempts.filter((a) => a.user_id === u.id && now - a.at < 36e5).length;
      if (recent >= 8) return { error: "throttled" };
      const cid = String(code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(), key = cid.slice(0, 4) + "-" + cid.slice(4, 8) + "-" + cid.slice(8, 12);
      const inv = d.invites.find((i) => i.code === key && i.active && (!i.expires_at || new Date(i.expires_at) > now) && (!i.max_uses || i.uses < i.max_uses));
      if (!inv) { d.attempts.push({ user_id: u.id, at: now }); save(d); return { error: "invalid" }; }
      if (d.lteams.some((x) => x.league_id === inv.league_id && x.club_id === c && x.team_id === t && ["pending", "approved"].includes(x.status))) return { error: "duplicate" };
      const cd = d.clubdocs.find((x) => x.id === c);
      d.lteams.push({ id: "lt" + now + Math.random().toString(36).slice(2, 6), league_id: inv.league_id, club_id: c, team_id: t, team_name: (cd && cd.club.name) || (name || "").trim().slice(0, 60) || c,
        status: "pending", pro: false, invite_code: inv.code, requested_by: u.id, requested_at: new Date().toISOString(), decided_by: null, decided_at: null });
      inv.uses++; save(d); return { ok: true, league: (d.leagues.find((x) => x.id === inv.league_id) || {}).name };
    },
    async leagueLinks(l) { const d = db(); return isLeagueAdmin(d, l, "teams") ? d.lteams.filter((x) => x.league_id === l).slice().reverse() : []; },
    async decideLink(l, id, approve) {
      const d = db(); ensure(isLeagueAdmin(d, l, "teams")); const r = d.lteams.find((x) => x.id === id && x.league_id === l && x.status === "pending"); ensure(r, "ya no está pendiente");
      const c = d.contracts.find((x) => x.league_id === l);
      const pro = !!approve && contractValid(c) && d.lteams.filter((x) => x.league_id === l && x.status === "approved" && x.pro).length < c.pro_slots;
      Object.assign(r, { status: approve ? "approved" : "rejected", pro, decided_by: d.session, decided_at: new Date().toISOString() });
      log(d, l, approve ? "team.approve" : "team.reject", { team: r.club_id + "/" + r.team_id, pro }); save(d); return { ok: true, pro };
    },
    async setTeamPro(l, id, want) {
      const d = db(); ensure(isLeagueAdmin(d, l, "teams")); const r = d.lteams.find((x) => x.id === id && x.league_id === l && x.status === "approved"); ensure(r, "Equipo no vinculado");
      if (want && !r.pro) {
        const c = d.contracts.find((x) => x.league_id === l); ensure(contractValid(c), "contrato vigente");
        ensure(d.lteams.filter((x) => x.league_id === l && x.status === "approved" && x.pro).length < c.pro_slots, "No quedan espacios de Pro");
      }
      r.pro = !!want; log(d, l, "team.pro", { team: r.club_id + "/" + r.team_id, pro: !!want }); save(d);
    },
    async unlinkTeam(id) {
      const d = db(); const r = d.lteams.find((x) => x.id === id && ["pending", "approved"].includes(x.status)); ensure(r, "ya no está activa");
      const byLeague = isLeagueAdmin(d, r.league_id, "teams"); ensure(byLeague || isAdmin(d, r.club_id, r.team_id));
      Object.assign(r, { status: byLeague ? "removed" : "left", decided_by: d.session, decided_at: new Date().toISOString() });
      log(d, r.league_id, "team.unlink", { team: r.club_id + "/" + r.team_id, by: byLeague ? "league" : "team" }); save(d);
    },
    async leagueContract(l) {
      const d = db(); if (!isLeagueAdmin(d, l)) return null; const c = d.contracts.find((x) => x.league_id === l);
      const used = d.lteams.filter((x) => x.league_id === l && x.status === "approved" && x.pro).length;
      return c ? { pro_slots: c.pro_slots, status: c.status, ends_at: c.ends_at, valid: contractValid(c), used } : { pro_slots: 0, status: "none", valid: false, used };
    },
    async teamLinks(c, t) {
      const d = db(); if (!isAdmin(d, c, t)) return [];
      return d.lteams.filter((x) => x.club_id === c && x.team_id === t).map((x) => ({ id: x.id, league_id: x.league_id, league_name: (d.leagues.find((l) => l.id === x.league_id) || {}).name, status: x.status, pro: x.pro, requested_at: x.requested_at })).reverse();
    },
    async auditLog(l) { const d = db(); return isLeagueAdmin(d, l, "audit") ? d.audit.filter((x) => x.league_id === l).slice().reverse().slice(0, 100) : []; },
    // Solo demo: simula el contrato que en Supabase administra la plataforma.
    async demoContract(l, slots, days) {
      const d = db(); ensure(isLeagueAdmin(d, l)); d.contracts = d.contracts.filter((x) => x.league_id !== l);
      d.contracts.push({ league_id: l, pro_slots: slots, status: "active", starts_at: new Date().toISOString(), ends_at: days ? new Date(Date.now() + days * 864e5).toISOString() : null }); save(d);
    },
    async leagueBrand(l) { const d = db(); ensure(isLeagueAdmin(d, l)); return { color: "#c8102e", logo: null, ...((d.leagues.find((x) => x.id === l) || {}).settings || {}).brand }; },
    async setLeagueBrand(l, color, blob) {
      const d = db(); ensure(isLeagueAdmin(d, l, "settings")); ensure(/^#[0-9a-fA-F]{6}$/.test(color || ""), "Datos no válidos"); const lg = d.leagues.find((x) => x.id === l), cur = (lg.settings || {}).brand || {};
      lg.settings = { ...(lg.settings || {}), brand: { color: color.toLowerCase(), logo: blob ? await dataURL(blob) : cur.logo || null } }; log(d, l, "league.brand", { color: color.toLowerCase(), logo_changed: !!blob }); save(d);
    },
    async publicState(l) { const d = db(); ensure(isLeagueAdmin(d, l)); return pubSettings(d, l); },
    async setPublicPage(l, enabled, scorers, chat, chatDaily) {
      const d = db(); ensure(isLeagueAdmin(d, l, "settings")); chatDaily = chatDaily ?? 100; ensure(typeof enabled === "boolean" && typeof scorers === "boolean" && chatDaily >= 0 && chatDaily <= 5000, "Datos no válidos");
      if (enabled) await lneed(l, "public_page"); const lg = d.leagues.find((x) => x.id === l); lg.settings = { ...(lg.settings || {}), public: { enabled, scorers, chat: !!chat, chat_daily: chatDaily } };
      log(d, l, "public.settings", { enabled, scorers, chat: !!chat, chat_daily: chatDaily }); save(d);
    },
    async publicLeague(l) {
      const d = db(), lg = d.leagues.find((x) => x.id === l), ps = lg && pubSettings(d, l), e = lg && (await api.entitlement("league", l));
      if (!lg || !ps.enabled || !(e.features || []).includes("public_page")) return { error: "not_found" };
      const b = (lg.settings || {}).brand || {};
      return { league: { id: lg.id, name: lg.name, brand: { color: b.color || "#c8102e", logo: b.logo || null } }, chat: !!ps.chat,
        tournaments: d.tourn.filter((t) => t.league_id === l && ["published", "paused", "finished"].includes(t.status)).slice().reverse().map((t) => ({ id: t.id, name: t.name, season: t.season, category: t.category, modality: t.modality, status: t.status })) };
    },
    async publicTournament(l, tid) {
      const d = db(), lg = d.leagues.find((x) => x.id === l), t = d.tourn.find((x) => x.id === tid && x.league_id === l && ["published", "paused", "finished"].includes(x.status)), e = lg && (await api.entitlement("league", l));
      if (!t || !pubSettings(d, l).enabled || !(e.features || []).includes("public_page")) return { error: "not_found" };
      const sc = pubSettings(d, l).scorers, ms = d.lmatches.filter((m) => m.tournament_id === tid), ids = new Set(ms.map((m) => m.id)), by = {};
      d.sanc.filter((x) => x.tournament_id === tid && x.kind === "puntos" && x.status !== "revoked").forEach((x) => (by[x.team_id] = (by[x.team_id] || 0) + x.points));
      return { tournament: { id: t.id, name: t.name, season: t.season, category: t.category, modality: t.modality, status: t.status, pts_win: t.pts_win, pts_draw: t.pts_draw, pts_loss: t.pts_loss, tiebreakers: t.tiebreakers, rules: t.rules },
        teams: d.ttems.filter((x) => x.tournament_id === tid).map((x) => ({ id: x.id, name: x.name, status: x.status })).sort((a, b) => a.name.localeCompare(b.name, "es")),
        matches: ms.map((m) => ({ id: m.id, round: m.round, starts_at: m.starts_at, venue: m.venue, home_id: m.home_id, away_id: m.away_id, status: m.status, home_goals: m.home_goals, away_goals: m.away_goals })),
        events: d.mevents.filter((x) => ids.has(x.match_id) && ["goal", "yellow", "red"].includes(x.kind)).map((x) => ({ match_id: x.match_id, team_id: x.team_id, kind: x.kind, n: x.n, player: x.kind === "goal" && sc ? x.player : "" })),
        adjust: Object.entries(by).map(([team_id, points]) => ({ team_id, points })), scorers: sc };
    },
    // ----- registro de jugadores, padrón y credenciales (mismas reglas que las funciones SQL) -----
    async registrationRules(l) { const d = db(); ensure(isLeagueAdmin(d, l)); return regRules(d, l); },
    async setRegistrationRules(l, r) {
      const d = db(); ensure(isLeagueAdmin(d, l, "settings")); const O = ["off", "optional", "required"]; ensure(O.includes(r.photo) && O.includes(r.doc) && typeof r.delegate_approval === "boolean", "Datos no válidos");
      const lg = d.leagues.find((x) => x.id === l); lg.settings = { ...(lg.settings || {}), registration: { photo: r.photo, doc: r.doc, delegate_approval: r.delegate_approval } }; log(d, l, "registration.rules", { rules: r }); save(d);
    },
    async registry(l) { const d = db(); ensure(isLeagueAdmin(d, l, "registration")); return { players: d.lplayers.filter((x) => x.league_id === l).sort((a, b) => a.norm.localeCompare(b.norm)), regs: d.lregs.filter((x) => x.league_id === l).slice().reverse() }; },
    async uploadPlayerPhoto(l, blob) { const d = db(); ensure(isLeagueAdmin(d, l, "registration")); return `${l}/${uuid()}/p.jpg#` + (await dataURL(blob)); },
    async playerPhotoUrl(path) { return path ? path.slice(path.indexOf("#") + 1) : null; },
    async officeRegister(l, tt, p) {
      const d = db(); ensure(isLeagueAdmin(d, l, "registration")); await lneed(l, "registration"); const t = d.ttems.find((x) => x.id === tt && x.league_id === l && x.status === "active"); ensure(t, "Equipo no encontrado");
      const pl = upsertPlayer(d, l, p, "pending"); if (p.photo_path) { ensure(photoOk(p.photo_path, l), "Datos no válidos"); pl.photo_path = p.photo_path; }
      canActivate(d, l, pl); const r = addReg(d, l, t, pl, p.number === "" || p.number == null ? null : +p.number, "active", "office");
      log(d, l, "player.register", { player: pl.id, registration: r.id, team: t.id, via: "office" }); save(d); return r.id;
    },
    async updateLeaguePlayer(l, pid, p) {
      const d = db(); ensure(isLeagueAdmin(d, l, "registration")); const pl = d.lplayers.find((x) => x.id === pid && x.league_id === l); ensure(pl, "Jugador no encontrado");
      const n = { ...pl }; if ("name" in p) { n.name = String(p.name).trim().slice(0, 80); n.norm = normName(n.name); } if ("birth_date" in p) n.birth_date = p.birth_date || null;
      if ("doc_id" in p) { n.doc_id = String(p.doc_id || "").trim().slice(0, 30) || null; n.doc_norm = docNorm(p.doc_id); } if (p.photo_path) { ensure(photoOk(p.photo_path, l), "Datos no válidos"); n.photo_path = p.photo_path; }
      ensure(!d.lplayers.some((x) => x.id !== pid && x.league_id === l && ((n.doc_norm && x.doc_norm === n.doc_norm) || (n.birth_date && x.norm === n.norm && x.birth_date === n.birth_date))), "Ya existe un jugador con esos datos");
      log(d, l, "player.update", { player: pid, before: { name: pl.name, birth_date: pl.birth_date, doc: !!pl.doc_norm, photo: !!pl.photo_path }, after: { name: n.name, birth_date: n.birth_date, doc: !!n.doc_norm, photo: !!n.photo_path } });
      Object.assign(pl, n, { updated_at: new Date().toISOString() }); save(d);
    },
    async decideRegistration(l, rid, approve, num, why) {
      const d = db(); ensure(isLeagueAdmin(d, l, "registration")); const r = d.lregs.find((x) => x.id === rid && x.league_id === l && x.status === "pending"); ensure(r, "ya no está pendiente"); const pl = d.lplayers.find((x) => x.id === r.player_id);
      if (approve) {
        canActivate(d, l, pl); ensure(num == null || !d.lregs.some((x) => x.team_id === r.team_id && x.number === num && x.status === "active"), "Ese número ya lo usa otro jugador del equipo");
        Object.assign(r, { status: "active", number: num ?? null, decided_by: d.session, decided_at: new Date().toISOString() }); pl.status = "active";
      } else {
        Object.assign(r, { status: "rejected", note: String(why || "").trim().slice(0, 200) || null, decided_by: d.session, decided_at: new Date().toISOString() });
        if (!d.lregs.some((x) => x.player_id === pl.id && ["pending", "active"].includes(x.status)) && !d.lregs.some((x) => x.player_id === pl.id && x.status === "removed") && pl.status === "pending") pl.status = "inactive";
      }
      log(d, l, approve ? "player.approve" : "player.reject", { player: pl.id, registration: rid, team: r.team_id, number: num ?? null, note: why || null }); save(d);
    },
    async removeRegistration(l, rid, why) {
      const d = db(); ensure(isLeagueAdmin(d, l, "registration")); ensure(String(why || "").trim().length >= 3, "Escribe el motivo"); const r = d.lregs.find((x) => x.id === rid && x.league_id === l && ["pending", "active"].includes(x.status)); ensure(r, "Registro no encontrado");
      Object.assign(r, { status: "removed", note: String(why).trim().slice(0, 200), decided_by: d.session, decided_at: new Date().toISOString() }); log(d, l, "player.remove", { player: r.player_id, registration: rid, team: r.team_id, reason: String(why).slice(0, 200) }); save(d);
    },
    async regLinks(l) { const d = db(); ensure(isLeagueAdmin(d, l, "registration")); return d.rlinks.filter((x) => x.league_id === l).slice().reverse(); },
    async createRegLink(l, tt, max, days) {
      const d = db(); ensure(isLeagueAdmin(d, l, "registration")); await lneed(l, "registration"); ensure(d.ttems.some((x) => x.id === tt && x.league_id === l && x.status === "active"), "Equipo no encontrado");
      max = max || 30; days = days || 14; ensure(max >= 1 && max <= 200 && days >= 1 && days <= 90, "Datos no válidos");
      const raw = (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2) + "000000000000").slice(0, 12).toUpperCase(), c = raw.slice(0, 4) + "-" + raw.slice(4, 8) + "-" + raw.slice(8, 12);
      d.rlinks.push({ code: c, league_id: l, team_id: tt, max_uses: max, uses: 0, expires_at: new Date(Date.now() + days * 864e5).toISOString(), active: true, created_at: new Date().toISOString() }); log(d, l, "reglink.create", { code: c, team: tt, max_uses: max }); save(d); return c;
    },
    async revokeRegLink(l, c) { const d = db(); ensure(isLeagueAdmin(d, l, "registration")); const x = d.rlinks.find((y) => y.code === c && y.league_id === l); if (x) x.active = false; log(d, l, "reglink.revoke", { code: c }); save(d); },
    async regLinkInfo(code) {
      const d = db(), rl = liveLink(d, code); if (!rl) return { error: "invalid" }; const t = d.ttems.find((x) => x.id === rl.team_id), tn = d.tourn.find((x) => x.id === t.tournament_id), { delegate_approval, ...rules } = regRules(d, rl.league_id);
      return { league: d.leagues.find((x) => x.id === rl.league_id).name, tournament: tn.name, team: t.name, rules };
    },
    async registerByLink(code, p) {
      const d = db(), rl = liveLink(d, code); if (!rl) return { error: "invalid" }; const t = d.ttems.find((x) => x.id === rl.team_id), pl = upsertPlayer(d, rl.league_id, p, "pending"), r = addReg(d, rl.league_id, t, pl, null, "pending", "link");
      rl.uses++; log(d, rl.league_id, "player.submit", { player: pl.id, registration: r.id, team: t.id, via: "link", code: rl.code }); save(d); return { ok: true, team: t.name };
    },
    async delegateTargets(c, t) {
      const d = db(); ensure(isAdmin(d, c, t));
      return d.ttems.filter((tt) => tt.status === "active" && d.lteams.some((x) => x.id === tt.link_id && x.club_id === c && x.team_id === t && x.status === "approved") && d.tourn.find((y) => y.id === tt.tournament_id).status !== "finished")
        .map((tt) => ({ id: tt.id, league_id: tt.league_id, league: d.leagues.find((x) => x.id === tt.league_id).name, tournament: d.tourn.find((y) => y.id === tt.tournament_id).name, team: tt.name, rules: regRules(d, tt.league_id) }));
    },
    async delegateRegister(c, t, tt, p) {
      const d = db(); ensure(isAdmin(d, c, t)); const x = d.ttems.find((y) => y.id === tt && y.status === "active" && d.lteams.some((z) => z.id === y.link_id && z.club_id === c && z.team_id === t && z.status === "approved")); ensure(x, "Equipo no encontrado");
      await lneed(x.league_id, "registration"); ensure(d.tourn.find((y) => y.id === x.tournament_id).status !== "finished", "El torneo ya terminó");
      const pl = upsertPlayer(d, x.league_id, p, "pending"), r = addReg(d, x.league_id, x, pl, null, "pending", "delegate"); log(d, x.league_id, "player.submit", { player: pl.id, registration: r.id, team: x.id, via: "delegate" }); save(d);
      return { ok: true, registration: r.id, status: "pending" };
    },
    async delegateRegistrations(c, t) {
      const d = db(); ensure(isAdmin(d, c, t));
      return d.lregs.filter((r) => r.status !== "removed" && d.ttems.some((tt) => tt.id === r.team_id && d.lteams.some((z) => z.id === tt.link_id && z.club_id === c && z.team_id === t))).slice().reverse()
        .map((r) => ({ id: r.id, name: d.lplayers.find((x) => x.id === r.player_id).name, status: r.status, number: r.number, team: d.ttems.find((x) => x.id === r.team_id).name, created_at: r.created_at }));
    },
    // ----- administradores, sanciones, objeciones y finanzas de la liga (mismas reglas que las funciones SQL) -----
    async leagueAdmins(l) {
      const d = db(); ensure(isLeagueAdmin(d, l, "admins"));
      return d.ladmins.filter((a) => a.league_id === l).map((a) => ({ user_id: a.user_id, email: (d.users.find((u) => u.id === a.user_id) || {}).email || "", role: a.role, perms: a.perms, status: a.status, since: a.created_at || null }));
    },
    async adminInvites(l) { const d = db(); return isLeagueAdmin(d, l, "admins") ? d.ainv.filter((x) => x.league_id === l).slice().reverse() : []; },
    async createAdminInvite(l, perms, label, days) {
      const d = db(); ensure(isLeagueAdmin(d, l, "admins")); ensure(perms && perms.length && validPerms(perms), "Datos no válidos"); days = days || 7; ensure(days >= 1 && days <= 60, "Datos no válidos");
      const raw = (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2) + "000000000000").slice(0, 12).toUpperCase(), c = raw.slice(0, 4) + "-" + raw.slice(4, 8) + "-" + raw.slice(8, 12);
      d.ainv.push({ code: c, league_id: l, perms, label: String(label || "").trim().slice(0, 60) || null, expires_at: new Date(Date.now() + days * 864e5).toISOString(), active: true, used_by: null, created_at: new Date().toISOString() });
      log(d, l, "admin.invite", { code: c, perms }); save(d); return c;
    },
    async revokeAdminInvite(l, code) { const d = db(); ensure(isLeagueAdmin(d, l, "admins")); const i = d.ainv.find((x) => x.code === code && x.league_id === l); if (i) i.active = false; log(d, l, "admin.invite_revoke", { code }); save(d); },
    async acceptAdminInvite(code) {
      const d = db(), u = cur(d); const hour = Date.now() - 36e5;
      if (d.attempts.filter((a) => a.user_id === u.id && a.at > hour).length >= 8) return { error: "throttled" };
      const cid = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), key = cid.slice(0, 4) + "-" + cid.slice(4, 8) + "-" + cid.slice(8, 12);
      const inv = d.ainv.find((x) => x.code === key && x.active && !x.used_by && new Date(x.expires_at) > Date.now());
      if (!inv) { d.attempts.push({ user_id: u.id, at: Date.now() }); save(d); return { error: "invalid" }; }
      const mine = d.ladmins.find((a) => a.league_id === inv.league_id && a.user_id === u.id);
      if (mine && mine.status === "active") return { error: "already" };
      const e = await api.entitlement("league", inv.league_id);
      if (e.limits.admins != null && d.ladmins.filter((a) => a.league_id === inv.league_id && a.status === "active").length >= e.limits.admins) return { error: "limit" };
      if (mine) Object.assign(mine, { status: "active", perms: inv.perms, role: "admin" }); else d.ladmins.push({ league_id: inv.league_id, user_id: u.id, role: "admin", perms: inv.perms, status: "active", created_at: new Date().toISOString() });
      inv.used_by = u.id; inv.active = false; d.session = u.id; log(d, inv.league_id, "admin.join", { user: u.id, perms: inv.perms }); save(d);
      return { ok: true, league: (d.leagues.find((x) => x.id === inv.league_id) || {}).name, league_id: inv.league_id };
    },
    async setAdminPerms(l, u, perms) {
      const d = db(); ensure(isLeagueAdmin(d, l, "admins")); ensure(perms && validPerms(perms), "Datos no válidos");
      const a = d.ladmins.find((x) => x.league_id === l && x.user_id === u && x.status === "active"); ensure(a, "Administrador no encontrado"); ensure(a.role !== "owner", "El superadministrador no se modifica");
      log(d, l, "admin.perms", { user: u, before: a.perms, after: perms }); a.perms = perms; save(d);
    },
    async revokeAdmin(l, u) {
      const d = db(); ensure(isLeagueAdmin(d, l, "admins")); const a = d.ladmins.find((x) => x.league_id === l && x.user_id === u && x.status === "active");
      ensure(a, "Administrador no encontrado"); ensure(a.role !== "owner", "El superadministrador no se modifica"); a.status = "revoked"; log(d, l, "admin.revoke", { user: u, perms: a.perms }); save(d);
    },
    async auditView(l, lim, ref) {
      const d = db(); ensure(isLeagueAdmin(d, l, "audit"));
      return d.audit.filter((a) => a.league_id === l && (!ref || Object.values(a.detail || {}).includes(ref))).slice().reverse().slice(0, Math.min(Math.max(lim || 100, 1), 500))
        .map((a) => ({ id: a.id, action: a.action, detail: a.detail, at: a.at, actor: (d.users.find((u) => u.id === a.actor) || {}).email || null }));
    },
    async adjustments(l, tid) { const d = db(); ensure(isLeagueAdmin(d, l)); const by = {}; d.sanc.filter((x) => x.league_id === l && x.tournament_id === tid && x.kind === "puntos" && x.status !== "revoked").forEach((x) => (by[x.team_id] = (by[x.team_id] || 0) + x.points)); return Object.entries(by).map(([team_id, points]) => ({ team_id, points })); },
    async sanctions(l) { const d = db(); return isLeagueAdmin(d, l, "sanctions") ? d.sanc.filter((x) => x.league_id === l).slice().reverse() : []; },
    async saveSanction(l, s) {
      const d = db(); ensure(isLeagueAdmin(d, l, "sanctions")); await lneed(l, "sanctions");
      const tm = s.team ? d.ttems.find((x) => x.id === s.team && x.league_id === l) : null; if (s.team) ensure(tm, "Equipo no encontrado");
      const num = (v) => (v === "" || v == null ? null : +v);
      if (!s.id) {
        const r = { id: "sn" + Date.now() + Math.random().toString(36).slice(2, 5), league_id: l, tournament_id: tm ? tm.tournament_id : null, team_id: tm ? tm.id : null, player: String(s.player || "").trim().slice(0, 60) || null, kind: s.kind,
          reason: String(s.reason || "").trim().slice(0, 500), matches: num(s.matches), points: num(s.points), amount: num(s.amount), starts_on: s.starts_on || null, ends_on: s.ends_on || null, evidence: String(s.evidence || "").trim().slice(0, 500) || null,
          status: "active", created_by: d.session, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        sanctionChecks(r); let cid = null;
        if (r.kind === "multa" && tm && s.charge) { await lneed(l, "league_finance"); cid = "ch" + Date.now() + Math.random().toString(36).slice(2, 5); d.chg.push({ id: cid, league_id: l, tournament_id: tm.tournament_id, team_id: tm.id, concept: ("Multa: " + r.reason).slice(0, 80), amount: r.amount, due_on: null, sanction_id: r.id, status: "active", void_reason: null, created_at: r.created_at }); }
        d.sanc.push(r); log(d, l, "sanction.create", { sanction: r.id, kind: r.kind, team: tm && tm.id, player: s.player, charge: cid }); save(d); return r.id;
      }
      const r = d.sanc.find((x) => x.id === s.id && x.league_id === l); ensure(r, "Sanción no encontrada"); ensure(r.status !== "revoked", "Esa sanción está revocada");
      const before = { reason: r.reason, matches: r.matches, points: r.points, amount: r.amount, ends_on: r.ends_on, evidence: r.evidence }, n = { ...r };
      if ("reason" in s) n.reason = String(s.reason).trim().slice(0, 500); if ("matches" in s) n.matches = num(s.matches); if ("points" in s) n.points = num(s.points); if ("amount" in s) n.amount = num(s.amount);
      if ("starts_on" in s) n.starts_on = s.starts_on || null; if ("ends_on" in s) n.ends_on = s.ends_on || null; if ("evidence" in s) n.evidence = String(s.evidence || "").trim().slice(0, 500) || null;
      sanctionChecks(n); Object.assign(r, n, { updated_at: new Date().toISOString() });
      log(d, l, "sanction.update", { sanction: r.id, before, after: { reason: s.reason, matches: s.matches, points: s.points, amount: s.amount, ends_on: s.ends_on, evidence: s.evidence } }); save(d); return r.id;
    },
    async setSanctionStatus(l, id, st, note) {
      const d = db(); ensure(isLeagueAdmin(d, l, "sanctions")); ensure(["active", "served", "revoked"].includes(st), "Datos no válidos"); const r = d.sanc.find((x) => x.id === id && x.league_id === l);
      ensure(r, "Sanción no encontrada"); ensure(r.status !== "revoked", "Esa sanción está revocada"); ensure(st !== "revoked" || String(note || "").trim().length >= 3, "Escribe el motivo");
      log(d, l, "sanction.status", { sanction: id, from: r.status, to: st, note: String(note || "").slice(0, 300) || null }); r.status = st; r.updated_at = new Date().toISOString();
      if (st === "revoked") d.chg.filter((c) => c.sanction_id === id && c.status === "active").forEach((c) => { c.status = "void"; c.void_reason = "Sanción revocada"; }); save(d);
    },
    async disputes(l) { const d = db(); return isLeagueAdmin(d, l, "sanctions") ? d.disp.filter((x) => x.league_id === l).slice().reverse() : []; },
    async fileDispute(l, x) {
      const d = db(); ensure(isLeagueAdmin(d, l, "sanctions")); await lneed(l, "sanctions"); ensure(["objection", "protest"].includes(x.kind), "Datos no válidos");
      const m = x.match ? d.lmatches.find((y) => y.id === x.match && y.league_id === l) : null; if (x.match) ensure(m, "Partido no encontrado");
      const tm = x.team ? d.ttems.find((y) => y.id === x.team && y.league_id === l) : null; if (x.team) ensure(tm, "Equipo no encontrado");
      if (x.sanction) ensure(d.sanc.some((y) => y.id === x.sanction && y.league_id === l), "Sanción no encontrada");
      const subject = String(x.subject || "").trim().slice(0, 120); ensure(subject.length >= 3, "Datos no válidos");
      const r = { id: "ds" + Date.now() + Math.random().toString(36).slice(2, 5), league_id: l, tournament_id: m ? m.tournament_id : tm ? tm.tournament_id : null, match_id: m ? m.id : null, sanction_id: x.sanction || null, team_id: tm ? tm.id : null, kind: x.kind, subject,
        detail: String(x.detail || "").trim().slice(0, 2000) || null, status: "open", resolution: null, resolved_by: null, resolved_at: null, created_by: d.session, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      d.disp.push(r); log(d, l, "dispute.file", { dispute: r.id, kind: x.kind, match: r.match_id, sanction: x.sanction || null, team: r.team_id }); save(d); return r.id;
    },
    async resolveDispute(l, id, st, res) {
      const d = db(); ensure(isLeagueAdmin(d, l, "sanctions")); ensure(["open", "in_review", "accepted", "rejected", "withdrawn"].includes(st), "Datos no válidos"); const r = d.disp.find((x) => x.id === id && x.league_id === l); ensure(r, "Objeción no encontrada");
      ensure(!["accepted", "rejected"].includes(st) || String(res || "").trim().length >= 3, "Escribe la resolución");
      const was = r.status, before = { status: was, resolution: r.resolution }, closed = ["accepted", "rejected", "withdrawn"].includes(st), text = String(res || "").trim().slice(0, 2000);
      r.status = st; r.resolution = ["accepted", "rejected"].includes(st) ? text : text || r.resolution; r.resolved_by = closed ? d.session : null; r.resolved_at = closed ? new Date().toISOString() : null; r.updated_at = new Date().toISOString();
      log(d, l, ["accepted", "rejected", "withdrawn"].includes(was) ? "dispute.change" : "dispute.resolve", { dispute: id, before, after: { status: st, resolution: res ? String(res).slice(0, 2000) : null } }); save(d);
    },
    async leagueFinance(l) { const d = db(); ensure(isLeagueAdmin(d, l, "finance")); return { charges: d.chg.filter((x) => x.league_id === l), movements: d.mov.filter((x) => x.league_id === l).slice().reverse() }; },
    async createCharges(l, tid, concept, amount, due, team) {
      const d = db(); ensure(isLeagueAdmin(d, l, "finance")); await lneed(l, "league_finance"); const cn = String(concept || "").trim().slice(0, 80);
      ensure(cn.length >= 2 && amount > 0 && amount <= 1000000, "Datos no válidos"); ensure(d.tourn.some((x) => x.id === tid && x.league_id === l), "Torneo no encontrado"); let n = 0;
      for (const t of d.ttems.filter((x) => x.tournament_id === tid && x.league_id === l && x.status === "active" && (!team || x.id === team))) {
        if (d.chg.some((c) => c.team_id === t.id && c.concept.toLowerCase() === cn.toLowerCase() && c.status === "active" && !c.sanction_id)) continue;
        d.chg.push({ id: "ch" + Date.now() + Math.random().toString(36).slice(2, 6) + n, league_id: l, tournament_id: tid, team_id: t.id, concept: cn, amount: +amount, due_on: due || null, sanction_id: null, status: "active", void_reason: null, created_at: new Date().toISOString() }); n++;
      }
      ensure(!team || n > 0, "Ese cargo ya existe para el equipo"); log(d, l, "charge.create", { tournament: tid, concept: cn, amount, count: n }); save(d); return n;
    },
    async voidCharge(l, id, reason) {
      const d = db(); ensure(isLeagueAdmin(d, l, "finance")); ensure(String(reason || "").trim().length >= 3, "Escribe el motivo"); const c = d.chg.find((x) => x.id === id && x.league_id === l && x.status === "active"); ensure(c, "Cargo no encontrado");
      c.status = "void"; c.void_reason = String(reason).trim().slice(0, 300); log(d, l, "charge.void", { charge: id, team: c.team_id, concept: c.concept, amount: c.amount, reason: c.void_reason }); save(d);
    },
    async recordMovement(l, m) {
      const d = db(); ensure(isLeagueAdmin(d, l, "finance")); await lneed(l, "league_finance"); const amt = +m.amount; ensure(["payment", "income", "expense"].includes(m.kind) && amt > 0 && amt <= 1000000, "Datos no válidos");
      const tm = m.team ? d.ttems.find((x) => x.id === m.team && x.league_id === l) : null; if (m.team) ensure(tm, "Equipo no encontrado"); ensure(m.kind !== "payment" || tm, "Elige el equipo que pagó");
      ensure(m.kind === "payment" || String(m.concept || "").trim().length >= 2, "Escribe el concepto");
      const ch = m.charge ? d.chg.find((x) => x.id === m.charge && x.league_id === l && x.status === "active") : null; if (m.charge) ensure(ch && tm && ch.team_id === tm.id, "Cargo no encontrado");
      const r = { id: "mv" + Date.now() + Math.random().toString(36).slice(2, 5), league_id: l, tournament_id: (tm || ch || {}).tournament_id || null, team_id: tm ? tm.id : null, charge_id: ch ? ch.id : null, kind: m.kind,
        concept: (String(m.concept || "").trim() || (ch && ch.concept) || (m.kind === "payment" ? "Pago" : "")).slice(0, 80), amount: amt, method: ["efectivo", "transferencia", "otro"].includes(m.method) ? m.method : "efectivo",
        paid_on: m.paid_on || new Date().toISOString().slice(0, 10), note: String(m.note || "").trim().slice(0, 300) || null, status: "active", void_reason: null, created_at: new Date().toISOString() };
      d.mov.push(r); log(d, l, "movement." + m.kind, { movement: r.id, team: r.team_id, charge: r.charge_id, amount: amt }); save(d); return r.id;
    },
    async voidMovement(l, id, reason) {
      const d = db(); ensure(isLeagueAdmin(d, l, "finance")); ensure(String(reason || "").trim().length >= 3, "Escribe el motivo"); const x = d.mov.find((y) => y.id === id && y.league_id === l && y.status === "active"); ensure(x, "Movimiento no encontrado");
      x.status = "void"; x.void_reason = String(reason).trim().slice(0, 300); log(d, l, "movement.void", { movement: id, kind: x.kind, team: x.team_id, amount: x.amount, reason: x.void_reason }); save(d);
    },
    // ----- torneos, calendario y resultados (mismas reglas que las funciones SQL) -----
    async tournaments(l) { const d = db(); return isLeagueAdmin(d, l) ? d.tourn.filter((x) => x.league_id === l).slice().reverse() : []; },
    async leagueTeams(l) { const d = db(); ensure(isLeagueAdmin(d, l)); return d.ttems.filter((x) => x.league_id === l && x.status === "active"); },
    async tournamentData(l, tid) {
      const d = db(); ensure(isLeagueAdmin(d, l)); const ms = d.lmatches.filter((m) => m.tournament_id === tid);
      return { teams: d.ttems.filter((x) => x.tournament_id === tid), matches: ms.slice().sort((a, b) => String(a.starts_at || "~").localeCompare(String(b.starts_at || "~"))), events: d.mevents.filter((e) => ms.some((m) => m.id === e.match_id)) };
    },
    async createTournament(l, t) {
      const d = db(); ensure(isLeagueAdmin(d, l, "tournaments")); const e = await api.entitlement("league", l);
      ensure((e.features || []).includes("tournaments"), "Tu plan no incluye esa función");
      ensure(e.limits.tournaments == null || d.tourn.filter((x) => x.league_id === l && x.status !== "finished").length < e.limits.tournaments, "Tu plan llegó al límite de torneos");
      const r = { id: "tn" + Date.now() + Math.random().toString(36).slice(2, 5), league_id: l, status: "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...tFields({}, t) };
      d.tourn.push(r); log(d, l, "tournament.create", { tournament: r.id, name: r.name }); save(d); return r.id;
    },
    async updateTournament(l, id, t) {
      const d = db(); ensure(isLeagueAdmin(d, l, "tournaments")); const r = d.tourn.find((x) => x.id === id && x.league_id === l); ensure(r, "Torneo no encontrado"); ensure(r.status !== "finished", "El torneo ya terminó");
      Object.assign(r, tFields(r, t), { updated_at: new Date().toISOString() }); log(d, l, "tournament.update", { tournament: id, fields: Object.keys(t) }); save(d);
    },
    async setTournamentStatus(l, id, st) {
      const d = db(); ensure(isLeagueAdmin(d, l, "tournaments")); ensure(["draft", "published", "paused", "finished"].includes(st), "Datos no válidos");
      const r = d.tourn.find((x) => x.id === id && x.league_id === l); ensure(r, "Torneo no encontrado"); ensure(r.status !== "finished" || st === "published", "El torneo ya terminó");
      log(d, l, "tournament.status", { tournament: id, from: r.status, to: st }); r.status = st; r.updated_at = new Date().toISOString(); save(d);
    },
    async addTournamentTeam(l, tid, { name, link, contact }) {
      const d = db(); ensure(isLeagueAdmin(d, l, "tournaments")); ensure(d.tourn.some((x) => x.id === tid && x.league_id === l && x.status !== "finished"), "Torneo no encontrado");
      let nm = String(name || "").trim().slice(0, 60);
      if (link) { const lt = d.lteams.find((x) => x.id === link && x.league_id === l && x.status === "approved"); ensure(lt, "Ese equipo no está vinculado a la liga"); nm = nm || lt.team_name; }
      ensure(nm.length >= 2, "Escribe el nombre del equipo");
      ensure(!d.ttems.some((x) => x.tournament_id === tid && x.status === "active" && (x.name.toLowerCase() === nm.toLowerCase() || (link && x.link_id === link))), "Ese equipo ya está inscrito");
      const r = { id: "tt" + Date.now() + Math.random().toString(36).slice(2, 5), tournament_id: tid, league_id: l, name: nm, link_id: link || null, contact: String(contact || "").trim().slice(0, 120) || null, status: "active", created_at: new Date().toISOString() };
      d.ttems.push(r); log(d, l, "tournament.team_add", { tournament: tid, team: nm }); save(d); return r.id;
    },
    async removeTournamentTeam(l, id) {
      const d = db(); ensure(isLeagueAdmin(d, l, "tournaments")); const r = d.ttems.find((x) => x.id === id && x.league_id === l && x.status === "active"); ensure(r, "Equipo no encontrado");
      const mine = (m) => m.home_id === id || m.away_id === id;
      if (d.lmatches.some((m) => m.status === "played" && mine(m))) {
        r.status = "withdrawn"; d.lmatches.filter((m) => ["scheduled", "postponed"].includes(m.status) && mine(m)).forEach((m) => { m.status = "canceled"; m.notes = (m.notes ? m.notes + " · " : "") + "Equipo retirado"; });
      } else { d.lmatches = d.lmatches.filter((m) => !mine(m)); d.ttems = d.ttems.filter((x) => x.id !== id); }
      log(d, l, "tournament.team_remove", { tournament: r.tournament_id, team: r.name }); save(d);
    },
    async leagueSaveMatch(l, m) {
      const d = db(); ensure(isLeagueAdmin(d, l, "schedule")); await lneed(l, "schedule"); const st = m.status || "scheduled"; ensure(["scheduled", "postponed", "canceled"].includes(st), "Datos no válidos");
      const f = { round: String(m.round || "").trim().slice(0, 20) || null, starts_at: m.starts_at || null, venue: String(m.venue || "").trim().slice(0, 40) || null, notes: String(m.notes || "").trim().slice(0, 500) || null, status: st };
      if (!m.id) {
        ensure(d.tourn.some((x) => x.id === m.tournament && x.league_id === l), "Torneo no encontrado");
        const r = { id: "lm" + Date.now() + Math.random().toString(36).slice(2, 5), tournament_id: m.tournament, league_id: l, home_id: m.home, away_id: m.away, home_goals: null, away_goals: null, updated_at: new Date().toISOString(), ...f };
        matchGuard(d, r); d.lmatches.push(r); log(d, l, "match.create", { match: r.id }); save(d); return r.id;
      }
      const r = d.lmatches.find((x) => x.id === m.id && x.league_id === l); ensure(r, "Partido no encontrado"); ensure(r.status !== "played", "Ese partido ya tiene resultado");
      const before = { starts_at: r.starts_at, venue: r.venue, status: r.status }, nr = { ...r, ...f, home_id: m.home || r.home_id, away_id: m.away || r.away_id };
      matchGuard(d, nr); Object.assign(r, nr, { updated_at: new Date().toISOString() });
      log(d, l, before.starts_at !== f.starts_at || before.venue !== f.venue ? "match.reschedule" : "match.update", { match: r.id, from: before, to: { starts_at: f.starts_at, venue: f.venue, status: st } }); save(d); return r.id;
    },
    async leagueCreateMatches(l, tid, ms) {
      const d = db(); ensure(isLeagueAdmin(d, l, "schedule")); await lneed(l, "schedule"); ensure(Array.isArray(ms) && ms.length <= 400, "Datos no válidos"); ensure(d.tourn.some((x) => x.id === tid && x.league_id === l), "Torneo no encontrado");
      const made = []; for (const m of ms) { const r = { id: "lm" + Date.now() + Math.random().toString(36).slice(2, 5) + made.length, tournament_id: tid, league_id: l, round: m.round || null, starts_at: m.starts_at || null, venue: m.venue || null, home_id: m.home, away_id: m.away, status: "scheduled", home_goals: null, away_goals: null, notes: null }; matchGuard(d, r, made); made.push(r); }
      d.lmatches.push(...made); log(d, l, "match.generate", { tournament: tid, count: made.length }); save(d); return made.length;
    },
    async leagueDeleteMatch(l, id) {
      const d = db(); ensure(isLeagueAdmin(d, l, "schedule")); const r = d.lmatches.find((x) => x.id === id && x.league_id === l); ensure(r, "Partido no encontrado"); ensure(r.status !== "played", "Ese partido ya tiene resultado");
      d.lmatches = d.lmatches.filter((x) => x.id !== id); log(d, l, "match.delete", { match: id, round: r.round }); save(d);
    },
    async recordResult(l, id, hg, ag, events, notes) {
      const d = db(); ensure(isLeagueAdmin(d, l, "results")); const r = d.lmatches.find((x) => x.id === id && x.league_id === l); ensure(r, "Partido no encontrado");
      ensure(d.tourn.find((x) => x.id === r.tournament_id).status !== "finished", "El torneo ya terminó");
      ensure(Number.isInteger(hg) && Number.isInteger(ag) && hg >= 0 && ag >= 0 && hg <= 99 && ag <= 99, "Datos no válidos"); events = events || []; ensure(events.length <= 100, "Datos no válidos");
      let gh = 0, ga = 0;
      for (const e of events) {
        ensure([r.home_id, r.away_id].includes(e.team) && ["goal", "own_goal", "yellow", "red"].includes(e.kind) && String(e.player || "").trim().length >= 1, "Datos no válidos"); const n = e.n || 1;
        if (e.kind === "goal") e.team === r.home_id ? (gh += n) : (ga += n); else if (e.kind === "own_goal") e.team === r.home_id ? (ga += n) : (gh += n);
      }
      ensure(gh <= hg && ga <= ag, "Los goles de los jugadores superan el marcador");
      const was = r.status, before = { status: was, home: r.home_goals, away: r.away_goals, events: d.mevents.filter((e) => e.match_id === id).length };
      d.mevents = d.mevents.filter((e) => e.match_id !== id).concat(events.map((e, i) => ({ id: "me" + Date.now() + i, match_id: id, league_id: l, team_id: e.team, player: String(e.player).trim().slice(0, 60), kind: e.kind, n: e.n || 1 })));
      Object.assign(r, { status: "played", home_goals: hg, away_goals: ag, notes: String(notes || "").trim().slice(0, 500) || null, updated_at: new Date().toISOString() });
      log(d, l, was === "played" ? "result.correct" : "result.record", { match: id, before, after: { home: hg, away: ag, events: events.length } }); save(d);
    },
    async clearResult(l, id) {
      const d = db(); ensure(isLeagueAdmin(d, l, "results")); const r = d.lmatches.find((x) => x.id === id && x.league_id === l && x.status === "played"); ensure(r, "Partido no encontrado");
      log(d, l, "result.clear", { match: id, before: { home: r.home_goals, away: r.away_goals } }); d.mevents = d.mevents.filter((e) => e.match_id !== id);
      Object.assign(r, { status: "scheduled", home_goals: null, away_goals: null, updated_at: new Date().toISOString() }); save(d);
    },
    // ----- pagos -----
    async paid(c, t) { return db().pays.filter((p) => same(c, t)(p) && p.status === "approved").map(({ kind, item, player_id, amount, detail, decided_at }) => ({ kind, item, player_id, amount, detail, decided_at })); },
    async myPayments(c, t) { const d = db(); return d.pays.filter((p) => same(c, t)(p) && p.user_id === d.session && p.kind !== "salida").reverse().slice(0, 20); },
    async pendingPayments(c, t) { const d = db(); ensure(isAdmin(d, c, t)); return d.pays.filter((p) => same(c, t)(p) && p.status === "pending").map((p) => ({ ...p, receipt_url: p.receipt })); },
    async reportPayment(c, t, { kind, amount, detail, file }) {
      await need(c, t, "finance"); const d = db(); const m = approved(d, c, t); ensure(m && m.player_id); ensure(amount > 0, "payments_amount");
      d.pays.push({ id: "p" + Date.now(), club_id: c, team_id: t, user_id: m.user_id, player_id: m.player_id, kind, amount, detail: detail || null, receipt: file ? await dataURL(file) : null, status: "pending", created_at: new Date().toISOString(), decided_at: null });
      save(d);
    },
    async adminPayment(c, t, { kind, item, player, amount, detail }) {
      await need(c, t, "finance"); const d = db(); ensure(isAdmin(d, c, t)); ensure(amount > 0, "payments_amount"); const now = new Date().toISOString();
      d.pays.push({ id: "p" + Date.now(), club_id: c, team_id: t, user_id: d.session, player_id: player || null, kind, item: item || null, amount, detail: detail || null, receipt: null, status: "approved", created_at: now, decided_at: now });
      save(d);
    },
    async decidePayment(c, t, id, status) { const d = db(); ensure(isAdmin(d, c, t)); const p = d.pays.find((x) => x.id === id); p.status = status; p.decided_at = new Date().toISOString(); save(d); },
  };
}
