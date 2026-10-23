// Textos legibles para la bitácora de la liga.
const LABEL = {
  "tournament.create": "Creó un torneo", "tournament.update": "Editó un torneo", "tournament.status": "Cambió el estado del torneo", "tournament.team_add": "Inscribió un equipo", "tournament.team_remove": "Quitó un equipo del torneo",
  "match.create": "Programó un partido", "match.generate": "Generó el calendario", "match.reschedule": "Reprogramó un partido", "match.update": "Editó un partido", "match.delete": "Eliminó un partido",
  "result.record": "Capturó un resultado", "result.correct": "Corrigió un resultado", "result.clear": "Borró un resultado",
  "sanction.create": "Registró una sanción", "sanction.update": "Editó una sanción", "sanction.status": "Cambió el estado de una sanción",
  "dispute.file": "Registró una objeción o protesta", "dispute.resolve": "Resolvió una objeción o protesta", "dispute.change": "Cambió una resolución",
  "charge.create": "Creó cargos", "charge.void": "Anuló un cargo", "movement.payment": "Registró un pago", "movement.income": "Registró un ingreso", "movement.expense": "Registró un gasto", "movement.void": "Anuló un movimiento",
  "admin.invite": "Invitó a un administrador", "admin.invite_revoke": "Revocó una invitación", "admin.join": "Un administrador aceptó su invitación", "admin.perms": "Cambió permisos de un administrador", "admin.revoke": "Quitó a un administrador",
  "invite.create": "Creó una invitación de equipos", "invite.revoke": "Revocó una invitación de equipos",
};
export const actionLabel = (a) => LABEL[a] || a;

const show = (v) => (v == null || v === "" ? "—" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v));
export function detailText(a) {
  const d = a.detail || {}, out = [];
  if (d.before && d.after && typeof d.before === "object") {
    for (const k of Object.keys(d.after)) if (show(d.before[k]) !== show(d.after[k])) out.push(`${k}: ${show(d.before[k])} → ${show(d.after[k])}`);
  } else if (d.from !== undefined && d.to !== undefined) out.push(`${show(d.from && d.from.status !== undefined ? d.from.status : d.from)} → ${show(d.to && d.to.status !== undefined ? d.to.status : d.to)}`);
  for (const k of ["name", "team", "concept", "amount", "reason", "note"]) if (d[k] != null && d[k] !== "" && typeof d[k] !== "object" && !(k === "team" && /^[0-9a-f-]{20,}$/.test(String(d[k])))) out.push(`${k === "name" ? "" : k + ": "}${d[k]}`);
  return out.slice(0, 5).join(" · ");
}
