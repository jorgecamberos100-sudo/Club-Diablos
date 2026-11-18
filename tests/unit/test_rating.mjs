import { computeRatings, mvpOf, tierOf, DEFAULT_CFG, ATTR_KEYS } from "../../app/rating.js";

let ok = 0, bad = 0;
const check = (n, c, i) => { if (c) ok++; else { bad++; console.log("  FALLA", n, i ?? ""); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Constantes y configuración por defecto
check("DEFAULT_CFG tiene pesos esperados", DEFAULT_CFG.weights.atributos === 0.5 && DEFAULT_CFG.weights.forma === 0.4 && DEFAULT_CFG.weights.compromiso === 0.1);
check("ATTR_KEYS tiene 6 atributos", eq(ATTR_KEYS, ["vel", "tir", "pas", "reg", "def", "fis"]));

// 2. tierOf
check("tierOf null da t-club", tierOf(null) === "t-club");
check("tierOf undefined da t-club", tierOf(undefined) === "t-club");
check("tierOf NaN da t-club", tierOf(NaN) === "t-club");
check("tierOf texto da t-club", tierOf("75") === "t-club");
check("tierOf < 65 da t-bronce", tierOf(64) === "t-bronce" && tierOf(40) === "t-bronce");
check("tierOf 65..74 da t-plata", tierOf(65) === "t-plata" && tierOf(74) === "t-plata");
check("tierOf >= 75 da t-oro", tierOf(75) === "t-oro" && tierOf(99) === "t-oro");

// 3. mvpOf
check("mvpOf nulo o vacío da null", mvpOf(null) === null && mvpOf({}) === null && mvpOf({ mvp: [] }) === null);
check("mvpOf con menos de 3 votos da null", mvpOf({ mvp: [{ voter: "p1", target: "p2" }, { voter: "p3", target: "p2" }] }) === null);
check("mvpOf ignora votos a sí mismo", mvpOf({ mvp: [{ voter: "p1", target: "p1" }, { voter: "p2", target: "p1" }, { voter: "p3", target: "p1" }] }) === null);
check("mvpOf ignora votos malformados sin reventar", mvpOf({ mvp: [null, undefined, { voter: "p1", target: "p2" }, { voter: "p3", target: "p2" }, { voter: "p4", target: "p2" }] }) === "p2");
check("mvpOf con ganador claro", mvpOf({ mvp: [{ voter: "p1", target: "p3" }, { voter: "p2", target: "p3" }, { voter: "p4", target: "p2" }] }) === "p3");
check("mvpOf en empate da null", mvpOf({ mvp: [{ voter: "p1", target: "p2" }, { voter: "p3", target: "p4" }, { voter: "p5", target: "p2" }, { voter: "p6", target: "p4" }] }) === null);

// 4. computeRatings - Casos límite y entradas nulas
check("computeRatings con entradas nulas devuelve objeto vacío", eq(computeRatings(null, null), {}) && eq(computeRatings({}, null), {}) && eq(computeRatings(null, []), {}));

// 5. computeRatings - Atributos manuales
const pManual = { id: "p1", name: "Pepe", attrs: { vel: 70, tir: 80, pas: 75, reg: 65, def: 50, fis: 60 } };
const resManual = computeRatings({ evaluations: [], matches: [] }, [pManual]);
check("jugador con atributos manuales calcula media inicial", resManual.p1 && resManual.p1.media === 67 && resManual.p1.attrs.tir === 80);
check("sin partidos, forma y compromiso son null", resManual.p1.forma === null && resManual.p1.compromiso === null);

// 6. computeRatings - Votaciones de compañeros con recorte robusto
// 5 votos para p2: [5, 6, 7, 8, 9]. Al recortar extremos (5 y 9) quedan [6, 7, 8] -> promedio 7 -> escala 40..99: 40 + (6*59/9) = 79.33 -> 79
const p2 = { id: "p2", name: "Carlos" };
const evalsP2 = [5, 6, 7, 8, 9].map((val, i) => ({
  voter: "v" + i,
  target: "p2",
  vel: val, tir: val, pas: val, reg: val, def: val, fis: val
}));
// Agregar un autovoto que debe ser descartado
evalsP2.push({ voter: "p2", target: "p2", vel: 10, tir: 10, pas: 10, reg: 10, def: 10, fis: 10 });
// Agregar un voto con NaN y basura que debe ser descartado
evalsP2.push({ voter: "v99", target: "p2", vel: NaN, tir: null, pas: "10", reg: undefined, def: Infinity, fis: -Infinity });

const resP2 = computeRatings({ evaluations: evalsP2, matches: [] }, [p2]);
check("evaluaciones de compañeros recortan extremos e ignoran autovotos/NaN", resP2.p2 && resP2.p2.attrs && resP2.p2.attrs.vel === 79 && resP2.p2.media === 79);

// 7. computeRatings - Partidos, forma, goles y asistencias
const matchesP2 = [
  { id: "m1", date: "2026-11-01", score: "2-1", played: ["p2"], ratings: [{ voter: "v1", target: "p2", score: 8 }, { voter: "v2", target: "p2", score: 8 }, { voter: "v3", target: "p2", score: 8 }], stats: { p2: { g: 2, a: 1 } }, mvp: [{ voter: "v1", target: "p2" }, { voter: "v2", target: "p2" }, { voter: "v3", target: "p2" }] },
  { id: "m2", date: "2026-11-08", score: "1-0", played: ["p2"], ratings: [{ voter: "v1", target: "p2", score: 9 }, { voter: "v2", target: "p2", score: 9 }, { voter: "v3", target: "p2", score: 9 }], stats: { p2: { g: 1, a: 0 } } },
  { id: "m3", date: "2026-11-15", score: "0-1", played: [], ratings: [] } // No jugó este partido
];
const resP2Matches = computeRatings({ evaluations: evalsP2, matches: matchesP2 }, [p2]);
check("partidos jugados, goles, asistencias y mvps acumulados", resP2Matches.p2.played === 2 && resP2Matches.p2.goals === 3 && resP2Matches.p2.assists === 1 && resP2Matches.p2.mvps === 1);
check("compromiso 2 de 3 partidos calculado", resP2Matches.p2.compromiso === Math.round(40 + 59 * (2 / 3)));
check("forma calculada a partir de calificaciones de partido", typeof resP2Matches.p2.forma === "number" && resP2Matches.p2.forma > 79);
check("tendencia positiva detectada con último partido alto", resP2Matches.p2.trend === 1);

// 8. Configuración personalizada de pesos
const customCfg = { weights: { atributos: 1.0, forma: 0, compromiso: 0 } };
const resCustom = computeRatings({ evaluations: evalsP2, matches: matchesP2 }, [p2], customCfg);
check("pesos personalizados aplicados correctamente", resCustom.p2.media === resCustom.p2.attrs.vel);

console.log(`${ok} pruebas pasaron, ${bad} fallaron`);
process.exit(bad ? 1 : 0);
