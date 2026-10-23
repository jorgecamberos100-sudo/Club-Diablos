// Cada formación debe tener exactamente tantos puestos como jugadores de su modalidad, un portero y posiciones válidas.
import { FORMS } from "../../app/views/alineacion.js";
let bad = 0;
const counts = {};
for (const [name, f] of Object.entries(FORMS)) {
  counts[f.f] = (counts[f.f] || 0) + 1;
  const por = f.s.filter((s) => s.c === "POR").length;
  const ok = f.s.length === f.f && por === 1 && f.s.every((s) => s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100);
  if (!ok) { bad++; console.log("FALLA", name, "jugadores", f.s.length, "esperados", f.f, "porteros", por); }
}
for (const n of [5, 6, 7, 8, 9, 11]) if (!counts[n]) { bad++; console.log("FALLA: no hay formaciones de fútbol", n); }
console.log(bad ? `${bad} problemas` : `Formaciones correctas: ${JSON.stringify(counts)}`);
process.exit(bad ? 1 : 0);
