import { standings, scorers, roundRobin } from "../../app/league/standings.js";
let ok = 0, bad = 0;
const t = (n, c, i) => (c ? (ok++, console.log("  ok  ", n)) : (bad++, console.log("  FALLA", n, i ?? "")));
const T = (id) => ({ id, name: id.toUpperCase(), status: "active" });
const M = (id, h, a, hg, ag, st = "played") => ({ id, home_id: h, away_id: a, home_goals: st === "played" ? hg : null, away_goals: st === "played" ? ag : null, status: st });
const teams = ["a", "b", "c", "d"].map(T);
const base = { pts_win: 3, pts_draw: 1, pts_loss: 0 };

// puntos básicos
let r = standings({ ...base, tiebreakers: ["dg"] }, teams, [M(1, "a", "b", 2, 0), M(2, "c", "d", 1, 1), M(3, "a", "c", 0, 0, "scheduled")]);
t("gana 3, empata 1, no jugado no cuenta", r[0].id === "a" && r[0].pts === 3 && r[0].pj === 1 && r.find((x) => x.id === "c").pts === 1 && r.find((x) => x.id === "c").pj === 1);
t("posiciones numeradas", r.map((x) => x.pos).join() === "1,2,3,4");

// puntos configurables
r = standings({ pts_win: 2, pts_draw: 1, pts_loss: 0, tiebreakers: [] }, teams, [M(1, "a", "b", 1, 0)]);
t("puntos por victoria configurables", r[0].pts === 2);

// desempate por DG vs GF según orden configurado: A y B con 3 pts
const mm = [M(1, "a", "c", 5, 4), M(2, "b", "d", 3, 0), M(3, "c", "d", 0, 0, "scheduled")];
r = standings({ ...base, tiebreakers: ["dg", "gf"] }, teams, mm);
t("empate en puntos: diferencia de goles primero", r[0].id === "b" && r[1].id === "a", r.map((x) => x.id + x.dg).join());
r = standings({ ...base, tiebreakers: ["gf", "dg"] }, teams, mm);
t("con otro orden gana quien más goles hizo", r[0].id === "a", r.map((x) => x.id).join());

// enfrentamiento directo: A, B, C empatados en puntos; A le ganó a B, B a C, C a A (círculo) + D pierde con todos → h2h no resuelve, cae a siguiente
const ring = [M(1, "a", "b", 1, 0), M(2, "b", "c", 2, 0), M(3, "c", "a", 3, 0)];
r = standings({ ...base, tiebreakers: ["h2h", "gf"] }, teams, ring);
t("h2h circular cae al siguiente criterio", r.slice(0, 3).map((x) => x.id).join() === "c,b,a", r.map((x) => x.id).join());

// h2h resuelve a dos empatados aunque DG global diga lo contrario
const h = [M(1, "a", "b", 1, 0), M(2, "b", "c", 5, 0), M(3, "a", "d", 0, 1), M(4, "c", "d", 0, 0)];
r = standings({ ...base, tiebreakers: ["h2h", "dg"] }, teams, h);
const pa = r.findIndex((x) => x.id === "a"), pb = r.findIndex((x) => x.id === "b");
// a: 3 pts (1-0 b, 0-1 d => 3), b: 3 pts (0-1 a, 5-0 c) => empatados; h2h: a ganó a b
t("enfrentamiento directo manda sobre la diferencia global", r[pa].pts === r[pb].pts && pa < pb, r.map((x) => x.id + x.pts + "/" + x.dg).join());

// juego limpio
const ev = [{ match_id: 1, team_id: "a", kind: "red", n: 1 }, { match_id: 1, team_id: "b", kind: "yellow", n: 1 }];
r = standings({ ...base, tiebreakers: ["fairplay"] }, teams, [M(1, "a", "b", 1, 1)], ev);
t("juego limpio: menos tarjetas queda arriba", r[0].id === "b" && r[0].fair === 1 && r[1].fair === 3, r.map((x) => x.id + x.fair).join());

// determinismo: sin criterios, orden alfabético
r = standings({ ...base, tiebreakers: [] }, teams, []);
t("sin datos: orden alfabético estable", r.map((x) => x.id).join() === "a,b,c,d");
t("equipo retirado conserva su historial", standings(base, [{ ...T("a"), status: "withdrawn" }, T("b")], [M(1, "a", "b", 1, 0)])[0].withdrawn === true);

// goleo
const evs = [{ match_id: 1, team_id: "a", player: "Pepe", kind: "goal", n: 1 }, { match_id: 1, team_id: "a", player: " pepe ", kind: "goal", n: 1 },
  { match_id: 1, team_id: "b", player: "Pepe", kind: "goal", n: 1 }, { match_id: 1, team_id: "b", player: "Ana", kind: "own_goal", n: 1 }, { match_id: 2, team_id: "c", player: "Luis", kind: "goal", n: 1 }];
const sc = scorers(teams, [M(1, "a", "b", 2, 1), M(2, "c", "d", 1, 0, "scheduled")], evs);
t("goleo suma por jugador y equipo (mayúsculas/espacios)", sc[0].player === "Pepe" && sc[0].goals === 2 && sc[0].team_id === "a", JSON.stringify(sc));
t("mismo nombre en otro equipo es otro jugador", sc.length === 2 && sc[1].goals === 1);
t("autogol y partidos no jugados no cuentan", !sc.some((s) => s.player === "Ana" || s.player === "Luis"));

// calendario todos contra todos
const rr = roundRobin(["a", "b", "c", "d"]);
t("4 equipos: 6 partidos en 3 jornadas", rr.length === 6 && new Set(rr.map((m) => m.round)).size === 3);
t("nadie juega dos veces por jornada", [...new Set(rr.map((m) => m.round))].every((j) => { const ids = rr.filter((m) => m.round === j).flatMap((m) => [m.home, m.away]); return new Set(ids).size === ids.length; }));
t("cada par se enfrenta una vez", new Set(rr.map((m) => [m.home, m.away].sort().join())).size === 6);
t("5 equipos: descansa uno por jornada, 10 partidos", roundRobin(["a", "b", "c", "d", "e"]).length === 10);
t("ida y vuelta duplica y cambia la localía", roundRobin(["a", "b", "c", "d"], 2).length === 12 && roundRobin(["a", "b"], 2).map((m) => m.home).join() === "a,b");
console.log(`\n${ok} pruebas pasaron, ${bad} fallaron`); process.exit(bad ? 1 : 0);
