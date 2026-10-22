// Partidos: calendario, resultados, mejor del partido y calificaciones.
import { esc } from "../util.js";
import { sorted, whenText, versus, result, nextMatch } from "../matches.js";
import { mvpOf } from "../rating.js";
import { openSheet } from "./plantel.js";

function matchHtml(ctx, m, isNext) {
  const R = result(m);
  const mvp = mvpOf(m);
  const name = (id) => (ctx.playersById[id] || {}).name || id;
  let body = "";
  if (R) {
    const scores = Object.entries(ctx.ratings).map(([id, r]) => [id, r.matchScores[m.id]])
      .filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    const scorers = Object.entries(m.stats || {}).filter(([, s]) => s.g).map(([id, s]) => name(id) + (s.g > 1 ? ` (${s.g})` : "")).join(", ");
    body = `${mvp ? `<p class="mvp-line">★ Mejor del partido: <button type="button" class="lnk" data-p="${esc(mvp)}">${esc(name(mvp))}</button></p>` : ""}
      ${scorers ? `<p class="hint">Goles: ${esc(scorers)}</p>` : ""}
      ${scores.length ? `<ol class="rank">${scores.map(([id, v]) => `<li><button type="button" class="lnk" data-p="${esc(id)}">${esc(name(id))}</button><b>${v.toFixed(1)}</b></li>`).join("")}</ol>`
        : '<p class="hint">Sin calificaciones de este partido.</p>'}`;
  } else if (!isNext && new Date(m.date) < new Date()) {
    body = '<p class="hint">Resultado sin registrar.</p>';
  }
  return `<li class="mt${isNext ? " next" : ""}"><div class="mt-h">
      <span class="mt-j">${esc(m.jornada || "")}</span>
      <div class="mt-t"><b>${esc(versus(m, ctx.club.name))}</b><span>${esc(whenText(m.date))}${m.venue ? " · " + esc(m.venue) : ""}</span></div>
      ${R ? `<span class="res ${R.kind}">${esc(R.text)}</span>` : isNext ? '<span class="chip due">Próximo</span>' : ""}
    </div>${body}</li>`;
}

export function render(ctx) {
  const all = sorted(ctx.team);
  const nx = nextMatch(ctx.team);
  const upcoming = all.filter((m) => !m.score && new Date(m.date) >= new Date(Date.now() - 3 * 3600e3));
  const past = all.filter((m) => !upcoming.includes(m)).reverse();
  const rec = past.filter((m) => m.score);
  const w = rec.filter((m) => m.score.for > m.score.against).length, d = rec.filter((m) => m.score.for === m.score.against).length;
  return `<section class="s"><h2>Partidos</h2>
    ${rec.length ? `<div class="wdl"><div><b>${w}</b><span>Ganados</span></div><div><b>${d}</b><span>Empatados</span></div><div><b>${rec.length - w - d}</b><span>Perdidos</span></div></div>` : ""}
    ${upcoming.length ? `<span class="lbl">Por jugar</span><ul class="mts">${upcoming.map((m) => matchHtml(ctx, m, m === nx)).join("")}</ul>` : ""}
    ${past.length ? `<span class="lbl">Jugados</span><ul class="mts">${past.map((m) => matchHtml(ctx, m, false)).join("")}</ul>` : ""}
    <div class="note">Al terminar cada partido, los que jugaron califican a sus compañeros del 1 al 10 y votan al mejor del partido. ${ctx.team.votingOpen ? "" : "La votación desde el celular se activa cuando cada jugador tenga su cuenta."}</div>
  </section>`;
}

export function bind(root, ctx) {
  root.addEventListener("click", (e) => { const t = e.target.closest("[data-p]"); if (t) openSheet(ctx, t.dataset.p); });
}
