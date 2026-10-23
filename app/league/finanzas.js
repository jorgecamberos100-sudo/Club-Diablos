// Sección Finanzas de la liga: cargos a los equipos, pagos, ingresos y gastos de la liga.
// Son registros administrativos de la liga. No tienen relación con el contrato ni los pagos a la plataforma.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { can as hasFeature } from "../plans.js";
import { card, chip, row, btn, empty, dshort, toast, saveFile } from "../ui.js";
import { balances, cash, toCSV } from "./report.js";
import { printDoc, financeReport } from "./printout.js";
import * as sheet from "../sheet.js";

const money = (n) => "$" + (+n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const KIND = { payment: "Pago de equipo", income: "Ingreso", expense: "Gasto" };
const METHOD = { efectivo: "Efectivo", transferencia: "Transferencia", otro: "Otro" };
let S = null, tid = null;

export async function render(ctx) {
  if (!ctx.can("finance")) return card("Finanzas", empty("Tu cuenta no tiene permiso para ver las finanzas de la liga."));
  const [fin, teams, tours] = await Promise.all([api.leagueFinance(ctx.id), api.leagueTeams(ctx.id), api.tournaments(ctx.id)]);
  if (!tours.some((t) => t.id === tid)) tid = (tours[0] || {}).id || null;
  S = { ctx, ...fin, teams, tours };
  const enabled = hasFeature(ctx.ent, "league_finance");
  const inT = teams.filter((t) => t.tournament_id === tid);
  const bal = balances(inT, fin.charges, fin.movements), c = cash(fin.movements.filter((m) => !m.tournament_id || m.tournament_id === tid || m.kind !== "payment"));
  const owed = bal.filter((b) => b.balance > 0).reduce((a, b) => a + b.balance, 0);
  const tsel = tours.length ? `<label class="fld-inline">Torneo<select data-la-change="tour">${tours.map((t) => `<option value="${esc(t.id)}"${t.id === tid ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>` : "";
  const head = card("Resumen", `${tsel}
    <div class="stats three"><div><b>${money(bal.reduce((a, b) => a + b.paid, 0))}</b><small>Cobrado</small></div><div><b>${money(owed)}</b><small>Por cobrar</small></div><div><b>${money(c.net)}</b><small>Caja neta</small></div></div>
    <p class="hint">Ingresos ${money(c.income)} · Gastos ${money(c.expense)}. Es el registro de la liga: no cobra dinero dentro de la app.</p>`);
  const teamRows = bal.length ? bal.map((b) => row(b.name, `Cargos ${money(b.charged)} · Pagos ${money(b.paid)}`,
    chip(b.balance > 0 ? "Debe " + money(b.balance) : b.balance < 0 ? "A favor " + money(-b.balance) : "Al corriente", b.balance > 0 ? "due" : "ok")
    + (enabled ? btn("Pago", `data-la="pay" data-id="${esc(b.team_id)}"`) + btn("Cargo", `data-la="charge1" data-id="${esc(b.team_id)}"`, "ghost") : "")
    + btn("Detalle", `data-la="detail" data-id="${esc(b.team_id)}"`, "ghost"))).join("") : empty(tours.length ? "Inscribe equipos en el torneo para cobrarles." : "Primero crea un torneo.");
  const teamCard = card("Equipos", teamRows + `<div class="row-acts">${enabled && inT.length ? btn("Cargar a todos los equipos", 'data-la="chargeall"') : ""}${bal.length ? btn("Exportar saldos", 'data-la="csv-bal"', "ghost") + btn("Imprimir / PDF", 'data-la="print"', "ghost") : ""}</div>${enabled ? "" : '<p class="hint">Tu plan no incluye finanzas de la liga.</p>'}`);
  const mv = fin.movements.filter((m) => !m.tournament_id || m.tournament_id === tid || !tid);
  const mvCard = card("Movimientos", (mv.length ? mv.slice(0, 40).map((m) => row(`${m.concept}${m.status === "void" ? " (anulado)" : ""}`, [KIND[m.kind], m.team_id && (teams.find((t) => t.id === m.team_id) || {}).name, METHOD[m.method], dshort(m.paid_on), m.note, m.void_reason && "Anulado: " + m.void_reason].filter(Boolean).join(" · "),
    chip((m.kind === "expense" ? "-" : "+") + money(m.amount), m.status === "void" ? "na" : m.kind === "expense" ? "due" : "ok") + (m.status === "active" && enabled ? btn("Anular", `data-la="voidm" data-id="${esc(m.id)}"`, "ghost") : ""))).join("") : empty("Todavía no hay movimientos."))
    + `<div class="row-acts">${enabled ? btn("Registrar ingreso o gasto", 'data-la="other"') : ""}${fin.movements.length ? btn("Exportar movimientos", 'data-la="csv-mov"', "ghost") : ""}</div>`);
  return head + teamCard + mvCard;
}

const done = (ctx) => (ctx.reload(), undefined);
const tn = (id) => (S.teams.find((t) => t.id === id) || {}).name || "";
export const forms = {};
export const actions = {
  async pay(ctx, el) { paySheet(el.dataset.id); },
  async charge1(ctx, el) { chargeSheet(el.dataset.id); },
  async chargeall() { chargeSheet(null); },
  async other() { otherSheet(); },
  async detail(ctx, el) {
    const id = el.dataset.id, ch = S.charges.filter((c) => c.team_id === id), mv = S.movements.filter((m) => m.team_id === id);
    sheet.open(tn(id), "Cargos y pagos", `${ch.map((c) => row(c.concept + (c.status === "void" ? " (anulado)" : ""), [c.due_on && "vence " + dshort(c.due_on), c.void_reason].filter(Boolean).join(" · "), chip(money(c.amount), c.status === "void" ? "na" : "due")
      + (c.status === "active" && hasFeature(ctx.ent, "league_finance") ? btn("Anular", `data-fj="voidc" data-id="${esc(c.id)}"`, "ghost") : ""))).join("") || empty("Sin cargos.")}
      <h3>Pagos</h3>${mv.map((m) => row(m.concept + (m.status === "void" ? " (anulado)" : ""), [METHOD[m.method], dshort(m.paid_on)].join(" · "), chip(money(m.amount), m.status === "void" ? "na" : "ok"))).join("") || empty("Sin pagos.")}`);
  },
  async voidm(ctx, el) {
    const why = prompt("Motivo para anular este movimiento (queda en el historial):"); if (why === null) return;
    await api.voidMovement(ctx.id, el.dataset.id, why); toast("Movimiento anulado"); done(ctx);
  },
  async print(ctx) {
    const inT = S.teams.filter((t) => t.tournament_id === tid), t = (S.tours || []).find((x) => x.id === tid) || {}, brand = await api.leagueBrand(ctx.id).catch(() => ({}));
    await printDoc({ league: ctx.l.name, title: "Saldos de los equipos", sub: t.name || "", logo: brand.logo, body: financeReport(inT, S.charges, S.movements.filter((m) => !m.tournament_id || m.tournament_id === tid || m.kind !== "payment")) });
  },
  async "csv-bal"() {
    const inT = S.teams.filter((t) => t.tournament_id === tid), bal = balances(inT, S.charges, S.movements);
    saveFile("saldos-equipos.csv", toCSV([["name", "Equipo"], ["charged", "Cargos"], ["paid", "Pagos"], ["balance", "Saldo (positivo = debe)"]], bal)); toast("Archivo generado");
  },
  async "csv-mov"() {
    saveFile("movimientos-liga.csv", toCSV([["paid_on", "Fecha"], [(r) => KIND[r.kind], "Tipo"], ["concept", "Concepto"], [(r) => tn(r.team_id), "Equipo"], [(r) => METHOD[r.method], "Forma"], ["amount", "Monto"], [(r) => (r.status === "void" ? "Anulado" : "Vigente"), "Estado"], ["note", "Nota"], ["void_reason", "Motivo de anulación"]], S.movements)); toast("Archivo generado");
  },
};

const sel = (name, opts, cur) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
function paySheet(team) {
  const ch = S.charges.filter((c) => c.team_id === team && c.status === "active");
  sheet.open("Registrar pago", tn(team), `<form data-fform="pay" class="fld"><input type="hidden" name="team" value="${esc(team)}">
    <label>Abona a<select name="charge"><option value="">— Pago sin cargo específico —</option>${ch.map((c) => `<option value="${esc(c.id)}">${esc(c.concept)} (${money(c.amount)})</option>`).join("")}</select></label>
    <label>Monto<input name="amount" type="number" min="0.01" max="1000000" step="0.01" required></label>
    <div class="two"><label>Forma${sel("method", Object.entries(METHOD), "efectivo")}</label><label>Fecha<input name="paid_on" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
    <label>Nota (folio, quién entregó)<input name="note" maxlength="300"></label><button class="btn" type="submit">Guardar pago</button></form>`);
}
function chargeSheet(team) {
  sheet.open(team ? "Nuevo cargo" : "Cargar a todos los equipos", team ? tn(team) : "Se crea un cargo por equipo; los que ya lo tienen se omiten", `<form data-fform="charge" class="fld"><input type="hidden" name="team" value="${esc(team || "")}">
    <label>Concepto<input name="concept" list="conceptos" required minlength="2" maxlength="80" placeholder="Inscripción"><datalist id="conceptos"><option value="Inscripción"><option value="Arbitraje"><option value="Fianza"><option value="Credenciales"></datalist></label>
    <div class="two"><label>Monto<input name="amount" type="number" min="0.01" max="1000000" step="0.01" required></label><label>Vence<input name="due" type="date"></label></div>
    <button class="btn" type="submit">Crear</button></form>`);
}
function otherSheet() {
  sheet.open("Ingreso o gasto de la liga", "", `<form data-fform="other" class="fld"><label>Tipo${sel("kind", [["income", "Ingreso (patrocinio, venta…)"], ["expense", "Gasto (árbitros, canchas…)"]], "expense")}</label>
    <label>Concepto<input name="concept" required minlength="2" maxlength="80"></label><label>Monto<input name="amount" type="number" min="0.01" max="1000000" step="0.01" required></label>
    <div class="two"><label>Forma${sel("method", Object.entries(METHOD), "efectivo")}</label><label>Fecha<input name="paid_on" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
    <label>Nota<input name="note" maxlength="300"></label><button class="btn" type="submit">Guardar</button></form>`);
}

sheet.wireNs("f", async (k, el) => {
  if (k !== "voidc") return;
  const why = prompt("Motivo para anular este cargo (queda en el historial):"); if (why === null) return;
  sheet.guard(async () => { await api.voidCharge(S.ctx.id, el.dataset.id, why); sheet.close(); toast("Cargo anulado"); S.ctx.reload(); });
}, (k, f, fd) => {
  const ctx = S.ctx;
  sheet.guard(async () => {
    if (k === "pay") await api.recordMovement(ctx.id, { kind: "payment", team: fd.get("team"), charge: fd.get("charge") || undefined, amount: +fd.get("amount"), method: fd.get("method"), paid_on: fd.get("paid_on"), note: fd.get("note").trim() });
    else if (k === "charge") await api.createCharges(ctx.id, tid, fd.get("concept").trim(), +fd.get("amount"), fd.get("due") || null, fd.get("team") || null);
    else if (k === "other") await api.recordMovement(ctx.id, { kind: fd.get("kind"), concept: fd.get("concept").trim(), amount: +fd.get("amount"), method: fd.get("method"), paid_on: fd.get("paid_on"), note: fd.get("note").trim() });
    sheet.close(); toast("Guardado"); ctx.reload();
  });
});

// El selector de torneo está en la vista (no en una hoja): se atiende aquí.
document.addEventListener("change", (e) => { const t = e.target.closest("[data-la-change=tour]"); if (t && S) { tid = t.value; S.ctx.reload(); } });
