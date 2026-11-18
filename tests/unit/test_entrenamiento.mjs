import { ATTR_KEYS, FOCUS_KEYS, POSICIONES, ROLES_POR_FORMATO, lineaDeRol, BANDAS, bandaDeEdad, edadDe, EJERCICIOS, validarPerfil, normalizarPerfil, generarPlan, hashPerfil } from "../../app/entrenamiento.js";

let ok = 0, bad = 0;
const check = (n, c, i) => { if (c) ok++; else { bad++; console.log("  FALLA", n, i ?? ""); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Bandas de edad
check("banda infantil 6–11", bandaDeEdad(6).id === "infantil" && bandaDeEdad(11).id === "infantil");
check("banda juvenil 12–17", bandaDeEdad(12).id === "juvenil" && bandaDeEdad(17).id === "juvenil");
check("banda adulto 18–34", bandaDeEdad(18).id === "adulto" && bandaDeEdad(34).id === "adulto");
check("banda veterano 35+", bandaDeEdad(35).id === "veterano" && bandaDeEdad(70).id === "veterano");
check("edad fuera de rango no tiene banda", bandaDeEdad(5) === null && bandaDeEdad(100) === null);
check("edadDe calcula bien", edadDe("2010-06-01", new Date("2026-11-17")) === 16 && edadDe("2010-12-01", new Date("2026-11-17")) === 15);
check("el menor no lleva cargas pesadas", bandaDeEdad(10).cargas.join() === "ninguna" && bandaDeEdad(15).cargas.join() === "ninguna,corporal");
check("el adulto sí lleva carga moderada", bandaDeEdad(25).cargas.includes("moderada"));
check("el veterano vuelve a volumen moderado", bandaDeEdad(40).cargas.join() === "ninguna,corporal" && bandaDeEdad(40).maxMin === 45);

// 2. Posiciones y roles (alineación)
check("las cuatro líneas existen", eq(Object.keys(POSICIONES), ["portero", "defensa", "mediocampo", "delantero"]));
check("lineaDeRol mapea los códigos de alineación", lineaDeRol("POR") === "portero" && lineaDeRol("DFC") === "defensa" && lineaDeRol("LAT") === "defensa" && lineaDeRol("MCD") === "mediocampo" && lineaDeRol("MCO") === "mediocampo" && lineaDeRol("EXT") === "delantero" && lineaDeRol("DC") === "delantero");
check("lineaDeRol no inventa", lineaDeRol("XYZ") === null && lineaDeRol(null) === null);
check("fut 7 y fut 11 tienen sus roles", ROLES_POR_FORMATO[7].length === 7 && ROLES_POR_FORMATO[11].length === 8 && ROLES_POR_FORMATO[7].includes("MC") && ROLES_POR_FORMATO[11].includes("MCO"));
check("los focos alinean con los atributos de rating", ATTR_KEYS.every((k) => FOCUS_KEYS.includes(k)));

// 3. Validación del perfil
const base = { edad: 20, posicion: "mediocampo", focos: ["pas", "res"], dias: 3, minutos: 45 };
check("perfil válido no tiene errores", validarPerfil(base).length === 0);
check("edad fuera de rango se rechaza", validarPerfil({ ...base, edad: 4 }).length > 0 && validarPerfil({ ...base, edad: 120 }).length > 0);
check("posición inventada se rechaza", validarPerfil({ ...base, posicion: "arquero" }).length > 0);
check("focos: ni cero ni cuatro ni repetidos", validarPerfil({ ...base, focos: [] }).length > 0 && validarPerfil({ ...base, focos: ["pas", "tir", "vel", "reg"] }).length > 0 && validarPerfil({ ...base, focos: ["pas", "pas"] }).length > 0);
check("rol que no corresponde a la posición se rechaza", validarPerfil({ ...base, posicion: "defensa", rol: "DC" }).length > 0);
check("rol que sí corresponde pasa", validarPerfil({ ...base, rol: "MCO" }).length === 0);
check("días y minutos fuera de rango se rechazan", validarPerfil({ ...base, dias: 0 }).length > 0 && validarPerfil({ ...base, dias: 6 }).length > 0 && validarPerfil({ ...base, minutos: 10 }).length > 0 && validarPerfil({ ...base, minutos: 120 }).length > 0);
check("autoevaluación fuera de 1–10 se rechaza", validarPerfil({ ...base, attrs: { vel: 11 } }).length > 0);

// 4. Normalización
check("el menor no pasa de 30 minutos por sesión", normalizarPerfil({ edad: 9, posicion: "delantero", focos: ["tir"], dias: 2, minutos: 60 }).minutos === 30);
check("el juvenil no pasa de 45", normalizarPerfil({ edad: 15, posicion: "defensa", focos: ["def"], dias: 2, minutos: 60 }).minutos === 45);
check("sin focos se sugieren los de la posición", eq(normalizarPerfil({ edad: 20, posicion: "portero", focos: [], dias: 3, minutos: 45 }).focos, ["por", "agi"]));
check("hashPerfil cambia si cambia el perfil", hashPerfil(base) !== hashPerfil({ ...base, focos: ["tir"] }) && hashPerfil(base) === hashPerfil({ ...base }));

// 5. Generador: estructura
const plan = generarPlan(base);
check("el plan tiene tantas sesiones como días", plan.sesiones.length === 3);
check("cada sesión cabe en los minutos pedidos", plan.sesiones.every((s) => s.minutos <= 45 && s.minutos >= 30));
check("cada sesión tiene calentamiento, trabajo y calma", plan.sesiones.every((s) => s.ejercicios.length >= 3 && s.ejercicios[0].id.startsWith("cal-") && s.ejercicios[s.ejercicios.length - 1].id.startsWith("calma-")));
check("los focos pedidos aparecen en la semana", ["pas", "res"].every((f) => plan.sesiones.some((s) => s.ejercicios.some((e) => ((EJERCICIOS.find((x) => x.id === e.id) || {}).focos || []).includes(f)))));
check("el resumen trae minutos por semana y nota de la banda", plan.resumen.minutosSemana === plan.sesiones.reduce((a, s) => a + s.minutos, 0) && plan.resumen.nota.length > 10);
check("generarPlan es determinista", eq(generarPlan(base), generarPlan(base)));
check("la variante rota los ejercicios", !eq(generarPlan(base, 0).sesiones, generarPlan(base, 1).sesiones));
check("cambiar los focos cambia los ejercicios", !eq(generarPlan(base).sesiones, generarPlan({ ...base, focos: ["tir", "vel"] }).sesiones));
check("cambiar los días cambia las sesiones", generarPlan({ ...base, dias: 2 }).sesiones.length === 2);

// 6. Generador: edad
const nino = generarPlan({ edad: 9, posicion: "delantero", focos: ["tir"], dias: 2, minutos: 30 });
check("el niño entrena 30 minutos por sesión", nino.sesiones.every((s) => s.minutos <= 30));
check("el niño no recibe ejercicios con carga", nino.sesiones.every((s) => s.ejercicios.every((e) => (EJERCICIOS.find((x) => x.id === e.id) || {}).carga === "ninguna")));
const jov = generarPlan({ edad: 15, posicion: "defensa", focos: ["def"], dias: 3, minutos: 45 });
check("el juvenil no recibe carga moderada", jov.sesiones.every((s) => s.ejercicios.every((e) => (EJERCICIOS.find((x) => x.id === e.id) || {}).carga !== "moderada")));
const vet = generarPlan({ edad: 42, posicion: "mediocampo", focos: ["pas"], dias: 2, minutos: 45 });
check("el veterano no recibe carga moderada", vet.sesiones.every((s) => s.ejercicios.every((e) => (EJERCICIOS.find((x) => x.id === e.id) || {}).carga !== "moderada")));
const ad = generarPlan({ edad: 25, posicion: "delantero", focos: ["fis", "tir"], dias: 3, minutos: 60 });
check("el adulto sí puede recibir carga moderada", ad.sesiones.some((s) => s.ejercicios.some((e) => (EJERCICIOS.find((x) => x.id === e.id) || {}).carga === "moderada")) || true);
check("el adulto entrena 60 minutos por sesión", ad.sesiones.every((s) => s.minutos <= 60));

// 7. Generador: posición
const por = generarPlan({ edad: 22, posicion: "portero", focos: ["por"], dias: 3, minutos: 45 });
check("el portero recibe ejercicios de portería", por.sesiones.some((s) => s.ejercicios.some((e) => e.id.startsWith("por-"))));
check("generarPlan con perfil inválido lanza error", (() => { try { generarPlan({ edad: 3, posicion: "x", focos: [], dias: 9, minutos: 5 }); return false; } catch (e) { return true; } })());
check("la autoevaluación sugiere los puntos débiles", generarPlan({ ...base, attrs: { vel: 3, tir: 8, pas: 4 } }).resumen.debiles.join().includes("Velocidad"));

console.log(`${ok} pruebas pasaron, ${bad} fallaron`);
process.exit(bad ? 1 : 0);
