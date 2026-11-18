// Baloncho, la mascota de FutSfera: estado, textos, imágenes y celebraciones.
import { DEFAULT_NAME, NAME_SUGGESTIONS, VIBES, ASPECTOS, TAMS, CHAT_PX, PANEL_PX, CELEB_PX, key, normalize, load, save, img, imgFile, sizePx, saludo, chatHello, celebrateLine, chipHTML, celebrationHTML, avatarHTML } from "../../app/mascota.js";
import { render } from "../../app/views/inicio.js";
let ok = 0, bad = 0;
const check = (n, c, i) => { if (c) ok++; else { bad++; console.log("  FALLA", n, i ?? ""); } };

// ---------- Estado por defecto y validación ----------
check("nombre por defecto es Baloncho", normalize({}).name === "Baloncho" && DEFAULT_NAME === "Baloncho");
check("sin nada, todo por defecto", JSON.stringify(normalize({})) === JSON.stringify({ name: "Baloncho", vibe: "alegre", aspecto: "avatar", tam: "normal" }));
check("el nombre se recorta y se limita a 20", normalize({ name: "  Bola  " }).name === "Bola" && normalize({ name: "a".repeat(30) }).name.length === 20);
check("nombre vacío vuelve al de por defecto", normalize({ name: "   " }).name === "Baloncho");
check("vibe inválida cae a alegre", normalize({ vibe: "furioso" }).vibe === "alegre");
check("aspecto inválido cae a avatar", normalize({ aspecto: "invisible" }).aspecto === "avatar");
check("tamaño inválido cae a normal", normalize({ tam: "gigante" }).tam === "normal");
check("hay 4 personalidades", Object.keys(VIBES).length === 4 && ["alegre", "tranquilo", "motivador", "bromista"].every((k) => VIBES[k]));
check("hay 2 sugerencias de nombre: el de por defecto + 1", NAME_SUGGESTIONS.length === 2 && NAME_SUGGESTIONS[0] === "Baloncho");
check("hay 6 aspectos", ASPECTOS.length === 6 && ASPECTOS.map((a) => a.id).join(",") === "avatar,feliz,celebrando,pensando,animando,corriendo");
check("cada aspecto tiene su imagen en data URI (sin archivos ni URLs externas)", ASPECTOS.every((a) => typeof a.img === "string" && a.img.startsWith("data:image/jpeg;base64,") && a.img.length > 10000));
check("la escala es la de la ESPEC: chat 32, encabezado 32/40/56, panel 96, celebración 120",
  CHAT_PX === 32 && PANEL_PX === 96 && CELEB_PX === 120 && TAMS.compacto.px === 32 && TAMS.normal.px === 40 && TAMS.grande.px === 56);
check("la clave es por liga", key("liga-reforma") === "futsfera:mascota:liga-reforma" && key() === "futsfera:mascota:app");

// ---------- Guardar y cargar (por liga) ----------
save("liga-a", { name: "Bola", vibe: "bromista", aspecto: "feliz", tam: "grande" });
check("guardar y cargar redondo", JSON.stringify(load("liga-a")) === JSON.stringify({ name: "Bola", vibe: "bromista", aspecto: "feliz", tam: "grande" }));
check("otra liga no hereda el nombre", load("liga-b").name === "Baloncho");
check("img() devuelve el data URI del aspecto", img({ name: "B", vibe: "alegre", aspecto: "pensando", tam: "normal" }) === ASPECTOS.find((a) => a.id === "pensando").img);
check("imgFile() cae al avatar si el aspecto no existe", imgFile("nope") === ASPECTOS[0].img);
check("sizePx respeta el tamaño", sizePx({ tam: "compacto" }) === 32 && sizePx({ tam: "grande" }) === 56);

// ---------- Textos con el nombre elegido ----------
const st = { name: "Bola", vibe: "bromista", aspecto: "avatar", tam: "normal" };
check("el saludo usa el nombre elegido", saludo(st).includes("Bola") && !saludo(st).includes("Baloncho"));
check("el saludo del chat usa el nombre elegido", chatHello(st).includes("Bola"));
check("cada vibe tiene su saludo distinto", new Set(Object.keys(VIBES).map((k) => saludo({ ...st, vibe: k }))).size === 4);
check("la línea de campeón usa el nombre", celebrateLine(st, "campeon").includes("Bola") && celebrateLine(st, "campeon").includes("campeón"));
check("la línea de victoria usa el nombre", celebrateLine(st, "victoria").includes("Bola") && celebrateLine(st, "victoria").includes("Victoria"));

// ---------- Piezas visuales ----------
const chip = chipHTML(st, "liga-a");
check("el chip es un botón que abre el panel, en círculo y con el nombre", chip.includes('data-mascota="panel"') && chip.includes("mascota-av") && chip.includes(">Bola<") && chip.includes('data-scope="liga-a"'));
check("el avatar es cuerpo entero en círculo", avatarHTML(st, 40).includes("mascota-av") && avatarHTML(st, 40).includes('width="40"') === false && avatarHTML(st, 40).includes("width:40px"));
const cel = celebrationHTML(st, "campeon");
check("la celebración baila y dice campeón", cel.includes("bailando") && cel.includes("campeón") && cel.includes("width:120px"));

// ---------- Victoria en Inicio: Baloncho celebra; sin victoria, no ----------
const ctx = (score) => ({
  clubId: "diablos", key: "app:diablos/domingos", club: { name: "Club Diablos" },
  team: { id: "domingos", name: "Domingos", finance: null, roster: [], matches: score ? [{ id: "m1", jornada: "J1", rival: "Lobos", home: true, date: "2026-11-01T10:00:00Z", status: "played", score }] : [] },
  playersById: {}, ratings: {},
});
const hWin = render(ctx({ for: 3, against: 1 }));
check("tras una victoria, Inicio muestra a Baloncho bailando", hWin.includes("mascota-celeb") && hWin.includes("bailando") && hWin.includes("¡Victoria!"));
const hLoss = render(ctx({ for: 0, against: 2 }));
check("tras una derrota no hay celebración", !hLoss.includes("mascota-celeb"));
const hNone = render(ctx(null));
check("sin último partido no hay celebración", !hNone.includes("mascota-celeb"));

console.log(`${ok} pruebas pasaron, ${bad} fallaron`); process.exit(bad ? 1 : 0);
