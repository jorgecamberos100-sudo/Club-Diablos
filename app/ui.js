// Piezas visuales compartidas por Mi cuenta y el panel de liga.
import { esc } from "./util.js";

export const card = (h, body, cls = "") => `<section class="s cl-card ${cls}">${h ? `<h2>${esc(h)}</h2>` : ""}${body}</section>`;
export const chip = (txt, kind = "ok") => `<span class="chip ${kind}">${esc(txt)}</span>`;
export const row = (title, sub, right = "") => `<div class="cl-row static"><span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${right ? `<span class="acts">${right}</span>` : ""}</div>`;
export const btn = (label, attrs = "", cls = "") => `<button type="button" class="btn sm ${cls}" ${attrs}>${esc(label)}</button>`;
export const empty = (t) => `<p class="hint">${esc(t)}</p>`;

export const dshort = (d) => { try { return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };
export const dtime = (d) => { try { return new Date(d).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

let timer;
export function toast(msg, bad = false) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(timer); timer = setTimeout(() => { t.className = "toast"; }, bad ? 6000 : 3500);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}
export const waLink = (text) => "https://wa.me/?text=" + encodeURIComponent(text);
export const appURL = () => location.origin + location.pathname;

// Entrega un archivo generado en el navegador (CSV, etc.) como descarga.
export function saveFile(name, text, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Reduce una foto a un JPEG chico (lado máximo en px) antes de subirla: ahorra datos y evita fotos enormes.
export function shrinkImage(file, max = 480, quality = 0.82, type = "image/jpeg") {
  return new Promise((res, rej) => {
    // Solo fotos (sin SVG, que puede llevar código) y de un tamaño razonable antes de reducirlas.
    if (!file || !/^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(file.type || "")) return rej(new Error("Archivo no permitido"));
    if (file.size > 25 * 1024 * 1024) return rej(new Error("Archivo demasiado grande"));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob((b) => (b ? res(b) : rej(new Error("Datos no válidos"))), type, quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Archivo no permitido")); }; img.src = url;
  });
}
