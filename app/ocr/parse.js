// Interpreta el TEXTO de un acta (escrito a mano en el formulario o leído por OCR) y propone un borrador.
// Es una ayuda, no una autoridad: el resultado siempre pasa por la revisión y confirmación de una persona.
//
// Formato que entiende (una cosa por línea; mayúsculas, acentos y signos no importan):
//   Marcador: 2 - 1                  (también «Resultado» o «Final»; o una línea «Rayos 2 - 1 Lobos»)
//   Gol: Pepe Pérez (Rayos)          (o «Gol: Pepe x2», «Gol - Pepe 2 goles»)
//   Autogol: Luis (Lobos)
//   Amarilla: Tito - Lobos
//   Roja: Beto
//   Rayos:                           (una línea con solo el nombre de un equipo fija el equipo de las líneas siguientes)

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const KINDS = [[/\bautogol(es)?\b/, "own_goal"], [/\b(amarilla|amonestacion|amonestado)\b/, "yellow"], [/\b(roja|expulsion|expulsado)\b/, "red"], [/\bgol(es)?\b/, "goal"]];

export function parseActa(text, home, away) {
  const out = { hg: null, ag: null, events: [], note: "", warnings: [] };
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200);
  const nh = norm(home.name), na = norm(away.name);
  const teamIn = (n) => (nh && n.includes(nh) ? home : na && n.includes(na) ? away : null);
  let section = null;

  for (const raw of lines) {
    const n = norm(raw);
    // 1) marcador
    if (out.hg === null) {
      const hasWord = /\b(marcador|resultado|final)\b/.test(n);
      const m = raw.match(hasWord ? /(?<!\d)(\d{1,2})\s*(?:-|–|—|:|x|a)\s*(\d{1,2})(?!\d)/i : /(?<!\d)(\d{1,2})\s*(?:-|–|—|x)\s*(\d{1,2})(?!\d)/i);
      if (m && (hasWord || (nh && na && n.includes(nh) && n.includes(na)))) {
        const a = +m[1], b = +m[2];
        if (a <= 99 && b <= 99) {
          // «Lobos 1 - 2 Rayos»: si el visitante aparece primero, se invierte
          const pi = nh ? n.indexOf(nh) : -1, pj = na ? n.indexOf(na) : -1;
          if (pi >= 0 && pj >= 0 && pj < pi) { out.hg = b; out.ag = a; out.warnings.push("El visitante aparece primero en la línea del marcador; se acomodó por equipo. Revísalo."); } else { out.hg = a; out.ag = b; }
          continue;
        }
      }
    }
    // 2) línea que solo nombra a un equipo = sección
    const bare = n.replace(/\b(equipo|local|visitante)\b/g, "").trim();
    if (bare === nh || bare === na) { section = bare === nh ? home : away; continue; }
    // 3) evento
    const kind = (KINDS.find(([re]) => re.test(n)) || [])[1];
    if (!kind) continue;
    let rest = raw.replace(/^[^:\-–—]*?(autogol(es)?|gol(es)?|amarilla|amonestaci[oó]n|roja|expulsi[oó]n)[^:\-–—]*[:\-–—]?\s*/i, "");
    if (rest === raw) rest = raw.replace(/^\s*(tarjeta\s+)?\w+\s*/i, "");
    let count = 1;
    const cm = rest.match(/(?:\bx\s*|\(\s*)(\d)\s*\)?\s*$/i) || rest.match(/\b(\d)\s+goles?\b/i);
    if (cm) { count = Math.min(9, +cm[1] || 1); rest = rest.replace(cm[0], " "); }
    let team = null;
    const pm = rest.match(/\(([^)]+)\)/) || rest.match(/[-–—]\s*([^-–—]+)$/);
    if (pm && teamIn(norm(pm[1]))) { team = teamIn(norm(pm[1])); rest = rest.replace(pm[0], " "); }
    else if (teamIn(norm(rest)) && norm(rest) !== norm(rest).replace(nh, "").replace(na, "")) {
      team = teamIn(norm(rest)); rest = rest.replace(new RegExp(team.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
    }
    const player = rest.replace(/^[#\s\d.]+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/, "").replace(/[()\-–—:;,]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (player.length < 2) { out.warnings.push(`Línea sin nombre de jugador: «${raw.slice(0, 40)}»`); continue; }
    if (!team) {
      team = section;
      if (!team) { team = home; out.warnings.push(`No se supo de qué equipo es ${player}; se puso ${home.name}. Revísalo.`); }
    }
    const rows = kind === "goal" || kind === "own_goal" ? count : 1;
    for (let i = 0; i < rows && out.events.length < 100; i++) out.events.push({ team: team.id, player, kind });
  }

  if (out.hg === null) out.warnings.push("No se encontró el marcador: escríbelo a mano.");
  else {
    const g = { [home.id]: 0, [away.id]: 0 };
    out.events.forEach((e) => { if (e.kind === "goal") g[e.team]++; else if (e.kind === "own_goal") g[e.team === home.id ? away.id : home.id]++; });
    if (g[home.id] > out.hg || g[away.id] > out.ag) out.warnings.push("Los goles de los jugadores superan el marcador. Corrige uno de los dos.");
  }
  return out;
}
