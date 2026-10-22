// Arranque y navegación. Rutas: #/<club>/<equipo>/<vista>
import { esc, icon, store } from "./util.js";
import { loadClubs, loadClub, loadTeam, assetURL } from "./data.js";
import { applyTheme } from "./theme.js";
import * as cuentas from "./views/cuentas.js";
import * as plantel from "./views/plantel.js";
import * as alineacion from "./views/alineacion.js";

const VIEWS = { cuentas: { m: cuentas, label: "Cuentas" }, plantel: { m: plantel, label: "Plantel" }, alineacion: { m: alineacion, label: "Alineación" } };
const app = document.getElementById("app");
const cache = {};
let installEvt = null;

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; const b = document.getElementById("install-go"); if (b) b.hidden = false; });

function parse() {
  const [club, team, view] = location.hash.replace(/^#\/?/, "").split("/");
  return { club, team, view: VIEWS[view] ? view : "cuentas" };
}

function installHint() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone || store("install:closed")) return "";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const txt = ios ? "Instálala en tu iPhone: toca Compartir y luego «Agregar a inicio»." : "Instálala en tu celular para abrirla como app.";
  return `<div class="install"><span>${txt}</span>${ios ? "" : `<button type="button" class="btn" id="install-go"${installEvt ? "" : " hidden"}>Instalar</button>`}<button type="button" class="x sm" id="install-x" aria-label="Cerrar aviso">${icon.close}</button></div>`;
}

async function getCtx(clubId, teamId) {
  const k = clubId + "/" + teamId;
  if (!cache[k]) {
    const [{ club, players }, team] = await Promise.all([loadClub(clubId), loadTeam(clubId, teamId)]);
    cache[k] = {
      club, team, players,
      playersById: Object.fromEntries(players.map((p) => [p.id, p])),
      crest: assetURL(clubId, club.crest),
      watermark: assetURL(clubId, club.watermark || club.crest),
      asset: (f) => (/^(https?:|data:)/.test(f) ? f : assetURL(clubId, f)),
      key: "app:" + k,
    };
  }
  return cache[k];
}

async function route() {
  let { club, team, view } = parse();
  try {
    if (!club || !team) {
      const clubs = await loadClubs();
      const c = clubs.find((x) => x.id === club) || clubs[0];
      location.replace(`#/${c.id}/${team || c.teams[0]}/${view}`);
      return;
    }
    const ctx = await getCtx(club, team);
    applyTheme(ctx.club, ctx.crest);
    const V = VIEWS[view].m;
    const teams = (ctx.club.teams || [team]).map((t) => (typeof t === "string" ? { id: t, name: t } : t));
    app.innerHTML = `<header class="top">
        <img class="top-cr" src="${esc(ctx.crest)}" alt="Escudo de ${esc(ctx.club.name)}">
        <div class="top-t"><h1>${esc(ctx.club.name)}</h1>
        ${teams.length > 1
          ? `<select class="team-sel" aria-label="Equipo">${teams.map((t) => `<option value="${esc(t.id)}"${t.id === team ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>`
          : `<p>${esc(ctx.team.name)} · ${esc(ctx.team.competition || "")}</p>`}</div>
      </header>
      ${view === "cuentas" && ctx.team.next ? `<div class="match"><span class="tag">Próximo partido</span><div class="what">${esc(ctx.team.next)}</div></div>` : ""}
      ${view === "cuentas" ? installHint() : ""}
      <div id="view" class="view">${V.render(ctx)}</div>
      <nav class="tabbar" aria-label="Secciones">${Object.entries(VIEWS).map(([k, v]) => `<a href="#/${club}/${team}/${k}"${k === view ? ' aria-current="page"' : ""}>${icon[k]}<span>${v.label}</span></a>`).join("")}</nav>`;
    V.bind(document.getElementById("view"), ctx);
    const sel = app.querySelector(".team-sel");
    if (sel) sel.onchange = () => { location.hash = `#/${club}/${sel.value}/${view}`; };
    const ix = document.getElementById("install-x");
    if (ix) ix.onclick = () => { store("install:closed", 1); ix.parentElement.remove(); };
    const ig = document.getElementById("install-go");
    if (ig) ig.onclick = async () => { if (installEvt) { installEvt.prompt(); installEvt = null; ig.parentElement.remove(); } };
    window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = `<div class="error"><h1>No se pudo abrir</h1><p>Revisa tu conexión a internet y vuelve a abrir la app.</p><button type="button" class="btn" onclick="location.reload()">Intentar de nuevo</button></div>`;
    console.error(err);
  }
}

window.addEventListener("hashchange", () => { document.getElementById("sheet").hidden = true; route(); });
route();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
