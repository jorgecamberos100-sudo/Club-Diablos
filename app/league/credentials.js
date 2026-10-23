// Credenciales para imprimir: tamaño tarjeta (85.6 × 54 mm), una sola o varias por hoja carta/A4 (10 por hoja).
// Solo llevan lo necesario: nombre, número, equipo, torneo, foto y un código de verificación. No llevan documento ni fecha de nacimiento.
import { esc } from "../util.js";

export const credId = (rid) => { const h = String(rid).replace(/[^0-9a-f]/gi, "").slice(0, 8).toUpperCase().padEnd(8, "0"); return h.slice(0, 4) + "-" + h.slice(4); };

const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : "#c8102e");
const safeImg = (u) => (/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(u || "") ? u : "");

export function cardHTML(c, brand, league) {
  const color = safeColor(brand && brand.color), logo = safeImg(brand && brand.logo), photo = safeImg(c.photo);
  return `<div class="cred" style="--cc:${color}">
    <div class="cred-h">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><b>${esc(league)}</b><small>${esc([c.tournament, c.season].filter(Boolean).join(" · "))}</small></div></div>
    <div class="cred-b"><div class="cred-ph">${photo ? `<img src="${esc(photo)}" alt="">` : `<span>Sin foto</span>`}</div>
      <div class="cred-i"><b>${esc(c.name)}</b><span>${esc(c.team)}</span>${c.number != null && c.number !== "" ? `<em>#${esc(c.number)}</em>` : ""}</div></div>
    <div class="cred-f"><span>Credencial ${esc(credId(c.id))}</span><span>${esc(c.season || "")}</span></div></div>`;
}

export async function printCredentials(cards, brand, league) {
  let root = document.getElementById("print-root");
  if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.appendChild(root); }
  root.innerHTML = `<div class="cred-sheet">${cards.map((c) => cardHTML(c, brand, league)).join("")}</div>`;
  await Promise.all([...root.querySelectorAll("img")].map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));
  const clean = () => { root.innerHTML = ""; window.removeEventListener("afterprint", clean); };
  window.addEventListener("afterprint", clean); window.print();
}
