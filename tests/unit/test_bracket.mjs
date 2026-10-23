import { drawGroups, groupFixtures, groupTables, qualifiers, bracketOrder, firstRound, koWinner, nextRound, koRounds, champion, groupsDone, isPow2, roundName } from "../../app/league/bracket.js";
let ok = 0, bad = 0;
const check = (n, c, i) => { if (c) ok++; else { bad++; console.log("  FALLA", n, i ?? ""); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const g = drawGroups(["a", "b", "c", "d", "e", "f", "g", "h"], 2);
check("sorteo en serpiente: 4 y 4, equilibrado", eq(Object.values(g).sort(), ["A", "A", "A", "A", "B", "B", "B", "B"]) && g.a === "A" && g.b === "B" && g.c === "B" && g.d === "A", g);
check("bracketOrder 8", eq(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]));
check("bracketOrder 4", eq(bracketOrder(4), [1, 4, 2, 3]));
check("potencias de 2", isPow2(2) && isPow2(16) && !isPow2(6) && !isPow2(1));

const teams = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, name: id.toUpperCase(), group_label: i < 3 ? "A" : "B", status: "active" }));
const fx = groupFixtures(teams);
check("partidos de grupo: 3 por grupo, sin cruces entre grupos", fx.length === 6 && fx.every((m) => m.stage === "group" && teams.find((t) => t.id === m.home).group_label === m.group && teams.find((t) => t.id === m.away).group_label === m.group));
const T = { pts_win: 3, pts_draw: 1, pts_loss: 0, tiebreakers: ["dg"] };
let n = 0; const ms = fx.map((m) => ({ id: "m" + n++, home_id: m.home, away_id: m.away, stage: "group", group_label: m.group, status: "scheduled", home_goals: null, away_goals: null }));
check("grupos sin terminar", !groupsDone(ms));
ms.forEach((m) => { m.status = "played"; const [h, a] = [m.home_id, m.away_id]; m.home_goals = h < a ? 2 : 0; m.away_goals = h < a ? 0 : 1; });   // gana el de letra menor
check("grupos terminados", groupsDone(ms));
const tb = groupTables(T, teams, ms.concat([{ id: "k1", stage: "knockout", home_id: "a", away_id: "d", status: "played", home_goals: 9, away_goals: 0 }]));
check("una tabla por grupo, sin contar la eliminatoria", tb.length === 2 && tb[0].rows.length === 3 && tb[0].rows[0].id === "a" && tb[0].rows[0].pts === 6 && tb[0].rows[0].gf === 3, tb[0].rows);
const q = qualifiers(tb, 2);
check("clasificados: primeros y luego segundos", eq(q.map((x) => x.id), ["a", "d", "b", "e"]), q);
const r1 = firstRound(q.map((x) => x.id));
check("cruces: 1º A contra 2º B y 1º B contra 2º A", eq(r1.map((m) => [m.home, m.away]), [["a", "e"], ["d", "b"]]), r1);
let e = null; try { firstRound(["a", "b", "c"]); } catch (x) { e = x.message; }
check("eliminatoria con 3 equipos se rechaza con mensaje claro", e && e.includes("2, 4, 8"));
const ko = r1.map((m, i) => ({ id: "s" + i, stage: "knockout", ko_round: 1, ko_slot: m.ko_slot, home_id: m.home, away_id: m.away, status: "played", home_goals: 1, away_goals: 1, home_pens: i ? 3 : 4, away_pens: i ? 5 : 2 }));
check("ganador por penales", koWinner(ko[0]) === "a" && koWinner(ko[1]) === "b");
check("empate sin penales no tiene ganador", koWinner({ status: "played", home_goals: 1, away_goals: 1, home_id: "x", away_id: "y" }) === null);
const nx = nextRound(ko);
check("siguiente ronda con los ganadores (final)", eq(nx, [{ home: "a", away: "b", ko_round: 2, ko_slot: 1 }]), nx);
check("nombres de ronda", roundName(1) === "Final" && roundName(2) === "Semifinal" && roundName(4) === "Cuartos" && roundName(8) === "Octavos");
check("no hay siguiente ronda si falta un resultado", nextRound([{ ...ko[0] }, { ...ko[1], status: "scheduled" }]).length === 0);
const fin = ko.concat([{ id: "f", stage: "knockout", ko_round: 2, ko_slot: 1, home_id: "a", away_id: "b", status: "played", home_goals: 0, away_goals: 2 }]);
check("rondas ordenadas con nombre", eq(koRounds(fin).map((r) => r.name), ["Semifinal", "Final"]));
check("campeón", champion(fin) === "b" && nextRound(fin).length === 0);
const r8 = firstRound(["1", "2", "3", "4", "5", "6", "7", "8"]);
check("siembra de 8: el 1 y el 2 solo se cruzan en la final", eq(r8.map((m) => m.home + m.away), ["18", "45", "27", "36"]));
console.log(`${ok} pruebas pasaron, ${bad} fallaron`); process.exit(bad ? 1 : 0);
