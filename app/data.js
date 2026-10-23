// Capa de datos. Hoy lee archivos JSON del propio sitio; cuando exista la base de
// datos solo se reemplazan estas funciones y las vistas siguen igual.
//
// Modelo:
//   clubs.json                      -> lista de clubes
//   clubs/<club>/club.json          -> marca del club: nombre, escudo, colores, contacto
//   clubs/<club>/players.json       -> jugadores del club (un jugador puede estar en varios equipos)
//   clubs/<club>/teams/<team>.json  -> equipo: plantel con dorsales, finanzas y alineaciones

import { on, init, api } from "./cloud.js";

const BASE = new URL("../data/", import.meta.url);
// Equipos creados en la app: si el archivo no existe, se leen de la base de datos.
async function viaDB(fn, ...a) { if (!on) return null; await init(); return api[fn](...a); }

async function getJSON(path) {
  const url = new URL(path, BASE);
  url.searchParams.set("t", Date.now());
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo cargar " + path);
  return r.json();
}

export const assetURL = (clubId, file) => (file ? new URL(`clubs/${clubId}/${file}`, BASE).href : "");

export async function loadClubs() {
  return (await getJSON("clubs.json")).clubs;
}

export async function loadClub(clubId) {
  try {
    const [club, players] = await Promise.all([getJSON(`clubs/${clubId}/club.json`), getJSON(`clubs/${clubId}/players.json`)]);
    return { club, players: players.players };
  } catch (e) {
    const r = await viaDB("dbClub", clubId);
    if (!r) throw e;
    return { club: r.club, players: r.players };
  }
}

export async function loadTeam(clubId, teamId) {
  try {
    return await getJSON(`clubs/${clubId}/teams/${teamId}.json`);
  } catch (e) {
    const t = await viaDB("dbTeam", clubId, teamId);
    if (!t) throw e;
    return { ...t, db: true };
  }
}
