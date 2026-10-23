// El delegado de un equipo vinculado registra a sus jugadores en la liga. Lo que manda queda pendiente de aprobación según las reglas de la liga.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { row, chip, empty, toast, dshort } from "../ui.js";
import * as sheet from "../sheet.js";
import { consentFields, consentFrom } from "../consent.js";

const ST = { pending: ["due", "Pendiente"], active: ["ok", "Activo"], rejected: ["na", "Rechazado"] };
let ctx = null;

export async function open(c, t) {
  ctx = { c, t };
  const [targets, mine] = await Promise.all([api.delegateTargets(c, t), api.delegateRegistrations(c, t)]);
  const pv = targets.length && targets[0].privacy;   // aviso de la liga del primer torneo (la base lo revisa por cada liga)
  const body = !targets.length ? empty("Tu equipo todavía no está inscrito en un torneo de la liga. Cuando la liga lo inscriba, podrás registrar aquí a tus jugadores.")
    : `<form data-dform="send" class="fld"><label>Torneo<select name="tt">${targets.map((x) => `<option value="${esc(x.id)}">${esc(x.league)} · ${esc(x.tournament)} · ${esc(x.team)}</option>`).join("")}</select></label>
      <label>Nombre completo del jugador<input name="name" required minlength="2" maxlength="80"></label>
      <div class="two"><label>Fecha de nacimiento<input name="birth" type="date" required max="${new Date().toISOString().slice(0, 10)}"></label>
      ${targets.every((x) => x.rules.doc === "off") ? "" : `<label>Documento${targets.some((x) => x.rules.doc === "required") ? " (la liga lo pide)" : " (opcional)"}<input name="doc" maxlength="30"></label>`}</div>
      <p class="hint">La liga revisa y aprueba cada registro; si pide foto, te la solicitará o la tomará en oficina.</p>
      ${consentFields(pv || null, "attest")}
      <button class="btn" type="submit"${pv ? "" : " disabled"}>Enviar a la liga</button></form>`;
  sheet.open("Registrar jugadores en la liga", "", body + (mine.length ? `<h3>Lo que has enviado</h3>${mine.map((m) => row(m.name, `${m.team} · ${dshort(m.created_at)}${m.number != null ? " · #" + m.number : ""}`, chip(ST[m.status][1], ST[m.status][0]))).join("")}` : ""));
}
sheet.wireNs("d", () => {}, (k, f, fd) => {
  sheet.guard(async () => {
    await api.delegateRegister(ctx.c, ctx.t, fd.get("tt"), { name: fd.get("name").trim(), birth_date: fd.get("birth") || null, doc_id: (fd.get("doc") || "").trim() || null, consent: consentFrom(fd) });
    toast("Enviado a la liga: queda pendiente de aprobación"); await open(ctx.c, ctx.t);
  });
});
