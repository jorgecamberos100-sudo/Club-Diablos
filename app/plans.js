// Planes y permisos. La app nunca pregunta "¿es Pro?": pregunta "¿puede usar X?".
// Así un plan cambia de funciones o límites editando la tabla "plans" en Supabase, sin tocar código.
// DEFAULTS es la misma configuración que siembra schema.sql; se usa en modo demo o si no hay conexión.

export const FEATURES = {
  // equipo
  roster: "Plantel y jugadores sin cuenta",
  attendance: "Asistencia",
  matches: "Partidos y resultados",
  lineup: "Alineación",
  ratings: "Calificaciones y mejor del partido",
  finance: "Finanzas del equipo",
  receipts: "Comprobantes de pago",
  stats: "Estadísticas",
  themes: "Estética propia del equipo",
  share_capture: "Asistencia desde captura",
  // liga
  league_panel: "Panel de liga",
  tournaments: "Temporadas, torneos y categorías",
  schedule: "Jornadas, horarios y canchas",
  standings: "Tablas y goleo",
  sanctions: "Sanciones, objeciones y actas",
  league_finance: "Finanzas de la liga",
  registration: "Registro de jugadores",
  credentials: "Credenciales para imprimir",
  public_page: "Página pública",
  team_pro_grant: "Pro para los equipos de la liga",
};

export const DEFAULTS = [
  { id: "team-free", audience: "team", name: "Equipo Gratis", tier: 0, is_default: true,
    features: ["roster", "attendance", "matches", "lineup"], limits: { teams: 1, players: 30 } },
  { id: "team-pro", audience: "team", name: "Equipo Pro", tier: 1,
    features: ["roster", "attendance", "matches", "lineup", "ratings", "finance", "receipts", "stats", "themes", "share_capture"], limits: { teams: 5, players: null } },
  { id: "league-base", audience: "league", name: "Liga", tier: 1, is_default: true,
    features: ["league_panel", "tournaments", "schedule", "standings", "sanctions", "league_finance", "registration", "credentials", "public_page", "team_pro_grant"],
    limits: { tournaments: null, admins: 5, pro_teams_included: 0 } },
];

export const defaultPlan = (audience) => ({ ...DEFAULTS.find((p) => p.audience === audience && p.is_default), source: "default" });

// ent = resultado de api.entitlement(); null = sin plan cargado (se comporta como gratis).
export const can = (ent, feature) => !!ent && (ent.features || []).includes(feature);

// Límite numérico; null o ausente = sin límite.
export function within(ent, key, count) {
  const v = ent && ent.limits ? ent.limits[key] : null;
  return v == null || count < v;
}
