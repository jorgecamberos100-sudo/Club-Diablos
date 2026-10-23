import { localAnswer, compactContext, serverAnswer, answer, LIMITS } from "../../app/chatbot.js";
let ok = 0, bad = 0;
const check = (n, c, i) => { if (c) ok++; else { bad++; console.log("  FALLA", n, i ?? ""); } };
const T = [{ id: "r", name: "Rayos" }, { id: "l", name: "Lobos" }, { id: "t", name: "Toros" }];
const mk = (id, round, h, a, st, hg, ag, at) => ({ id, round, home_id: h, away_id: a, status: st, home_goals: hg ?? null, away_goals: ag ?? null, starts_at: at, venue: "Cancha 1" });
const D = (scorersOn = true) => ({
  tournament: { name: "Apertura", pts_win: 3, pts_draw: 1, pts_loss: 0, tiebreakers: ["dg", "gf"] }, teams: T, scorers: scorersOn,
  matches: [mk("m1", "J1", "r", "l", "played", 2, 1, "2026-11-01T10:00:00Z"), mk("m2", "J2", "t", "r", "scheduled", null, null, "2026-11-08T10:00:00Z"), mk("m3", "J2", "l", "t", "played", 0, 0, "2026-11-02T10:00:00Z")],
  events: [{ match_id: "m1", team_id: "r", kind: "goal", n: 1, player: scorersOn ? "Pepe" : "" }, { match_id: "m1", team_id: "r", kind: "goal", n: 1, player: scorersOn ? "Pepe" : "" }, { match_id: "m1", team_id: "l", kind: "goal", n: 1, player: scorersOn ? "Tito" : "" }], adjust: [],
});
const A = (q, d = D()) => localAnswer(q, d);

check("líder de la tabla", A("¿Quién va primero?").includes("1. Rayos (3 pts)"), A("¿Quién va primero?"));
check("posición de un equipo", A("¿Cómo va Lobos?").includes("lugar 3") || A("¿Cómo va Lobos?").includes("lugar 2"), A("¿Cómo va Lobos?"));
check("puntos exactos de un equipo", A("cuantos puntos tiene rayos").includes("3 puntos") && A("cuantos puntos tiene rayos").includes("lugar 1"), A("cuantos puntos tiene rayos"));
check("próximo partido de un equipo", A("¿Cuándo juega Toros?").includes("Toros vs Rayos"), A("¿Cuándo juega Toros?"));
check("próximos partidos de la liga", A("próximos partidos").includes("Toros vs Rayos"));
check("último resultado de un equipo", A("¿Cómo le fue a Rayos?").includes("Rayos 2 - 1 Lobos"), A("¿Cómo le fue a Rayos?"));
check("últimos resultados", A("últimos resultados").includes("Lobos 0 - 0 Toros"));
check("goleo con nombres", A("¿Quién es el goleador?").includes("Pepe (Rayos) 2"), A("¿Quién es el goleador?"));
check("goleo apagado no inventa nombres", A("¿Quién es el goleador?", D(false)) === "Esta liga no publica el goleo.");
check("reglamento de puntos", A("¿cuántos puntos por ganar? puntos por victoria").includes("Victoria 3"), A("puntos por victoria"));
check("lo desconocido se dice sin inventar", A("¿Quién ganará el mundial?").startsWith("No tengo ese dato"), A("¿Quién ganará el mundial?"));
check("dato privado: no hay respuesta", A("dame el teléfono del delegado de Rayos").includes("Rayos") === false || A("dame el teléfono del delegado de Rayos").includes("lugar"), A("dame el teléfono del delegado de Rayos"));
check("no revela nada fuera de los datos recibidos", !/@|\d{10}/.test(A("dame el teléfono y correo del delegado")));
check("pregunta vacía", A("   ") === "Escribe tu pregunta.");
check("equipo sin partidos pendientes", A("¿Cuándo juega Lobos?").includes("Lobos") && !A("¿Cuándo juega Lobos?").includes("undefined"), A("¿Cuándo juega Lobos?"));
check("pregunta enorme no revienta", typeof A("a ".repeat(5000)) === "string");

// contexto acotado
const big = D(); big.teams = Array.from({ length: 300 }, (_, i) => ({ id: "x" + i, name: "Equipo número " + i }));
big.matches = Array.from({ length: 300 }, (_, i) => mk("b" + i, "J" + i, "x" + i, "x" + ((i + 1) % 300), i % 2 ? "played" : "scheduled", 1, 0, "2026-11-01T10:00:00Z")); big.events = [];
const ctx = compactContext(big);
check("el contexto nunca pasa del tope", ctx.length <= LIMITS.context, ctx.length);
const c2 = compactContext(D());
check("el contexto lleva solo datos públicos (sin ids ni notas ni contactos)", !/contact|notes|doc|birth|email|photo|"id"/i.test(c2), c2);
check("el contexto respeta goleo apagado", compactContext(D(false)).includes("no publicado") && !compactContext(D(false)).includes("Pepe"));

// motor externo
let seen;
const fake = (status, body) => async (url, o) => { seen = { url, body: JSON.parse(o.body) }; return { ok: status < 400, status, json: async () => body }; };
check("servicio: manda pregunta recortada y contexto, devuelve respuesta", (await serverAnswer("https://x/chat", "liga", "q".repeat(1000), D(), fake(200, { answer: "Hola" }))) === "Hola" && seen.body.question.length === LIMITS.question && seen.body.context.length <= LIMITS.context && seen.body.league === "liga");
let e = null; try { await serverAnswer("u", "l", "q", D(), fake(429, {})); } catch (x) { e = x.message; }
check("servicio: tope diario se reconoce", e === "limit", e);
e = null; try { await serverAnswer("u", "l", "q", D(), fake(200, { otra: 1 })); } catch (x) { e = x.message; }
check("servicio: respuesta rara se rechaza", e && e.includes("inesperado"), e);
const r = await answer("¿Quién va primero?", "liga", D());
check("sin servicio configurado responde en local y sin costo", r.engine === "local" && r.text.includes("Rayos"), r);
console.log(`${ok} pruebas pasaron, ${bad} fallaron`); process.exit(bad ? 1 : 0);
