// Planes de entrenamiento del jugador.
//
// Todo por reglas locales, sin modelo de lenguaje ni servicio externo: una
// biblioteca de ejercicios en el código y un generador que arma un plan
// semanal según la edad, la posición y lo que el jugador quiere mejorar.
// La edad manda en el volumen y la carga: los menores entrenan moderado y
// sin cargas pesadas; los adultos progresan con carga moderada.
//
// Atributos: los mismos seis de rating.js (vel, tir, pas, reg, def, fis) más
// cuatro focos que no se votan entre compañeros (res, agi, aer, por).
// Posiciones: las cuatro líneas del campo; los roles son los códigos de
// app/views/alineacion.js (POR, DFC, LAT, MCD, MC, MCO, MI, MD, EXT, DC).

export const ATTR_KEYS = ["vel", "tir", "pas", "reg", "def", "fis"];
export const ATTR_LABELS = { vel: "Velocidad", tir: "Tiro", pas: "Pase", reg: "Regate", def: "Defensa", fis: "Físico" };
export const EXTRA_FOCUS = { res: "Resistencia", agi: "Agilidad", aer: "Juego aéreo", por: "Portería" };
export const FOCUS_LABELS = { ...ATTR_LABELS, ...EXTRA_FOCUS };
export const FOCUS_KEYS = [...ATTR_KEYS, "res", "agi", "aer", "por"];

export const POSICIONES = {
  portero: { linea: "Portero", roles: ["POR"], focos: ["por", "agi", "fis"], desc: "Reflejos, juego de pies y salidas." },
  defensa: { linea: "Defensa", roles: ["DFC", "LAT"], focos: ["def", "aer", "fis", "vel"], desc: "Anticipación, marcaje y juego aéreo." },
  mediocampo: { linea: "Mediocampo", roles: ["MCD", "MC", "MCO", "MI", "MD"], focos: ["pas", "res", "reg", "fis"], desc: "Pase, control y resistencia." },
  delantero: { linea: "Delantero", roles: ["DC", "EXT"], focos: ["tir", "vel", "reg", "aer"], desc: "Finalización, desmarque y velocidad." },
};
export const POSICION_KEYS = Object.keys(POSICIONES);

export const ROL_LABELS = { POR: "Portero", DFC: "Defensa central", LAT: "Lateral", MCD: "Mediocentro defensivo", MC: "Mediocentro", MCO: "Mediocentro ofensivo", MI: "Medio izquierdo", MD: "Medio derecho", EXT: "Extremo", DC: "Delantero centro" };
export const ROLES_POR_FORMATO = { 7: ["POR", "DFC", "LAT", "MC", "MI", "MD", "DC"], 11: ["POR", "DFC", "LAT", "MCD", "MC", "MCO", "EXT", "DC"] };
export const ROL_KEYS = Object.keys(ROL_LABELS);

export function lineaDeRol(rol) {
  if (!rol) return null;
  for (const [k, v] of Object.entries(POSICIONES)) if (v.roles.includes(rol)) return k;
  return null;
}

// Bandas de edad. La carga es lo que puede llevar el plan: "ninguna" (solo
// peso del cuerpo sin esfuerzo de fuerza), "corporal" (fuerza con el propio
// cuerpo) y "moderada" (carga externa ligera, solo adultos).
export const BANDAS = [
  { id: "infantil", min: 6, max: 11, nombre: "Infantil (6–11 años)", maxMin: 30, cargas: ["ninguna"], nota: "Sesiones cortas y con juego: técnica y coordinación, sin cargas ni trabajo de fuerza." },
  { id: "juvenil", min: 12, max: 17, nombre: "Juvenil (12–17 años)", maxMin: 45, cargas: ["ninguna", "corporal"], nota: "Volumen moderado y fuerza solo con el propio cuerpo, sin cargas pesadas." },
  { id: "adulto", min: 18, max: 34, nombre: "Adulto (18–34 años)", maxMin: 60, cargas: ["ninguna", "corporal", "moderada"], nota: "Sesiones completas con progresión: cada semana se sube una serie o un poco de intensidad." },
  { id: "veterano", min: 35, max: 99, nombre: "Veterano (35 años o más)", maxMin: 45, cargas: ["ninguna", "corporal"], nota: "Volumen moderado, más movilidad y recuperación entre sesiones." },
];

export function bandaDeEdad(edad) {
  const e = Number(edad);
  if (!Number.isFinite(e)) return null;
  return BANDAS.find((b) => e >= b.min && e <= b.max) || null;
}

export function edadDe(birth, hoy = new Date()) {
  if (!birth) return null;
  const d = new Date(birth), n = new Date(hoy);
  if (isNaN(d.getTime())) return null;
  let a = n.getFullYear() - d.getFullYear();
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

// Biblioteca de ejercicios. tipo: "cal" (calentamiento), "tec" (técnica),
// "fis" (físico) o "calma" (vuelta a la calma). carga: "ninguna" | "corporal" | "moderada".
// lineas: a qué líneas va dirigido ("todas" = a cualquiera).
export const EJERCICIOS = [
  // Calentamiento
  { id: "cal-trote", nombre: "Trote suave", desc: "Trote ligero alrededor de la cancha para subir la temperatura.", tipo: "cal", focos: ["res"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "5 minutos" },
  { id: "cal-movilidad", nombre: "Movilidad articular", desc: "Círculos de tobillos, rodillas, cadera y hombros.", tipo: "cal", focos: ["agi"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "5 minutos" },
  { id: "cal-skipping", nombre: "Skipping en el sitio", desc: "Rodillas arriba en el sitio, ritmo suave y luego más vivo.", tipo: "cal", focos: ["vel", "agi"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 × 30 segundos" },
  { id: "cal-toques", nombre: "Toques con el balón", desc: "Toques suaves con las dos piernas, sin dejar caer el balón.", tipo: "cal", focos: ["pas"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "5 minutos" },
  { id: "cal-juego", nombre: "Juego de persecución con balón", desc: "Perseguir al compañero con el balón controlado: juego, no carrera.", tipo: "cal", focos: ["vel", "agi"], lineas: ["todas"], bandas: ["infantil", "juvenil"], carga: "ninguna", detalle: "5 minutos" },
  // Velocidad y agilidad
  { id: "vel-sprints", nombre: "Sprints de 20 m", desc: "Arrancadas cortas a máxima velocidad con pausa completa entre cada una.", tipo: "fis", focos: ["vel"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "6 × 20 m" },
  { id: "vel-escalera", nombre: "Escalera de agilidad", desc: "Pasadas rápidas por la escalera: un pie, dos pies y laterales.", tipo: "fis", focos: ["vel", "agi"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "corporal", detalle: "4 pasadas" },
  { id: "vel-conos", nombre: "Cambios de dirección con conos", desc: "Zigzag entre conos con frenada y arranque.", tipo: "fis", focos: ["vel", "agi"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "5 repeticiones" },
  { id: "agi-reaccion", nombre: "Reacción a señal", desc: "Arrancar en la dirección que marca el compañero al soltar el balón.", tipo: "tec", focos: ["agi"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "8 repeticiones" },
  // Tiro
  { id: "tir-finalizacion", nombre: "Finalización a puerta", desc: "Recibir, controlar y tirar a puerta desde la frontal.", tipo: "tec", focos: ["tir"], lineas: ["delantero", "mediocampo"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 8 tiros" },
  { id: "tir-volea", nombre: "Voleas y tiros de primera", desc: "Balones colgados desde el lado: tiro de primera sin controlar.", tipo: "tec", focos: ["tir", "aer"], lineas: ["delantero", "mediocampo"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 6 tiros" },
  { id: "tir-conduccion", nombre: "Tiro con potencia tras conducción", desc: "Conducir 10 m y tirar con fuerza al palo lejano.", tipo: "tec", focos: ["tir", "vel"], lineas: ["delantero"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 6 tiros" },
  // Pase
  { id: "pas-triangulo", nombre: "Pases en triángulo", desc: "Tres jugadores, pase a un toque y moverse al hueco.", tipo: "tec", focos: ["pas"], lineas: ["mediocampo", "defensa"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 × 3 minutos" },
  { id: "pas-control", nombre: "Control orientado y pase", desc: "Recibir de espaldas, girar con el control y pasar al compañero.", tipo: "tec", focos: ["pas", "reg"], lineas: ["mediocampo", "delantero"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 10" },
  { id: "pas-largo", nombre: "Cambios de juego largos", desc: "Pases largos de banda a banda, con la pierna menos hábil también.", tipo: "tec", focos: ["pas"], lineas: ["mediocampo", "defensa"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 8" },
  { id: "pas-rondo", nombre: "Rondo con presión", desc: "Círculo de pases con uno o dos presionando en el centro.", tipo: "tec", focos: ["pas", "res"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 × 3 minutos" },
  // Regate
  { id: "reg-conos", nombre: "Regate entre conos", desc: "Conducir entre conos con cambios de pie y de ritmo.", tipo: "tec", focos: ["reg", "agi"], lineas: ["delantero", "mediocampo"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "4 pasadas" },
  { id: "reg-1v1", nombre: "Uno contra uno ofensivo", desc: "Recibir de cara y superar al defensor: finta, cambio de ritmo y salida.", tipo: "tec", focos: ["reg", "vel"], lineas: ["delantero", "mediocampo"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "8 repeticiones" },
  { id: "reg-fintas", nombre: "Fintas y cambios de ritmo", desc: "Practicar dos fintas (bicicleta, amago) y salir con velocidad.", tipo: "tec", focos: ["reg"], lineas: ["delantero", "mediocampo"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 6" },
  // Defensa
  { id: "def-1v1", nombre: "Uno contra uno defensivo", desc: "Perfil corporal, paciencia y entrada solo cuando el balón se aleja.", tipo: "tec", focos: ["def"], lineas: ["defensa"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "8 repeticiones" },
  { id: "def-anticipacion", nombre: "Anticipación e intercepción", desc: "Leer el pase y cortar por delante del atacante.", tipo: "tec", focos: ["def", "vel"], lineas: ["defensa", "mediocampo"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 8" },
  { id: "def-marcaje", nombre: "Marcaje y perfil corporal", desc: "Seguir al atacante de lado, sin perderlo de vista ni el balón.", tipo: "tec", focos: ["def"], lineas: ["defensa"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 × 2 minutos" },
  { id: "def-salida", nombre: "Salida de balón desde atrás", desc: "Recibir del portero y sacar el balón jugado, no despejarlo.", tipo: "tec", focos: ["def", "pas"], lineas: ["defensa"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 8" },
  // Físico
  { id: "fis-sentadillas", nombre: "Sentadillas con peso corporal", desc: "Sentadilla completa, espalda recta y rodillas siguiendo los pies.", tipo: "fis", focos: ["fis"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "3 series de 12" },
  { id: "fis-planchas", nombre: "Planchas y core", desc: "Plancha frontal y laterales para el tronco.", tipo: "fis", focos: ["fis"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "3 × 30 segundos" },
  { id: "fis-saltos", nombre: "Saltos y pliometría suave", desc: "Saltos con las dos piernas y caída suave, sin cargar peso.", tipo: "fis", focos: ["fis", "aer"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "3 series de 8" },
  { id: "fis-carga", nombre: "Sentadilla con carga moderada", desc: "Sentadilla con peso moderado (nunca al fallo): técnica antes que kilos.", tipo: "fis", focos: ["fis"], lineas: ["todas"], bandas: ["adulto"], carga: "moderada", detalle: "4 series de 8" },
  { id: "fis-zancadas", nombre: "Zancadas con peso corporal", desc: "Zancada larga alternando piernas, tronco recto.", tipo: "fis", focos: ["fis"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "3 series de 10 por pierna" },
  // Resistencia
  { id: "res-intervalos", nombre: "Intervalos de carrera", desc: "30 segundos fuerte y 30 suave, sin parar.", tipo: "fis", focos: ["res"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "8 repeticiones" },
  { id: "res-trote", nombre: "Trote continuo", desc: "Trote suave y constante, ritmo para poder hablar.", tipo: "fis", focos: ["res"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "15 minutos" },
  { id: "res-partidillo", nombre: "Partidillo corto", desc: "Juego reducido 3 contra 3 con intensidad alta y pausas cortas.", tipo: "fis", focos: ["res", "pas"], lineas: ["todas"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 × 4 minutos" },
  // Juego aéreo
  { id: "aer-cabezazos", nombre: "Cabezazos a puerta", desc: "Centros desde la banda y cabeceo a puerta, con salto.", tipo: "tec", focos: ["aer", "tir"], lineas: ["delantero", "defensa"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 6" },
  { id: "aer-salto", nombre: "Salto y cabeceo", desc: "Salto con impulso y cabeceo al balón colgado, caída equilibrada.", tipo: "fis", focos: ["aer", "fis"], lineas: ["defensa", "delantero"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "3 series de 8" },
  { id: "aer-despeje", nombre: "Despejes de cabeza", desc: "Despejar de cabeza hacia las bandas, no al centro.", tipo: "tec", focos: ["aer", "def"], lineas: ["defensa"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 8" },
  // Portería
  { id: "por-reflejos", nombre: "Reflejos con balón", desc: "Tiros cortos y rápidos desde cerca: reaccionar con las manos.", tipo: "tec", focos: ["por", "agi"], lineas: ["portero"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 10" },
  { id: "por-salidas", nombre: "Salidas y achiques", desc: "Salir a achicar al delantero que encara solo.", tipo: "tec", focos: ["por"], lineas: ["portero"], bandas: ["juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "8 repeticiones" },
  { id: "por-pies", nombre: "Juego de pies del portero", desc: "Recibir con los pies, controlar y pasar con calma bajo presión.", tipo: "tec", focos: ["por", "pas"], lineas: ["portero"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "3 series de 8" },
  { id: "por-caidas", nombre: "Estiradas y caídas", desc: "Estirada a los dos palos con caída controlada y levantada rápida.", tipo: "tec", focos: ["por", "agi"], lineas: ["portero"], bandas: ["juvenil", "adulto", "veterano"], carga: "corporal", detalle: "3 series de 6 por lado" },
  // Vuelta a la calma
  { id: "calma-estiramientos", nombre: "Estiramientos", desc: "Estirar cuádriceps, isquiotibiales, gemelos y espalda, 30 segundos cada uno.", tipo: "calma", focos: ["res"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "5 minutos" },
  { id: "calma-respiracion", nombre: "Respiración y vuelta a la calma", desc: "Caminar suave y respirar hondo para bajar las pulsaciones.", tipo: "calma", focos: ["res"], lineas: ["todas"], bandas: ["infantil", "juvenil", "adulto", "veterano"], carga: "ninguna", detalle: "5 minutos" },
];

export const DIAS_SUGERIDOS = {
  1: ["Sábado"],
  2: ["Martes", "Jueves"],
  3: ["Lunes", "Miércoles", "Viernes"],
  4: ["Lunes", "Martes", "Jueves", "Sábado"],
  5: ["Lunes", "Martes", "Miércoles", "Viernes", "Sábado"],
};

// Perfil que guarda el jugador: edad, posición, rol, formato, focos de mejora,
// días por semana y minutos por sesión; attrs es su autoevaluación (1–10, opcional).
export function validarPerfil(p) {
  const e = [];
  if (!p || typeof p !== "object") return ["Faltan los datos del perfil."];
  const edad = Number(p.edad);
  if (!Number.isInteger(edad) || edad < 6 || edad > 99) e.push("La edad debe estar entre 6 y 99 años.");
  if (!POSICION_KEYS.includes(p.posicion)) e.push("Elige una posición: portero, defensa, mediocampo o delantero.");
  if (p.rol != null && p.rol !== "" && !ROL_KEYS.includes(p.rol)) e.push("El rol no es válido.");
  if (p.rol && lineaDeRol(p.rol) && lineaDeRol(p.rol) !== p.posicion) e.push("El rol no corresponde a la posición elegida.");
  if (p.formato != null && p.formato !== "" && ![7, 11].includes(Number(p.formato))) e.push("El formato es fútbol 7 o fútbol 11.");
  if (!Array.isArray(p.focos) || p.focos.length < 1 || p.focos.length > 3) e.push("Elige de 1 a 3 cosas para mejorar.");
  else if (p.focos.some((f) => !FOCUS_KEYS.includes(f)) || new Set(p.focos).size !== p.focos.length) e.push("Las cosas para mejorar no son válidas o se repiten.");
  const dias = Number(p.dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 5) e.push("Los días por semana son de 1 a 5.");
  const min = Number(p.minutos);
  if (!Number.isInteger(min) || min < 20 || min > 90) e.push("Los minutos por sesión son de 20 a 90.");
  if (p.attrs != null && typeof p.attrs === "object") {
    for (const [k, v] of Object.entries(p.attrs)) {
      if (!ATTR_KEYS.includes(k) || v == null || v === "") continue;
      if (!Number.isFinite(Number(v)) || Number(v) < 1 || Number(v) > 10) e.push("La autoevaluación es de 1 a 10.");
    }
  }
  return e;
}

export function normalizarPerfil(p) {
  const edad = Number(p.edad);
  const banda = bandaDeEdad(edad) || BANDAS[2];
  const posicion = POSICION_KEYS.includes(p.posicion) ? p.posicion : "mediocampo";
  const focos = Array.isArray(p.focos) ? [...new Set(p.focos.filter((f) => FOCUS_KEYS.includes(f)))].slice(0, 3) : [];
  const dias = Math.min(5, Math.max(1, Number(p.dias) || 3));
  const minutos = Math.min(banda.maxMin, Math.max(20, Number(p.minutos) || banda.maxMin));
  const rol = p.rol && ROL_KEYS.includes(p.rol) && lineaDeRol(p.rol) === posicion ? p.rol : null;
  const formato = [7, 11].includes(Number(p.formato)) ? Number(p.formato) : null;
  const attrs = {};
  if (p.attrs && typeof p.attrs === "object") for (const k of ATTR_KEYS) { const v = Number(p.attrs[k]); if (Number.isFinite(v) && v >= 1 && v <= 10) attrs[k] = v; }
  return { edad, posicion, rol, formato, focos: focos.length ? focos : POSICIONES[posicion].focos.slice(0, 2), dias, minutos, attrs: Object.keys(attrs).length ? attrs : null };
}

// Huella del perfil: cambia cuando cambia cualquier dato que afecta al plan.
export function hashPerfil(p) {
  const s = JSON.stringify(normalizarPerfil(p));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

const redondea5 = (n) => Math.max(5, Math.round(n / 5) * 5);

// Generador determinista: mismo perfil y misma variante dan el mismo plan;
// cambiar los focos, los días o la variante cambia los ejercicios.
// variante: 0, 1, 2… — "generar otro plan" rota la selección.
export function generarPlan(perfil, variante = 0) {
  const err = validarPerfil(perfil);
  if (err.length) throw new Error(err[0]);
  const p = normalizarPerfil(perfil);
  const banda = bandaDeEdad(p.edad);
  const okBanda = (e) => e.bandas.includes(banda.id) && banda.cargas.includes(e.carga);
  const esLinea = (e) => e.lineas.includes("todas") || e.lineas.includes(p.posicion);
  const cal = EJERCICIOS.filter((e) => e.tipo === "cal" && okBanda(e));
  const calma = EJERCICIOS.filter((e) => e.tipo === "calma" && okBanda(e));
  const prin = EJERCICIOS.filter((e) => (e.tipo === "tec" || e.tipo === "fis") && okBanda(e) && esLinea(e));
  const porFoco = (f) => prin.filter((e) => e.focos.includes(f));
  const nPrin = p.minutos >= 45 ? 3 : 2;
  const sesiones = [];
  for (let i = 0; i < p.dias; i++) {
    const dia = (DIAS_SUGERIDOS[p.dias] || DIAS_SUGERIDOS[3])[i];
    const focoDia = p.focos[i % p.focos.length];
    const lista = [];
    const toma = (arr, k) => arr.length ? arr[(i + variante + k) % arr.length] : null;
    const c = toma(cal, 0); if (c) lista.push({ ...c, min: redondea5(p.minutos * 0.2) });
    const f1 = toma(porFoco(focoDia), 0); if (f1) lista.push({ ...f1, min: redondea5((p.minutos * 0.6) / nPrin) });
    const f2 = toma(porFoco(p.focos[(i + 1) % p.focos.length]), 1); if (f2 && f2.id !== (f1 && f1.id)) lista.push({ ...f2, min: redondea5((p.minutos * 0.6) / nPrin) });
    if (nPrin === 3) { const f3 = toma(prin, i + 2); if (f3 && !lista.some((x) => x.id === f3.id)) lista.push({ ...f3, min: redondea5((p.minutos * 0.6) / nPrin) }); }
    const cm = toma(calma, i); if (cm) lista.push({ ...cm, min: Math.max(5, p.minutos - lista.reduce((s, x) => s + x.min, 0)) });
    const minutos = lista.reduce((s, x) => s + x.min, 0);
    sesiones.push({ dia, titulo: `Sesión ${i + 1} · ${dia} — ${p.focos.map((f) => FOCUS_LABELS[f]).join(" y ")}`, minutos, ejercicios: lista.map(({ id, nombre, desc, detalle, min }) => ({ id, nombre, desc, detalle, min })) });
  }
  const debiles = p.attrs ? Object.entries(p.attrs).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => ATTR_LABELS[k]) : [];
  return {
    version: 1, banda: banda.id, edad: p.edad, posicion: p.posicion, rol: p.rol, formato: p.formato,
    focos: p.focos, dias: p.dias, minutos: p.minutos, variante,
    sesiones,
    resumen: {
      minutosSemana: sesiones.reduce((s, x) => s + x.minutos, 0),
      nota: banda.nota,
      debiles,
      sugerencia: debiles.length ? `Según tu autoevaluación, lo más débil es ${debiles.join(" y ")}: si quieres, márcalo en "qué quieres mejorar".` : null,
    },
  };
}
