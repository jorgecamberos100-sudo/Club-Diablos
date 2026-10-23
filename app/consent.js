// Aviso de privacidad y consentimiento en los formularios de registro (enlace, delegado y oficina).
// La base de datos vuelve a revisar todo (consent_check): esto solo guía a quien llena el formulario.
import { esc } from "./util.js";

export const isMinor = (birth) => { if (!birth) return false; const lim = new Date(); lim.setFullYear(lim.getFullYear() - 18); return birth > lim.toISOString().slice(0, 10); };

// Texto del aviso, plegable para no tapar el formulario.
export const noticeHTML = (pv, open = false) => !pv ? "" : `<details class="privacy"${open ? " open" : ""}><summary>Aviso de privacidad de la liga</summary><div class="privacy-txt">${esc(pv.notice).replace(/\n/g, "<br>")}</div>${pv.contact ? `<p class="hint">Dudas o para borrar tus datos: ${esc(pv.contact)}</p>` : ""}</details>`;

// mode "self": quien llena es el jugador (o su tutor). mode "attest": la liga o el delegado declaran que el jugador o su tutor aceptó.
export function consentFields(pv, mode) {
  if (!pv) return `<p class="msg" role="alert">La liga aún no publica su aviso de privacidad, así que todavía no se pueden registrar jugadores.${mode === "attest" ? " La liga lo publica en Ajustes." : ""}</p>`;
  const txt = mode === "self" ? "Leí y acepto el aviso de privacidad" : "Confirmo que el jugador (o, si es menor, su madre, padre o tutor) conoce y acepta el aviso de privacidad de la liga";
  return `${noticeHTML(pv)}<input type="hidden" name="pv" value="${esc(pv.version)}">
    <div class="guardian" hidden><p class="hint">Es menor de edad: el registro necesita a su madre, padre o tutor.</p>
      <label>Nombre de la madre, padre o tutor<input name="guardian" maxlength="80" autocomplete="off"></label>
      <label class="opt"><input type="checkbox" name="gok"><span>${mode === "self" ? "Soy su madre, padre o tutor y autorizo el registro" : "La madre, padre o tutor autorizó el registro"}</span></label></div>
    <label class="opt"><input type="checkbox" name="accept" required><span>${txt}</span></label>`;
}

export function consentFrom(fd) {
  const minor = isMinor(fd.get("birth")), g = (fd.get("guardian") || "").trim();
  if (minor && (g.length < 3 || !fd.get("gok"))) throw new Error("madre, padre o tutor");
  return { accepted: !!fd.get("accept"), by: minor ? "guardian" : "self", guardian_name: minor ? g : null, version: +fd.get("pv") };
}

// Muestra los datos del tutor en cuanto la fecha de nacimiento indica que es menor.
document.addEventListener("input", (e) => {
  const b = e.target.closest("input[name=birth]"); if (!b) return;
  const f = b.form, gd = f && f.querySelector(".guardian"); if (!gd) return;
  const m = isMinor(b.value); gd.hidden = !m; gd.querySelectorAll("input").forEach((i) => (i.required = m));
});
