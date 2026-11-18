// Baloncho, la mascota de FutSfera. Igual que la mascota de Muse:
// avatar en círculo + nombre en el encabezado, tocarlo abre su panel,
// avatar junto a sus mensajes, nombre personalizable, vibe, aspecto,
// tamaño y baile. Persistencia: localStorage por ahora (la nube aún no
// está activada); cuando exista Supabase, migrar a la liga.
// El nombre y la vibe son DE LA LIGA (o del equipo en modo sin liga).
// Paleta de la ficha: Verde FC #00FF66, Verde Oscuro #0A2E1F, Negro,
// Blanco, Gris #9CA3AF, Acento #FFCC00.
import { esc, store } from "./util.js";
import { toast } from "./ui.js";
import { IMG as IMG_AVATAR } from "./baloncho-img/avatar.js";
import { IMG as IMG_FELIZ } from "./baloncho-img/feliz.js";
import { IMG as IMG_CELEBRANDO } from "./baloncho-img/celebrando.js";
import { IMG as IMG_PENSANDO } from "./baloncho-img/pensando.js";
import { IMG as IMG_ANIMANDO } from "./baloncho-img/animando.js";
import { IMG as IMG_CORRIENDO } from "./baloncho-img/corriendo.js";

// La hoja (sheet.js) tira de cloud.js, que usa `location` al cargar: se
// importa en diferido para que este módulo siga siendo importable en Node
// (tests unitarios) sin un navegador.
let sheetMod = null;
const sheet = async () => (sheetMod ||= await import("./sheet.js"));

export const DEFAULT_NAME = "Baloncho";
export const NAME_SUGGESTIONS = ["Baloncho", "Baloncito"];
export const VIBES = {
  alegre: { label: "Alegre", saludo: "¡Hola! Soy {nombre}. ¡Vamos con todo hoy!", chat: "¡Hola! Soy {nombre}, la mascota de la liga. Pregúntame por la tabla, los próximos partidos, los resultados o el goleo." },
  tranquilo: { label: "Tranquilo", saludo: "Hola, soy {nombre}. Aquí estoy para lo que necesites, sin prisa.", chat: "Hola, soy {nombre}, la mascota de la liga. Con calma: pregúntame por la tabla, los próximos partidos, los resultados o el goleo." },
  motivador: { label: "Motivador", saludo: "¡Hola! Soy {nombre}. Hoy se gana: ¡a darlo todo en la cancha!", chat: "¡Hola! Soy {nombre}, la mascota de la liga. Pregúntame por la tabla, los próximos partidos, los resultados o el goleo: ¡vamos por todo!" },
  bromista: { label: "Bromista", saludo: "¡Hola! Soy {nombre}. ¿Listo para meter goles hasta en los sueños?", chat: "¡Hola! Soy {nombre}, la mascota de la liga. Pregúntame por la tabla, los próximos partidos, los resultados o el goleo… y no, no sé quién ganará el mundial." },
};
export const ASPECTOS = [
  { id: "avatar", label: "Frente", img: IMG_AVATAR },
  { id: "feliz", label: "Feliz", img: IMG_FELIZ },
  { id: "celebrando", label: "Celebrando", img: IMG_CELEBRANDO },
  { id: "pensando", label: "Pensando", img: IMG_PENSANDO },
  { id: "animando", label: "Animando", img: IMG_ANIMANDO },
  { id: "corriendo", label: "Corriendo", img: IMG_CORRIENDO },
];
// Escala única (ESPEC): chat 32, encabezado 40/32/56, panel 96, celebración 120.
export const TAMS = { compacto: { label: "Compacto", px: 32 }, normal: { label: "Normal", px: 40 }, grande: { label: "Grande", px: 56 } };
export const CHAT_PX = 32, PANEL_PX = 96, CELEB_PX = 120;

// ---------- Estado ----------
const mem = new Map(); // respaldo si no hay localStorage (tests, modo raro)
const readRaw = (k) => { try { const v = store(k); if (v != null) return v; } catch (e) { /* nada */ } return mem.has(k) ? mem.get(k) : null; };
const writeRaw = (k, v) => { try { store(k, v); } catch (e) { /* nada */ } mem.set(k, v); };
export const key = (scope) => `futsfera:mascota:${scope || "app"}`;
export function normalize(raw) {
  const r = (raw && typeof raw === "object") ? raw : {};
  const name = String(r.name || "").trim().slice(0, 20) || DEFAULT_NAME;
  return {
    name,
    vibe: VIBES[r.vibe] ? r.vibe : "alegre",
    aspecto: ASPECTOS.some((a) => a.id === r.aspecto) ? r.aspecto : "avatar",
    tam: TAMS[r.tam] ? r.tam : "normal",
  };
}
export const load = (scope) => normalize(readRaw(key(scope)));
export const save = (scope, state) => { const s = normalize(state); writeRaw(key(scope), s); return s; };

// ---------- Textos e imágenes ----------
// La imagen es un data URI (módulo en app/baloncho-img/), no un archivo:
// el push por GitHub solo acepta texto.
export const aspecto = (state) => ASPECTOS.find((a) => a.id === state.aspecto) || ASPECTOS[0];
export const imgFile = (id) => (ASPECTOS.find((a) => a.id === id) || ASPECTOS[0]).img;
export const img = (state) => aspecto(state).img;
export const sizePx = (state) => TAMS[state.tam].px;
const conNombre = (txt, state) => txt.replaceAll("{nombre}", state.name);
export const saludo = (state) => conNombre(VIBES[state.vibe].saludo, state);
export const chatHello = (state) => conNombre(VIBES[state.vibe].chat, state);
export const celebrateLine = (state, what) => what === "campeon"
  ? `¡Tenemos campeón! ${state.name} baila de la emoción.`
  : `¡Victoria! ${state.name} lo celebra bailando.`;

// ---------- Piezas visuales ----------
export function avatarHTML(state, px, cls = "") {
  return `<img class="mascota-av${cls ? " " + cls : ""}" src="${img(state)}" alt="${esc(state.name)}" style="width:${px}px;height:${px}px" data-mascota-av>`;
}
export function chipHTML(state, scope) {
  return `<button type="button" class="mascota-chip" data-mascota="panel" data-scope="${esc(scope || "app")}" aria-label="Abrir el panel de ${esc(state.name)}">${avatarHTML(state, sizePx(state))}<span class="mascota-nombre" data-mascota-nombre>${esc(state.name)}</span></button>`;
}
export function celebrationHTML(state, what, px = CELEB_PX) {
  return `<div class="mascota-celeb">${avatarHTML(state, px, "bailando")}<p><b>${esc(celebrateLine(state, what))}</b></p></div>`;
}
export function dance(im) {
  if (!im) return;
  im.classList.add("bailando");
  setTimeout(() => im.classList.remove("bailando"), 2600);
}
// Refresca en su sitio todo lo que muestra a la mascota (encabezado, chat,
// panel) tras guardar un cambio, sin recargar la página.
export function refreshUI(scope) {
  const st = load(scope);
  document.querySelectorAll("[data-mascota-av]").forEach((im) => { im.src = img(st); im.alt = st.name; });
  document.querySelectorAll("[data-mascota-nombre]").forEach((n) => { n.textContent = st.name; });
  document.querySelectorAll(".mascota-chip .mascota-av").forEach((im) => { im.style.width = sizePx(st) + "px"; im.style.height = sizePx(st) + "px"; });
}

// ---------- Panel (hoja) ----------
let currentScope = "app";
export async function openPanel(scope) {
  currentScope = scope || "app";
  const st = load(currentScope);
  const { open } = await sheet();
  open(st.name, "Tu mascota · " + VIBES[st.vibe].label, `
    <div class="mascota-panel">
      <div class="mascota-hero">${avatarHTML(st, PANEL_PX)}<div><b>${esc(st.name)}</b><span>${esc(saludo(st))}</span></div></div>
      <span class="lbl">Nombre</span>
      <form data-mascotaform="nombre" class="fld">
        <input name="nm" value="${esc(st.name)}" maxlength="20" autocomplete="off" aria-label="Nombre de tu mascota">
        <div class="row-acts">${NAME_SUGGESTIONS.map((s) => `<button type="button" class="btn sm ghost" data-mascotaj="sug" data-v="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <button class="btn" type="submit">Guardar nombre</button>
      </form>
      <span class="lbl">Personalidad</span>
      <div class="pickgrid">${Object.entries(VIBES).map(([k, v]) => `<button type="button" class="btn sm${st.vibe === k ? "" : " ghost"}" data-mascotaj="vibe" data-v="${k}" aria-pressed="${st.vibe === k}">${v.label}</button>`).join("")}</div>
      <span class="lbl">Aspecto</span>
      <div class="mascota-aspectos">${ASPECTOS.map((a) => `<button type="button" data-mascotaj="aspecto" data-v="${a.id}" aria-pressed="${st.aspecto === a.id}"><img src="${a.img}" alt="${a.label}" width="56" height="56"><span>${a.label}</span></button>`).join("")}</div>
      <span class="lbl">Tamaño del avatar</span>
      <div class="pickgrid">${Object.entries(TAMS).map(([k, v]) => `<button type="button" class="btn sm${st.tam === k ? "" : " ghost"}" data-mascotaj="tam" data-v="${k}" aria-pressed="${st.tam === k}">${v.label}</button>`).join("")}</div>
      <button type="button" class="btn" data-mascotaj="baila">¡Baila!</button>
      <p class="hint">El nombre y la personalidad son de la liga: se guardan en este celular.</p>
    </div>`);
}

function onPanelClick(a, el) {
  const st = load(currentScope);
  if (a === "sug") {
    const inp = document.querySelector('#sheet input[name="nm"]');
    if (inp) { inp.value = el.dataset.v; inp.focus(); }
    return;
  }
  if (a === "baila") { dance(document.querySelector("#sheet .mascota-hero img")); return; }
  if (a === "vibe" || a === "aspecto" || a === "tam") {
    save(currentScope, { ...st, [a === "vibe" ? "vibe" : a === "aspecto" ? "aspecto" : "tam"]: el.dataset.v });
    refreshUI(currentScope);
    openPanel(currentScope).catch((e) => console.error(e)); // re-render del panel con el nuevo estado
    return;
  }
}

function onPanelSubmit(formId, form, fd) {
  if (formId !== "nombre") return;
  const st = save(currentScope, { ...load(currentScope), name: fd.get("nm") });
  refreshUI(currentScope);
  openPanel(currentScope).catch((e) => console.error(e));
  toast("Tu mascota ahora se llama " + st.name);
}

// Una sola vez: tocar el chip abre el panel; la X y el fondo cierran la hoja.
let wired = false;
export function initMascota() {
  if (wired) return; wired = true;
  document.addEventListener("click", (e) => {
    const t = e.target.closest('[data-mascota="panel"]');
    if (t) { openPanel(t.dataset.scope || "app").catch((err) => console.error(err)); return; }
    if (e.target.closest('#sheet [data-cl="close"]')) sheet().then(({ close }) => close()).catch((err) => console.error(err));
  });
  sheet().then(({ wireNs }) => wireNs("mascota", onPanelClick, onPanelSubmit)).catch((err) => console.error(err));
}
