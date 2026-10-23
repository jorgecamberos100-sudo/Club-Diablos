import { parseActa } from "../../app/ocr/parse.js";
import { readServer, readBrowser } from "../../app/ocr/engines.js";
let ok = 0, bad = 0;
const check = (n, c, i) => { if (c) ok++; else { bad++; console.log("  FALLA", n, i ?? ""); } };
const H = { id: "h", name: "Rayos" }, A = { id: "a", name: "Lobos FC" };
const P = (t) => parseActa(t, H, A);

let r = P("Marcador: 2 - 1\nGol: Pepe Pérez (Rayos)\nGol: Pepe Pérez (Rayos)\nGol: Tito - Lobos FC\nAmarilla: Beto (Lobos FC)\nRoja: Luis Rayos");
check("marcador", r.hg === 2 && r.ag === 1, r);
check("goles de un jugador (dos filas)", r.events.filter((e) => e.player === "Pepe Pérez" && e.kind === "goal" && e.team === "h").length === 2, r.events);
check("equipo con guion y sin paréntesis", r.events.some((e) => e.player === "Tito" && e.team === "a"), r.events);
check("tarjetas con equipo", r.events.some((e) => e.kind === "yellow" && e.player === "Beto" && e.team === "a") && r.events.some((e) => e.kind === "red" && e.player === "Luis" && e.team === "h"), r.events);
check("sin advertencias cuando todo cuadra", r.warnings.length === 0, r.warnings);

r = P("Rayos 3 - 0 Lobos FC");
check("marcador en la línea de los equipos", r.hg === 3 && r.ag === 0, r);
r = P("Lobos FC 1 - 2 Rayos");
check("si el visitante va primero se acomoda y avisa", r.hg === 2 && r.ag === 1 && r.warnings.length === 1, r);
r = P("Hora 10:30\nCancha 2\nJornada 3");
check("una hora no se confunde con el marcador", r.hg === null && r.warnings.some((w) => w.includes("marcador")), r);
r = P("Marcador: 1 - 0\nRayos:\nGol: Ana x2\nLobos FC:\nGol: Rita");
check("la sección fija el equipo y x2 repite", r.events.filter((e) => e.player === "Ana").length === 2 && r.events.find((e) => e.player === "Rita").team === "a", r.events);
check("goles que superan el marcador avisan", r.warnings.some((w) => w.includes("superan")), r.warnings);
r = P("Marcador 1-0\nAutogol: Memo (Lobos FC)");
check("autogol se cuenta para el rival", r.events[0].kind === "own_goal" && !r.warnings.some((w) => w.includes("superan")), r);
r = P("Marcador 1-0\nGol: Pedro");
check("sin equipo conocido se pone el local y se avisa", r.events[0].team === "h" && r.warnings.length === 1, r);
r = P("Gol:\nAmarilla: -");
check("líneas sin jugador se descartan con aviso", r.events.length === 0 && r.warnings.length >= 2, r);
r = P("");
check("texto vacío no revienta", r.hg === null && r.events.length === 0);
r = P("Marcador: 99 - 100");
check("marcadores absurdos se ignoran", r.hg === null, r);
r = P("Marcador: 1 - 1\n" + Array.from({ length: 150 }, (_, i) => `Amarilla: J${i} (Rayos)`).join("\n"));
check("tope de eventos", r.events.length <= 100, r.events.length);

// adaptadores con simulacros
let seen;
const fake = (resp, status = 200) => async (url, o) => { seen = { url, o }; return { ok: status < 400, status, json: async () => resp }; };
const blob = new Blob(["x"], { type: "image/jpeg" });
check("servidor: envía imagen y token, devuelve texto", (await readServer("https://x/ocr", blob, "TOK", fake({ text: "Marcador 1-0" }))) === "Marcador 1-0" && seen.o.headers.Authorization === "Bearer TOK" && seen.o.method === "POST");
let err = null; try { await readServer("https://x/ocr", blob, "T", fake({}, 500)); } catch (e) { err = e.message; }
check("servidor: error legible", err && err.includes("500"), err);
err = null; try { await readServer("https://x/ocr", blob, "T", fake({ nope: 1 })); } catch (e) { err = e.message; }
check("servidor: respuesta rara se rechaza", err && err.includes("inesperado"), err);
let terminated = false;
const txt = await readBrowser(blob, async () => ({ createWorker: async () => ({ recognize: async () => ({ data: { text: "Gol: Pepe" } }), terminate: async () => { terminated = true; } }) }));
check("navegador: lee y libera el motor", txt === "Gol: Pepe" && terminated);
terminated = false; err = null;
try { await readBrowser(blob, async () => ({ createWorker: async () => ({ recognize: async () => { throw new Error("boom"); }, terminate: async () => { terminated = true; } }) })); } catch (e) { err = e.message; }
check("navegador: libera el motor aun si falla", err === "boom" && terminated);
console.log(`${ok} pruebas pasaron, ${bad} fallaron`); process.exit(bad ? 1 : 0);
