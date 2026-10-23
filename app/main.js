// Arranque y navegación. Rutas: #/<club>/<equipo>/<vista>
import { esc, icon, store } from "./util.js";
import { loadClubs, loadClub, loadTeam, assetURL } from "./data.js";
import { applyTheme } from "./theme.js";
import { computeRatings } from "./rating.js";
import * as inicio from "./views/inicio.js";
import * as partidos from "./views/partidos.js";
import * as plantel from "./views/plantel.js";
import * as alineacion from "./views/alineacion.js";
import * as finanzas from "./views/cuentas.js";
import { enrich } from "./live.js";
import { mount, wireSheet } from "./cloudui.js";
import { restoreRoute, on } from "./cloud.js";
import { renderPlatform } from "./platform.js";

// Orden de la barra inferior. Finanzas va al final: lo primero es el juego.
const VIEWS = {
  inicio: { m: inicio, label: "Inicio" },
  partidos: { m: partidos, label: "Partidos" },
  plantel: { m: plantel, label: "Plantel" },
  alineacion: { m: alineacion, label: "Alineación" },
  finanzas: { m: finanzas, label: "Finanzas", needs: "finance" },
};
const ABS = /^(https?:|data:)/;
const GENERIC = new URL("../icons/escudo-generico.svg", import.meta.url).href;
const app = document.getElementById("app");
const cache = {};
let installEvt = null;
let current = null;
window.__ctx = () => current;
window.__reload = () => { Object.keys(cache).forEach((k) => delete cache[k]); return route(); };

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; const b = document.getElementById("install-go"); if (b) b.hidden = false; });

function parse() {
  const [club, team, view] = location.hash.replace(/^#\/?/, "").split("/");
  return { club, team, view: VIEWS[view] ? view : view === "cuentas" ? "finanzas" : "inicio" };
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
    const [base, team0] = await Promise.all([loadClub(clubId), loadTeam(clubId, teamId)]);
    const { team, players, live } = await enrich(clubId, team0, base.players);
    const club = base.club;
    if (live && live.approved && live.member.player_id) store("app:" + k + ":mine", live.member.player_id);
    cache[k] = {
      clubId, club, team, players, live,
      ratings: computeRatings(team, players, club.rating),
      playersById: Object.fromEntries(players.map((p) => [p.id, p])),
      crest: club.crest ? (ABS.test(club.crest) ? club.crest : assetURL(clubId, club.crest)) : GENERIC,
      watermark: club.watermark || club.crest ? (ABS.test(club.watermark || club.crest) ? (club.watermark || club.crest) : assetURL(clubId, club.watermark || club.crest)) : GENERIC,
      asset: (f) => (/^(https?:|data:)/.test(f) ? f : assetURL(clubId, f)),
      key: "app:" + k,
    };
  }
  return cache[k];
}

async function route() {
  let { club, team, view } = parse();
  try {
    // Mi cuenta y panel de liga: rutas propias, fuera de los equipos.
    if (club === "cuenta" || club === "liga" || club === "registro") {
      current = null;
      await renderPlatform(app, location.hash.replace(/^#\/?/, "").split("/"));
      wireSheet(() => current);
      window.scrollTo(0, 0);
      return;
    }
    if (!club || !team) {
      const clubs = await loadClubs();
      const c = clubs.find((x) => x.id === club) || clubs[0];
      location.replace(`#/${c.id}/${team || c.teams[0]}/${view}`);
      return;
    }
    const ctx = await getCtx(club, team);
    applyTheme(ctx.club, ctx.crest);
    const tabs = Object.entries(VIEWS).filter(([, v]) => !v.needs || ctx.team[v.needs]);
    if (!tabs.some(([k]) => k === view)) { location.replace(`#/${club}/${team}/inicio`); return; }
    const V = VIEWS[view].m;
    const teams = (ctx.club.teams || [team]).map((t) => (typeof t === "string" ? { id: t, name: t } : t));
    app.innerHTML = `<header class="top">
        <img class="top-cr" src="${esc(ctx.crest)}" alt="Escudo de ${esc(ctx.club.name)}">
        <div class="top-t"><h1>${esc(ctx.club.name)}</h1>
        ${teams.length > 1
          ? `<select class="team-sel" aria-label="Equipo">${teams.map((t) => `<option value="${esc(t.id)}"${t.id === team ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>`
          : `<p>${esc(ctx.team.name)} · ${esc(ctx.team.competition || "")}</p>`}</div>
        ${on ? `<a class="top-acc" href="#/cuenta" aria-label="Mi cuenta">${icon.cuenta}</a>` : ""}
      </header>
      ${view === "inicio" ? installHint() : ""}
      <div id="view" class="view">${V.render(ctx)}</div>
      <nav class="tabbar" style="--n:${tabs.length}" aria-label="Secciones">${tabs.map(([k, v]) => `<a href="#/${club}/${team}/${k}"${k === view ? ' aria-current="page"' : ""}>${icon[k]}<span>${v.label}</span></a>`).join("")}</nav>`;
    current = ctx;
    V.bind(document.getElementById("view"), ctx);
    mount(document.getElementById("view"), ctx, view);
    wireSheet(() => current);
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
// Al volver de entrar con Google, regresa a la sección donde estaba.
const back = restoreRoute();
if (back && back.back && !location.hash) history.replaceState(null, "", location.pathname + location.search + back.back);
route();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
