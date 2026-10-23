// Motores para leer la foto de un acta. Todos devuelven TEXTO; nunca deciden nada oficial.
//   manual  -> sin lectura automática: la persona captura mirando la foto. Siempre disponible, sin costo.
//   browser -> OCR en el celular con Tesseract.js (la foto no sale del teléfono; descarga el motor y el idioma la primera vez). Sin costo.
//   server  -> un servicio propio (por ejemplo una función de Supabase) que recibe la imagen y responde {"text": "..."}.
//              Se activa poniendo su dirección en OCR.server de config.js. NO viene desplegado: ver docs/ACTAS.md.
import { OCR } from "../config.js";

export const ENGINES = {
  manual: { label: "A mano", note: "Capturas el marcador mirando la foto." },
  browser: { label: "Leer con el celular (OCR)", note: "Se lee en tu teléfono; la primera vez descarga el motor y puede tardar. La letra a mano suele leerse mal: revisa todo." },
  server: { label: "Leer con el servicio", note: "La foto se envía al servicio de lectura configurado por la liga." },
};

export const available = () => ["manual", ...(typeof Worker !== "undefined" ? ["browser"] : []), ...(OCR && OCR.server ? ["server"] : [])];

export async function readBrowser(blob, load = () => import("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js")) {
  const { createWorker } = await load();
  const w = await createWorker("spa");
  try { const r = await w.recognize(blob); return String(r.data.text || ""); } finally { await w.terminate(); }
}

// Contrato del servicio: POST de la imagen con el token de la sesión; responde JSON {"text": "..."}.
export async function readServer(url, blob, token, fetchFn = fetch) {
  const r = await fetchFn(url, { method: "POST", headers: { "Content-Type": blob.type || "image/jpeg", Authorization: "Bearer " + token }, body: blob });
  if (!r.ok) throw new Error("El servicio de lectura respondió con error (" + r.status + ").");
  const j = await r.json();
  if (!j || typeof j.text !== "string") throw new Error("El servicio de lectura respondió algo inesperado.");
  return j.text.slice(0, 8000);
}

export async function read(engine, blob, token) {
  if (engine === "browser") return readBrowser(blob);
  if (engine === "server") { if (!(OCR && OCR.server)) throw new Error("El servicio de lectura no está configurado."); return readServer(OCR.server, blob, token); }
  return "";
}
