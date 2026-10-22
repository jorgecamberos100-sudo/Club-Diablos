// Inicio: lo que un jugador quiere ver al abrir la app.
// Próximo partido, su tarjeta y su cuenta, último resultado, los mejores y accesos rápidos.
import { esc, money, store } from "../util.js";
import { calc } from "../finance.js";
import { nextMatch, lastPlayed, whenText, daysLeft, versus, result, attendanceOf } from "../matches.js";
import { mvpOf } from "../rating.js";
import { card, openSheet } from "./plantel.js";

const link = (ctx, v) => `#/${ctx.clubId}/${ctx.team.id}/${v}`;

function meHtml(ctx, C) {
  const mine = store(ctx.key + ":mine") || "";
  const roster = ctx.team.roster.filter((r) => ctx.playersById[r.player] && r.status !== "congelado")
    .map((r) => ctx.playersById[r.player]).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const sel = `<select id="me" class="who" aria-label="¿Quién eres?"><option value="">¿Quién eres? Elige tu nombre</option>${roster.map((p) => `<option value="${esc(p.id)}"${p.id === mine ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>`;
  const p = ctx.playersById[mine];
  if (!p) return `<section class="s me"><h2>Tu espacio</h2><p>Elige tu nombre una vez y la app te muestra tu tarjeta y tu cuenta.</p>${sel}</section>`;
  const r = ctx.team.roster.find((x) => x.player === mine);
  const c = C && C.cuentas.find((x) => x.player === mine);
  let money_ = "";
  if (c) {
    money_ = c.saldo < -0.005 ? `<a class="me-st due" href="${link(ctx, "finanzas")}"><b>Te falta ${money(-c.saldo)}</b><span>Ver tu cuenta</span></a>`
      : `<a class="me-st ok" href="${link(ctx, "finanzas")}"><b>${c.saldo > 0.005 ? "Tienes " + money(c.saldo) + " a favor" : "Estás al corriente"}</b><span>Ver tu cuenta</span></a>`;
  } else if (r && r.note) money_ = `<div class="me-st ok"><b>${esc(r.note)}</b></div>`;
  return `<section class="s me"><h2>Hola, ${esc(p.name)}</h2>
    <div class="me-grid"><div class="me-card">${card(p, r, ctx)}</div><div class="me-side">${money_}
    <a class="me-st" href="${link(ctx, "plantel")}"><b>${(ctx.ratings[mine] || {}).media ?? "–"}</b><span>Tu media</span></a></div></div>
    <details class="me-chg"><summary>No soy ${esc(p.name)}</summary>${sel}</details></section>`;
}

function attLine(ctx, m) {
  if (ctx.live && ctx.live.approved) return ""; // con cuenta, la tarjeta «¿Vas al partido?» ya lo muestra
  const A = attendanceOf(m, null); if (!A) return "";
  const nm = (ids) => ids.map((id) => (ctx.playersById[id] || {}).name || id).join(", ");
  const total = ctx.team.roster.filter((r) => r.status !== "congelado").length;
  const left = total - A.va.length - A.no.length - A.duda.length;
  return `<details class="hm-att"><summary><b>${A.va.length} van</b>${A.duda.length ? " · " + A.duda.length + " en duda" : ""}${A.no.length ? " · " + A.no.length + " no " + (A.no.length === 1 ? "va" : "van") : ""}${left > 0 ? " · " + left + " sin responder" : ""}</summary>
    <p><b>Van:</b> ${esc(nm(A.va))}</p>${A.duda.length ? `<p><b>Duda:</b> ${esc(nm(A.duda))}</p>` : ""}${A.no.length ? `<p><b>No van:</b> ${esc(nm(A.no))}</p>` : ""}<p class="hint">Según la ${esc(A.source.toLowerCase())}.</p></details>`;
}

export function render(ctx) {
  const fin = ctx.team.finance;
  const C = fin ? calc(fin, ctx.playersById) : null;
  const nx = nextMatch(ctx.team);
  const lp = lastPlayed(ctx.team);
  let h = "";

  if (nx) {
    h += `<section class="hero-match"><div class="hm-top"><span>${esc(nx.jornada || "Próximo partido")}</span><span class="hm-cd">${esc(daysLeft(nx.date))}</span></div>
      <div class="hm-vs">${esc(versus(nx, ctx.club.name))}</div>
      <div class="hm-when">${esc(whenText(nx.date))}${nx.venue ? " · " + esc(nx.venue) : ""}</div>
      ${attLine(ctx, nx)}
      <a class="hm-btn" href="${link(ctx, "alineacion")}">Ver alineación</a></section>`;
  }

  h += meHtml(ctx, C);

  if (lp) {
    const R = result(lp), mvp = mvpOf(lp);
    h += `<section class="s"><h2>Último partido</h2><a class="last" href="${link(ctx, "partidos")}"><span class="res ${R.kind}">${esc(R.text)}</span>
      <span class="last-t"><b>${esc(versus(lp, ctx.club.name))}</b><span>${esc(R.label)}${mvp ? " · ★ " + esc(ctx.playersById[mvp].name) : ""}</span></span></a></section>`;
  }

  const top = Object.entries(ctx.ratings).filter(([id, r]) => r.media != null && ctx.team.roster.some((x) => x.player === id)).sort((a, b) => b[1].media - a[1].media).slice(0, 3);
  if (top.length) {
    h += `<section class="s"><h2>Los mejores del equipo</h2><div class="podium">${top.map(([id]) => `<div>${card(ctx.playersById[id], ctx.team.roster.find((x) => x.player === id), ctx)}</div>`).join("")}</div></section>`;
  }

  const tiles = [];
  if (C) tiles.push(`<a class="tile-l" href="${link(ctx, "finanzas")}"><span>Finanzas</span><b>${money(C.ligaFalta)}</b><small>Falta pagar a la liga</small></a>`);
  tiles.push(`<a class="tile-l" href="${link(ctx, "plantel")}"><span>Plantel</span><b>${ctx.team.roster.filter((r) => r.status !== "congelado").length}</b><small>Jugadores activos</small></a>`);
  h += `<section class="s"><div class="tiles-l">${tiles.join("")}</div></section>`;
  return h;
}

export function bind(root, ctx) {
  root.addEventListener("change", (e) => {
    if (e.target.id !== "me") return;
    store(ctx.key + ":mine", e.target.value);
    root.innerHTML = render(ctx);
  });
  root.addEventListener("click", (e) => { const t = e.target.closest("[data-p]"); if (t) openSheet(ctx, t.dataset.p); });
}
