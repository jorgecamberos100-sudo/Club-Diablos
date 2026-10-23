// Piezas de presentación compartidas por el panel de la liga y la página pública: tabla de posiciones y llaves de eliminatoria.
import { esc } from "../util.js";
import { koRounds, koWinner, champion } from "./bracket.js";

// rows: resultado de standings(). advance: cuántos pasan (se marcan) o 0.
export function tableHTML(rows, { advance = 0, adj = true } = {}) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Equipo</th><th title="Jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th><th title="Perdidos">P</th><th title="Goles a favor">GF</th><th title="Goles en contra">GC</th><th title="Diferencia">DG</th><th title="Puntos">Pts</th></tr></thead><tbody>${rows.map((r) =>
    `<tr${advance && r.pos <= advance && !r.withdrawn ? ' class="q"' : ""}><td>${r.pos}</td><td class="nm">${esc(r.name)}${r.withdrawn ? " <small>(retirado)</small>" : ""}</td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.gf}</td><td>${r.gc}</td><td>${r.dg > 0 ? "+" : ""}${r.dg}</td><td><b>${r.pts}</b>${adj && r.adj ? ` <small title="Descuento por sanción">(${r.adj})</small>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}

export const score = (m) => m.status === "played" ? `${m.home_goals} - ${m.away_goals}${m.home_pens != null ? ` (${m.home_pens}-${m.away_pens} pen.)` : ""}` : "vs";

// Llaves por ronda, con el ganador marcado. name: id -> nombre.
export function bracketHTML(matches, name) {
  const rs = koRounds(matches);
  if (!rs.length) return `<p class="hint">La eliminatoria todavía no está armada.</p>`;
  const ch = champion(matches);
  return `<div class="bracket">${rs.map((r) => `<div class="br-round"><h3>${esc(r.name)}</h3>${r.matches.map((m) => { const w = koWinner(m);
    return `<div class="br-m"><span class="${w === m.home_id ? "w" : ""}">${esc(name(m.home_id))}</span><b>${esc(score(m))}</b><span class="${w === m.away_id ? "w" : ""}">${esc(name(m.away_id))}</span></div>`; }).join("")}</div>`).join("")}</div>`
    + (ch ? `<p class="champ">Campeón: <b>${esc(name(ch))}</b></p>` : "");
}
