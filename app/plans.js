// Planes y permisos. La app nunca pregunta "¿es Pro?": pregunta "¿puede usar X?".
// Así un plan cambia de funciones o límites editando la tabla "plans" en Supabase, sin tocar código.
// DEFAULTS es la misma configuración que siembra schema.sql; se usa en modo demo o si no hay conexión.
// Precios decididos (nov 2026): Free $0, Pro Equipo $49/mes, Pro Liga $999/mes,
// Liga + Equipos $1,499/mes, Enterprise desde $4,999/mes (por cotización). Anual = mensual x 12.

import { money } from "./util.js";

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
  actas: "Actas desde foto",
  team_pro_grant: "Pro para los equipos de la liga",
};

export const DEFAULTS = [
  { id: "team-free", audience: "team", name: "Equipo Gratis", tier: 0, is_default: true,
    features: ["roster", "attendance", "matches", "lineup"], limits: { teams: 1, players: 30 }, price_monthly: 0, price_annual: 0 },
  { id: "team-pro", audience: "team", name: "Equipo Pro", tier: 1,
    features: ["roster", "attendance", "matches", "lineup", "ratings", "finance", "receipts", "stats", "themes", "share_capture"], limits: { teams: 5, players: null }, price_monthly: 49, price_annual: 588 },
  { id: "league-free", audience: "league", name: "Liga Gratis", tier: 0, is_default: true,
    features: ["league_panel", "tournaments", "schedule", "standings"], limits: { tournaments: 1, admins: 2, pro_teams_included: 0 }, price_monthly: 0, price_annual: 0 },
  { id: "league-pro", audience: "league", name: "Liga Pro", tier: 2,
    features: ["league_panel", "tournaments", "schedule", "standings", "sanctions", "league_finance", "registration", "credentials", "public_page", "actas", "team_pro_grant"],
    limits: { tournaments: null, admins: 5, pro_teams_included: 0 }, price_monthly: 999, price_annual: 11988 },
  { id: "league-plus", audience: "league", name: "Liga + Equipos", tier: 3,
    features: ["league_panel", "tournaments", "schedule", "standings", "sanctions", "league_finance", "registration", "credentials", "public_page", "actas", "team_pro_grant"],
    limits: { tournaments: null, admins: 10, pro_teams_included: null }, price_monthly: 1499, price_annual: 17988 },
  { id: "league-enterprise", audience: "league", name: "Enterprise", tier: 4,
    features: ["league_panel", "tournaments", "schedule", "standings", "sanctions", "league_finance", "registration", "credentials", "public_page", "actas", "team_pro_grant"],
    limits: { tournaments: null, admins: null, pro_teams_included: null }, price_monthly: 4999, price_annual: 59988 },
];

export const defaultPlan = (audience) => ({ ...DEFAULTS.find((p) => p.audience === audience && p.is_default), source: "default" });

// Precio en MXN para mostrar. Enterprise se vende por cotización: el precio es "desde".
export function priceLine(p) {
  if (!p) return "—";
  if (p.price_monthly == null) return "Precio por confirmar";
  if (+p.price_monthly === 0) return "Gratis";
  const base = `${money(+p.price_monthly)} MXN/mes${p.price_annual != null ? ` · ${money(+p.price_annual)} MXN/año` : ""}`;
  return p.id === "league-enterprise" ? `desde ${base} · por cotización` : base;
}

// Resumen de límites para mostrar en la lista de planes.
export function limitsLine(p) {
  const l = p.limits || {};
  const parts = [];
  if (l.teams != null) parts.push(`${l.teams} equipo${l.teams === 1 ? "" : "s"}`);
  if (l.players != null) parts.push(`${l.players} jugadores`);
  else if (l.teams != null) parts.push("jugadores sin límite");
  if (l.tournaments != null) parts.push(`${l.tournaments} torneo${l.tournaments === 1 ? "" : "s"}`);
  else if (p.audience === "league") parts.push("torneos sin límite");
  if (l.admins != null) parts.push(`${l.admins} administradores`);
  else if (p.audience === "league") parts.push("administradores sin límite");
  if (l.pro_teams_included == null && p.audience === "league" && p.tier >= 3) parts.push("Pro para todos sus equipos");
  return parts.join(" · ");
}

// ent = resultado de api.entitlement(); null = sin plan cargado (se comporta como gratis).
export const can = (ent, feature) => !!ent && (ent.features || []).includes(feature);

// Límite numérico; null o ausente = sin límite.
export function within(ent, key, count) {
  const v = ent && ent.limits ? ent.limits[key] : null;
  return v == null || count < v;
}
