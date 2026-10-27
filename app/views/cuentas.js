// Vista de cuentas: lo que falta por pagar, mi cuenta, preguntas, detalle por jugador.
import { esc, money, norm, fecha, tpl, store } from "../util.js";
import { calc, textVars } from "../finance.js";

const STOP = ["que", "los", "las", "una", "uno", "por", "para", "con", "del", "mis", "como", "cual", "cuales", "esta", "este", "pero", "mas", "sus", "hay", "son", "ser", "soy"];

function status(c) {
  if (c.saldo > 0.005) return `<span class="chip ok">A favor ${money(c.saldo)}</span>`;
  if (c.saldo < -0.005) return `<span class="chip due">Falta ${money(-c.saldo)}</span>`;
  return '<span class="chip ok">Al corriente</span>';
}

// Desglose de lo que le toca a cada uno: cuota por concepto y multa.
function desglose(C, fin, c) {
  const cuota = `<li class="grp-h"><span>Cuota</span><b>${money(fin.cuota)}</b></li>` +
    C.parte.map((x) => `<li class="sub"><span>${esc(x.label)}</span><span>${money(x.monto)}</span></li>`).join("");
  const multa = c.multa
    ? `<li class="grp-h"><span>Multa del 13 de septiembre</span><b>${money(C.share)}</b></li><li class="sub"><span>${money(fin.multa.total)} entre los ${C.nMulta} que no confirmaron</span><span></span></li>`
    : `<li class="grp-h"><span>Multa</span><span class="why">No aplica${c.why ? " · " + esc(c.why) : ""}</span></li>`;
  return cuota + multa;
}

function mineHtml(ctx, C, mine) {
  const fin = ctx.team.finance;
  const c = C.cuentas.find((x) => x.player === mine);
  if (!c) return '<p class="hint">Elige tu nombre y aquí aparece, en grande, lo que te falta por pagar.</p>';
  let big, cls;
  if (c.saldo < -0.005) { big = "Te falta " + money(-c.saldo); cls = "due"; }
  else if (c.saldo > 0.005) { big = "Tienes " + money(c.saldo) + " a favor"; cls = "ok"; }
  else { big = "Estás al corriente"; cls = "ok"; }
  const multa = c.multa ? `<b>${money(C.share)}</b>` : `<span class="why">No aplica${c.why ? " · " + esc(c.why) : ""}</span>`;
  const contacto = esc(ctx.club.contact || "el administrador");
  const L = ctx.live, mineLive = L && L.approved && L.member.player_id === c.player;
  const nota = c.saldo < -0.005
    ? (L && !L.error ? (mineLive ? "" : `<p class="hint">¿Ya pagaste? Entra con Google en Inicio y manda tu comprobante desde aquí; tu cuenta se actualiza sola.</p>`)
      : `<p class="hint">Para pagar, avísale a ${contacto} por privado y mándale tu comprobante para que lo registre.</p>`)
    : c.saldo > 0.005 ? `<p class="hint">Diste de más: ese dinero queda a tu favor y se regresa o se aplica a lo que acuerdes con ${contacto}.</p>` : "";
  const ST = { pending: ["due", "En revisión"], rejected: ["na", "No aprobado"] };
  const pays = mineLive ? L.myPays.filter((p) => ST[p.status]).slice(0, 5) : [];
  const payBox = mineLive ? `${pays.length ? `<ul class="acct flat mypays">${pays.map((p) => `<li><span>${p.kind === "uniforme" ? "Uniforme" : "Pago"} ${money(p.amount)}</span><span class="chip ${ST[p.status][0]}">${ST[p.status][1]}</span></li>`).join("")}</ul>` : ""}
    <button type="button" class="btn pay-go" data-cl="pay">Ya pagué · mandar comprobante</button>` : "";
  return `<div class="mine ${cls}"><div class="mine-big">${esc(big)}</div>
    <ul class="acct flat">${desglose(C, fin, c)}
    <li class="sum"><span>Te toca en total</span><b>${money(c.toca)}</b></li><li><span>Has dado</span><b>${money(c.aportado || 0)}</b></li></ul>${nota}${payBox}</div>`;
}

function faqHtml(ctx, C, q) {
  q = norm(q).trim();
  if (!q) return "";
  const vars = textVars(ctx.team.finance, C, ctx.club.contact);
  const list = (ctx.team.finance.faq || []).map((f) => ({ q: tpl(f.q, vars), k: f.k || "", a: f.a.map((p) => `<p>${tpl(p, vars)}</p>`).join("") }));
  const toks = q.split(/[^a-z0-9$]+/).filter((t) => t.length > 2 && !STOP.includes(t));
  let out = [];
  if (toks.length) {
    out = list.map((f) => {
      const qq = norm(f.q.replace(/<[^>]+>/g, " ")), kk = norm(f.k), aa = norm(f.a.replace(/<[^>]+>/g, " "));
      let sc = 0;
      toks.forEach((t) => {
        const st = t.slice(0, Math.max(3, t.length - 2));
        if ((" " + qq.replace(/[^a-z0-9$]+/g, " ") + " ").includes(" " + t + " ")) sc += 6;
        else if (qq.includes(st)) sc += 3;
        if (kk.includes(st)) sc += 2;
        if (aa.includes(st)) sc += 1;
      });
      return { f, sc };
    }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 5).map((x) => x.f);
  }
  if (!out.length) return `<p class="hint nf">No encontré esa duda. Escríbele a ${esc(ctx.club.contact || "el administrador")} por privado y la agregamos aquí para todos.</p>`;
  return out.map((f) => `<details class="faq"${out.length === 1 ? " open" : ""}><summary>${f.q}<span class="ar" aria-hidden="true">▶</span></summary><div class="ans">${f.a}</div></details>`).join("");
}

function playerRow(c, C, fin) {
  const multa = c.multa ? `<li><span>Multa</span><b>${money(C.share)}</b></li>`
    : `<li><span>Multa</span><span class="why">No aplica${c.why ? " · " + esc(c.why) : ""}</span></li>`;
  const res = c.saldo > 0.005 ? `<li class="res ok"><span>A favor</span><b>${money(c.saldo)}</b></li>`
    : c.saldo < -0.005 ? `<li class="res due"><span>Le falta</span><b>${money(-c.saldo)}</b></li>`
    : '<li class="res ok"><span>Al corriente</span><b>$0</b></li>';
  return `<details class="pl2 ${c.saldo < -0.005 ? "due" : "ok"}"><summary><span class="dn">${esc(c.number || "–")}</span><span class="nm">${esc(c.name)}</span>${status(c)}<span class="ar" aria-hidden="true">▶</span></summary>
    <ul class="acct">${desglose(C, fin, c)}<li class="sum"><span>Le toca en total</span><b>${money(c.toca)}</b></li><li><span>Ha dado</span><b>${money(c.aportado || 0)}</b></li>${res}</ul></details>`;
}

export function render(ctx) {
  const fin = ctx.team.finance;
  const C = calc(fin, ctx.playersById);
  const num = Object.fromEntries(ctx.team.roster.map((r) => [r.player, r.number]));
  C.cuentas.forEach((c) => { c.number = num[c.player] || ""; });
  const vars = textVars(fin, C, ctx.club.contact);
  const mine = (ctx.live && ctx.live.approved && ctx.live.member.player_id) || store(ctx.key + ":mine") || "";
  let h = "";

  h += `<p class="updated">Cuentas actualizadas el ${esc(fecha(fin.updated))}</p>`;

  /* lo que falta */
  const pct = C.ligaTot ? Math.round((C.ligaPag / C.ligaTot) * 100) : 0;
  h += `<section class="s" id="falta"><div class="board"><div class="cell main"><b>${money(C.ligaFalta)}</b><span>Falta pagar a la liga</span></div>
    <div class="cell"><b>${money(C.falta)}</b><span>Falta que junten los jugadores</span></div></div>
    <div class="prog"><div class="prog-l"><span>Ya pagamos a la liga</span><b>${money(C.ligaPag)} de ${money(C.ligaTot)}</b></div><div class="seg" style="--p:${pct}%"></div></div>
    <h2>En qué se va a usar el dinero</h2><p>Cada pago entra a la caja y se paga a la liga <strong>en este orden</strong>.</p>
    <ol class="due-list">${C.items.map((o, n) => {
      const x = o.x, f = Math.max(0, x.costo - x.pagado), p = x.costo ? Math.min(100, Math.round((x.pagado / x.costo) * 100)) : 0;
      const extra = o.src === "gastos" ? " <small>(no es de la liga)</small>" : "";
      return `<li class="${f <= 0 ? "done" : ""}"><span class="num">${f <= 0 ? "✓" : n + 1}</span><div class="dl-t"><span class="t">${esc(x.label)}${extra}</span><span class="d">${esc(x.desc)}</span></div>
        <span class="dl-m">${f > 0 ? `<b class="owe">${money(f)}</b><small>de ${money(x.costo)}</small>` : `<span class="chip ok">Pagado</span><small>${money(x.costo)}</small>`}</span>
        <div class="track"><div class="fill" style="width:${p}%"></div></div></li>`;
    }).join("")}</ol>
    <div class="dl-tot"><span>Total por pagar</span><b>${money(C.ligaFalta + C.gastosFalta)}</b><small>Liga ${money(C.ligaFalta)}${fin.gastos.filter((x) => x.costo > x.pagado).map((x) => " + " + esc(x.label.toLowerCase()) + " " + money(x.costo - x.pagado)).join("")}</small></div></section>`;

  /* mi cuenta */
  const names = C.cuentas.slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
  h += `<section class="s" id="mi"><h2>Mi cuenta</h2><label class="who-l" for="who">Elige tu nombre</label>
    <select id="who" class="who"><option value="">Elige tu nombre</option>${names.map((c) => `<option value="${esc(c.player)}"${c.player === mine ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
    <div id="mine-card">${mineHtml(ctx, C, mine)}</div></section>`;

  /* preguntas */
  if ((fin.faq || []).length) {
    h += `<section class="s" id="preguntas"><h2>Preguntas y respuestas</h2>
      <input type="search" id="faq-q" class="srch" placeholder="Escribe tu duda" autocomplete="off" aria-label="Escribe tu duda" aria-controls="faq-list">
      <div class="faqs" id="faq-list" aria-live="polite"></div></section>`;
  }

  /* jugadores */
  const deben = C.cuentas.filter((c) => c.saldo < -0.005).sort((a, b) => a.saldo - b.saldo || a.name.localeCompare(b.name, "es"));
  const bien = C.cuentas.filter((c) => c.saldo >= -0.005).sort((a, b) => (parseInt(a.number, 10) || 999) - (parseInt(b.number, 10) || 999));
  h += `<section class="s" id="jugadores"><h2>Cuenta de cada jugador <small>${bien.length} de ${C.cuentas.length} al corriente</small></h2>
    <p>Primero los que tienen algo pendiente, de mayor a menor. Toca un nombre para ver el detalle.</p>
    ${deben.length ? `<div class="grp">Les falta pagar (${deben.length}) · suman ${money(C.falta)}</div><div class="card plist">${deben.map((c) => playerRow(c, C, fin)).join("")}</div>` : ""}
    ${bien.length ? `<div class="grp ok">Al corriente o a favor (${bien.length})</div><div class="card plist">${bien.map((c) => playerRow(c, C, fin)).join("")}</div>` : ""}
    ${fin.porteroNota ? `<p>${esc(fin.porteroNota)}</p>` : ""}</section>`;

  /* cuota */
  h += `<section class="s" id="cuota"><h2>A dónde va tu cuota de ${money(fin.cuota)}</h2><p>Cada peso de la cuota se usa para esto. A la derecha, lo que pone cada uno; abajo de cada concepto, lo que cuesta en total.</p>
    <div class="card"><ul class="rows">${C.parte.map((x) => { const y = C.cubre.find((z) => z.k === x.k) || {}; return `<li><span class="t">${esc(x.label)}</span><span class="d">${esc((y.short || y.desc || "").replace(/\.$/, ""))} · total ${money(x.costo)}</span><span class="m"><b>${money(x.monto)}</b></span></li>`; }).join("")}
    <li class="tot"><span class="t">Tu cuota</span><span class="d">La pagan los ${C.cuentas.length} jugadores; el portero va becado</span><span class="m"><b>${money(fin.cuota)}</b></span></li></ul></div></section>`;

  /* multa */
  if (fin.multa && fin.multa.total) {
    const pagan = C.cuentas.filter((c) => c.multa).map((c) => c.name);
    const exentos = C.cuentas.filter((c) => !c.multa).map((c) => c.name);
    h += `<section class="s" id="multa"><h2>${esc(fin.multa.titulo || "Multa")}</h2><p>${tpl(fin.multa.texto || "", vars)}</p>
      <div class="card"><ul class="rows">
      <li><span class="t">La pagan (${pagan.length})</span><span class="d">${esc(pagan.join(", "))}</span><span class="m"><b>${money(C.share)}</b><span class="chip na">cada uno</span></span></li>
      <li><span class="t">No la pagan (${exentos.length})</span><span class="d">${esc(fin.multa.exentosTexto || "")}: ${esc(exentos.join(", "))}</span><span class="m"><span class="chip ok">$0</span></span></li>
      </ul></div>${fin.multa.plazo ? `<p>${esc(fin.multa.plazo)}</p>` : ""}</section>`;
  }

  /* caja */
  h += `<section class="s" id="caja"><h2>Caja del equipo</h2><p>Todo lo que han dado los jugadores y en qué se ha usado.</p><div class="card"><ul class="rows">
    <li><span class="t">Lo que han dado los jugadores</span><span class="d">Suma de las cuotas y multas entregadas</span><span class="m"><b>${money(C.aportado)}</b></span></li>
    <li><span class="t">Pagado a la liga</span><span class="d">${esc(fin.liga.filter((x) => x.pagado > 0).map((x) => x.label.toLowerCase()).join(", "))}</span><span class="m"><b>−${money(C.ligaPag)}</b></span></li>
    ${(fin.ingresos || []).map((x) => `<li><span class="t">${esc(x.label)}</span><span class="d">Ingreso</span><span class="m"><b>+${money(x.monto)}</b></span></li>`).join("")}
    ${fin.gastos.filter((x) => x.pagado > 0).map((x) => `<li><span class="t">${esc(x.label)}</span><span class="d">${esc(x.desc)}</span><span class="m"><b>−${money(x.pagado)}</b></span></li>`).join("")}
    <li class="tot"><span class="t">Hay en caja</span><span class="d">Se usa para el siguiente pago a la liga</span><span class="m"><b class="big">${money(C.caja)}</b></span></li></ul></div>
    ${C.favor > 0.005 ? `<p>De lo que hay en caja, ${money(C.favor)} es de quien dio de más y está a su favor.</p>` : ""}</section>`;

  /* uniformes */
  if (fin.uniformes && fin.uniformes.items.length) {
    h += `<section class="s" id="uniformes"><h2>Uniformes <small>cuenta aparte</small></h2><p>${esc(fin.uniformes.texto || "")}</p><div class="card"><ul class="rows">
      ${fin.uniformes.items.map((u) => {
        const s = (u.pagado || 0) - u.costo;
        const saldo = u.pend && !(u.pagado > 0) ? `<span class="chip na">${esc(u.pend)}</span>` : s > 0.005 ? `<span class="chip ok">${money(s)} a favor</span>` : s < -0.005 ? `<span class="chip due">Debe ${money(-s)}</span>` : '<span class="chip ok">Pagado</span>';
        return `<li><span class="t">${esc(u.n)} · ${money(u.costo)}</span><span class="d">${esc(u.items)} · ${esc(u.estado)}</span><span class="m">${saldo}</span></li>`;
      }).join("")}</ul></div></section>`;
  }

  /* arbitraje */
  if (fin.arbitraje) {
    h += `<section class="s" id="arbitraje"><h2>Arbitraje de cada partido</h2><p>${esc(fin.arbitraje.texto || "")}</p><div class="card"><ul class="rows">
      ${fin.arbitraje.items.map((a) => `<li><span class="t">${esc(a.t)}</span><span class="d">${esc(a.d)}</span><span class="m"><b>${money(a.m)}</b></span></li>`).join("")}</ul></div></section>`;
  }

  /* movimientos: historial de lo que se ha registrado en la app */
  const mv = ((ctx.live && ctx.live.moves) || []).slice().sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at))).slice(0, 40);
  if (mv.length) {
    const KIND = { cuota: "Cuota", uniforme: "Uniforme", salida: "Pago", ingreso: "Ingreso" };
    const nm = (id) => (ctx.playersById[id] || {}).name || "";
    h += `<section class="s" id="movimientos"><h2>Movimientos <small>${mv.length}</small></h2><details class="faq"><summary>Ver el historial<span class="ar" aria-hidden="true">▶</span></summary><div class="ans"><ul class="rows">
      ${mv.map((m) => `<li><span class="t">${esc(KIND[m.kind] || m.kind)}${nm(m.player_id) ? " · " + esc(nm(m.player_id)) : ""}</span><span class="d">${esc(fecha(m.decided_at))}${m.detail ? " · " + esc(m.detail) : ""}</span><span class="m"><b>${m.kind === "salida" ? "−" : "+"}${money(m.amount)}</b></span></li>`).join("")}</ul></div></details></section>`;
  }

  h += `<p class="foot-note">Dudas o aclaraciones, por privado con ${esc(ctx.club.contact || "el administrador")}.</p>`;
  return h;
}

export function bind(root, ctx) {
  const C = calc(ctx.team.finance, ctx.playersById);
  root.addEventListener("change", (e) => {
    if (e.target.id !== "who") return;
    store(ctx.key + ":mine", e.target.value);
    root.querySelector("#mine-card").innerHTML = mineHtml(ctx, C, e.target.value);
  });
  root.addEventListener("input", (e) => {
    if (e.target.id !== "faq-q") return;
    root.querySelector("#faq-list").innerHTML = faqHtml(ctx, C, e.target.value);
  });
}
