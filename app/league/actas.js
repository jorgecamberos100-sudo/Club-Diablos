// Actas desde foto. Flujo: subir la foto (se guarda el original) → leer o capturar → revisar → CONFIRMAR.
// Un borrador no cambia nada oficial. Solo «Confirmar y registrar» registra el resultado, con las mismas reglas que la captura manual.
import { esc } from "../util.js";
import { api } from "../cloud.js";
import { btn, chip, dtime, toast } from "../ui.js";
import { shrinkImage } from "../ui.js";
import * as sheet from "../sheet.js";
import { parseActa } from "../ocr/parse.js";
import { ENGINES, available, read } from "../ocr/engines.js";

let M = null;   // { ctx, match, home:{id,name}, away:{id,name}, acta, photo }
const STATE = { pending: chip("Pendiente", "due"), confirmed: chip("Confirmada", "ok"), discarded: chip("Descartada", "na") };

const evRow = (e = {}) => `<div class="ev"><select name="ev_team" aria-label="Equipo">${[M.home, M.away].map((t) => `<option value="${esc(t.id)}"${e.team === t.id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
  <input name="ev_player" maxlength="60" placeholder="Jugador" aria-label="Jugador" value="${esc(e.player || "")}">
  <select name="ev_kind" aria-label="Tipo">${[["goal", "Gol"], ["own_goal", "Autogol"], ["yellow", "Amarilla"], ["red", "Roja"]].map(([v, l]) => `<option value="${v}"${v === (e.kind || "goal") ? " selected" : ""}>${l}</option>`).join("")}</select></div>`;

export async function openActas(ctx, match, home, away) {
  M = { ctx, match, home, away, acta: null, photo: null };
  const list = await api.actaList(ctx.id, match.id);
  sheet.open("Acta del partido", `${home.name} vs ${away.name}`, `<p>Sube la foto del acta. Se guarda tal cual como evidencia; el resultado solo cambia cuando tú lo confirmas.</p>
    <form data-kform="upload" class="fld"><label>Foto del acta<input type="file" name="photo" accept="image/*" capture="environment" required></label><button class="btn" type="submit">Subir foto</button></form>
    ${list.length ? `<h3>Actas de este partido</h3>${list.map((a) => `<div class="cl-row static"><span><b>${esc(dtime(a.created_at))}</b><small>${a.discard_reason ? esc(a.discard_reason) : a.engine ? esc(ENGINES[a.engine].label) : "Sin borrador"}</small></span><span class="acts">${STATE[a.status]}${a.status === "pending" ? btn("Revisar", `data-kj="review" data-id="${esc(a.id)}"`) : btn("Ver foto", `data-kj="view" data-id="${esc(a.id)}"`, "ghost")}</span></div>`).join("")}` : ""}`);
  M.list = list;
}

async function review(a) {
  M.acta = a; M.photo = await api.actaUrl(a.path);
  const d = a.draft || {}, engines = available();
  sheet.open("Revisar acta", `${M.home.name} vs ${M.away.name}`, `${M.photo ? `<a href="${esc(M.photo)}" target="_blank" rel="noopener"><img class="acta-img" src="${esc(M.photo)}" alt="Foto del acta"></a>` : `<p class="hint">No se pudo cargar la foto.</p>`}
    <div class="row-acts">${engines.filter((x) => x !== "manual").map((x) => btn(ENGINES[x].label, `data-kj="read" data-v="${x}"`, "ghost")).join("")}</div>
    <p class="hint" id="eng-note">Puedes capturar mirando la foto${engines.length > 1 ? " o intentar la lectura automática (siempre revísala)" : ""}.</p>
    <label>Texto del acta (opcional: pégalo o escríbelo, o aparece al leer la foto)<textarea name="text" form="actaform" rows="4" maxlength="8000" placeholder="Marcador: 2 - 1&#10;Gol: Pepe (${esc(M.home.name)})&#10;Amarilla: Tito (${esc(M.away.name)})">${esc(a.ocr_text || "")}</textarea></label>
    <div class="row-acts">${btn("Interpretar texto", 'data-kj="parse"', "ghost")}</div>
    <p class="msg warn" id="warns" hidden></p>
    <form id="actaform" data-kform="draft" class="fld"><div class="two"><label>${esc(M.home.name)}<input name="hg" type="number" min="0" max="99" required value="${esc(d.hg ?? "")}"></label><label>${esc(M.away.name)}<input name="ag" type="number" min="0" max="99" required value="${esc(d.ag ?? "")}"></label></div>
      <h3>Goles y tarjetas</h3><div id="evs">${(d.events || []).map(evRow).join("")}</div><button type="button" class="btn sm ghost" data-kj="evadd">+ Agregar gol o tarjeta</button>
      <label>Nota<input name="notes" maxlength="500" value="${esc(d.note || "")}"></label>
      <p class="hint">Lo que ves aquí es un borrador. Al confirmar se registra como resultado oficial y queda en la bitácora con la foto de respaldo.</p>
      <button class="btn" type="submit">Guardar borrador</button><button class="btn" type="button" data-kj="confirm">Confirmar y registrar resultado</button><button class="btn ghost" type="button" data-kj="discard">Descartar acta</button></form>`);
  M.engine = a.engine || "manual";
}

function draftFrom(f) {
  const fd = new FormData(f), rows = [...f.querySelectorAll(".ev")].map((r) => ({ team: r.querySelector("[name=ev_team]").value, player: r.querySelector("[name=ev_player]").value.trim(), kind: r.querySelector("[name=ev_kind]").value })).filter((x) => x.player);
  return { draft: { hg: fd.get("hg") === "" ? null : +fd.get("hg"), ag: fd.get("ag") === "" ? null : +fd.get("ag"), events: rows, note: (fd.get("notes") || "").trim() }, text: (document.querySelector("#sheet [name=text]") || {}).value || "" };
}

const form = () => document.getElementById("actaform");
async function saveDraft() {
  const { draft, text } = draftFrom(form());
  if (draft.hg === null || draft.ag === null) throw new Error("Falta el marcador en el borrador");
  await api.saveActaDraft(M.ctx.id, M.acta.id, draft, M.engine, text); return draft;
}

sheet.wireNs("k", (k, el) => {
  sheet.guard(async () => {
    if (k === "review") return review(M.list.find((a) => a.id === el.dataset.id));
    if (k === "view") { const u = await api.actaUrl(M.list.find((a) => a.id === el.dataset.id).path); if (u) window.open(u, "_blank", "noopener"); return; }
    if (k === "evadd") { document.querySelector("#sheet #evs").insertAdjacentHTML("beforeend", evRow()); return; }
    if (k === "parse") {
      const t = document.querySelector("#sheet [name=text]").value, r = parseActa(t, M.home, M.away), f = form();
      if (r.hg !== null) { f.hg.value = r.hg; f.ag.value = r.ag; }
      f.querySelector("#evs").innerHTML = r.events.map(evRow).join(""); M.engine = M.engine === "manual" && !t.trim() ? "manual" : M.engine;
      const w = document.getElementById("warns"); w.hidden = !r.warnings.length; w.textContent = r.warnings.join(" ");
      toast(r.hg === null ? "No se encontró el marcador" : "Texto interpretado: revisa todo antes de confirmar", r.hg === null); return;
    }
    if (k === "read") {
      const eng = el.dataset.v, note = document.getElementById("eng-note"); note.textContent = ENGINES[eng].note + " Leyendo…";
      const blob = await (await fetch(M.photo)).blob(), text = await read(eng, blob, await api.accessToken());
      document.querySelector("#sheet [name=text]").value = text; M.engine = eng; note.textContent = ENGINES[eng].note;
      document.querySelector("#sheet [data-kj=parse]").click(); return;
    }
    if (k === "confirm") {
      if (!confirm(`¿Confirmar el acta? ${M.home.name} ${form().hg.value} - ${form().ag.value} ${M.away.name} pasa a ser el resultado oficial.`)) return;
      await saveDraft(); await api.confirmActa(M.ctx.id, M.acta.id); sheet.close(); toast("Resultado registrado desde el acta"); M.ctx.reload(); return;
    }
    if (k === "discard") {
      const why = prompt("¿Por qué se descarta? (opcional)") ; if (why === null) return;
      await api.discardActa(M.ctx.id, M.acta.id, why); sheet.close(); toast("Acta descartada; la foto se conserva"); M.ctx.reload(); return;
    }
  });
}, (k, f, fd) => {
  sheet.guard(async () => {
    if (k === "upload") {
      const file = fd.get("photo"); if (!file || !file.size) throw new Error("Datos no válidos");
      const blob = await shrinkImage(file, 1600, 0.85, "image/jpeg"), id = await api.uploadActa(M.ctx.id, M.match.id, blob);
      const a = (await api.actaList(M.ctx.id, M.match.id)).find((x) => x.id === id); await review(a); toast("Foto guardada"); return;
    }
    if (k === "draft") { await saveDraft(); toast("Borrador guardado; el resultado todavía no es oficial"); }
  });
});
