// Reportes para imprimir o guardar como PDF (desde el diálogo de impresión del navegador: «Guardar como PDF»).
// Las funciones que arman el HTML son puras y se prueban en tests/unit/test_printout.mjs. Nunca llevan fechas de nacimiento, documentos ni contactos.
import { esc } from "../util.js";
import { standings, scorers } from "./standings.js";
import { hasGroups, hasKO, groupTables } from "./bracket.js";
import { tableHTML, bracketHTML, score } from "./views.js";
import { balances, cash } from "./report.js";

const money = (n) => "$" + (+n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fdate = (v) => { if (!v) return "Sin fecha"; const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(v); const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
  return d.toLocaleString("es-MX", m ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); };

export function standingsReport(t, d) {
  const fmt = t.format || "league", name = (id) => (d.teams.find((x) => x.id === id) || {}).name || "—";
  let out = "";
  if (fmt === "league") out += tableHTML(standings(t, d.teams, d.matches.filter((m) => (m.stage || "league") === "league"), d.events, d.adjust || []));
  if (hasGroups(t)) out += groupTables(t, d.teams, d.matches, d.events, d.adjust || []).map((g) => `<h2>Grupo ${esc(g.group)}</h2>` + tableHTML(g.rows, { advance: fmt === "groups_knockout" ? t.advance : 0 })).join("");
  if (hasKO(t)) out += `<h2>Eliminatoria</h2>` + bracketHTML(d.matches, name);
  return out || `<p>Sin equipos.</p>`;
}

export function scheduleReport(d) {
  const name = (id) => (d.teams.find((x) => x.id === id) || {}).name || "—";
  const ms = d.matches.slice().sort((a, b) => (a.starts_at || "9999").localeCompare(b.starts_at || "9999"));
  if (!ms.length) return `<p>Sin partidos.</p>`;
  return `<table class="rep-t"><thead><tr><th>Jornada</th><th>Fecha</th><th>Local</th><th>Marcador</th><th>Visitante</th><th>Cancha</th></tr></thead><tbody>${ms.map((m) =>
    `<tr><td>${esc((m.group_label ? m.group_label + " · " : "") + (m.round || ""))}</td><td>${esc(fdate(m.starts_at))}</td><td>${esc(name(m.home_id))}</td><td>${esc(m.status === "canceled" ? "Cancelado" : m.status === "postponed" ? "Pospuesto" : score(m))}</td><td>${esc(name(m.away_id))}</td><td>${esc(m.venue || "")}</td></tr>`).join("")}</tbody></table>`;
}

export function scorersReport(d) {
  const sc = scorers(d.teams, d.matches, d.events);
  return sc.length ? `<table class="rep-t"><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr></thead><tbody>${sc.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.player)}</td><td>${esc(s.team)}</td><td>${s.goals}</td></tr>`).join("")}</tbody></table>` : `<p>Sin goles registrados.</p>`;
}

export function financeReport(teams, charges, movements) {
  const bal = balances(teams, charges, movements), c = cash(movements);
  return `<table class="rep-t"><thead><tr><th>Equipo</th><th>Cargos</th><th>Pagos</th><th>Saldo</th></tr></thead><tbody>${bal.map((b) => `<tr><td>${esc(b.name)}</td><td>${money(b.charged)}</td><td>${money(b.paid)}</td><td>${b.balance > 0 ? "Debe " + money(b.balance) : b.balance < 0 ? "A favor " + money(-b.balance) : "Al corriente"}</td></tr>`).join("")}</tbody></table>
    <p>Ingresos ${money(c.income)} · Gastos ${money(c.expense)} · Caja neta <b>${money(c.net)}</b></p><p class="rep-n">Registro administrativo de la liga: la app no cobra dinero.</p>`;
}

// Planilla de un equipo para el día de partido: nombre y número de los jugadores activos, con espacio para goles y tarjetas. Sin datos personales.
export function rosterSheet(team, players, regs) {
  const act = regs.filter((r) => r.team_id === team.id && r.status === "active").map((r) => ({ name: (players.find((p) => p.id === r.player_id) || {}).name || "", number: r.number }))
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es"));
  return `<h2>${esc(team.name)}</h2><table class="rep-t"><thead><tr><th>#</th><th>Jugador</th><th>Goles</th><th>Amarilla</th><th>Roja</th><th>Firma</th></tr></thead><tbody>${act.map((p) =>
    `<tr><td>${p.number ?? ""}</td><td>${esc(p.name)}</td><td></td><td></td><td></td><td></td></tr>`).join("")}${Array.from({ length: 3 }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>").join("")}</tbody></table>`;
}

export function docHTML({ league, title, sub, body, logo }) {
  const now = new Date().toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
  return `<article class="rep"><header class="rep-h">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><small>${esc(league)}</small><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div></header>${body}<footer class="rep-f">Generado el ${esc(now)}</footer></article>`;
}

export async function printDoc(opts) {
  let root = document.getElementById("print-root");
  if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.appendChild(root); }
  root.innerHTML = docHTML(opts);
  await Promise.all([...root.querySelectorAll("img")].map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));
  const clean = () => { root.innerHTML = ""; window.removeEventListener("afterprint", clean); };
  window.addEventListener("afterprint", clean); window.print();
}
