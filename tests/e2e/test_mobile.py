"""Revisión móvil (360 px): sin desborde horizontal, botones tocables y sin errores, en las pantallas de liga, página pública y hojas."""
import asyncio, sys, os, base64
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
OVER = "document.documentElement.scrollWidth - document.documentElement.clientWidth"
SMALL = """[...document.querySelectorAll('button, a.btn, .tabbar a, input[type=checkbox], select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 30 || r.width < 30) && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden' && !(e.type === 'checkbox') && !e.classList.contains('x') }).map(e => (e.textContent || e.className).trim().slice(0, 25) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))"""

FIND = """(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > W + 1 && r.width > 0 && !e.closest('.tbl-wrap'); }).filter(e => !e.querySelector('*') || e.children.length < 1 || ['SELECT','INPUT','BUTTON','TABLE','LABEL'].includes(e.tagName)).slice(0, 6).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.textContent||'').trim().slice(0,30)); })()"""

async def audit(pg, name):
    await pg.wait_for_timeout(350)
    o = await pg.evaluate(OVER); s = await pg.evaluate(SMALL)
    check(f"{name}: sin desborde horizontal", o <= 1, [o, await pg.evaluate(FIND)] if o > 1 else o)
    check(f"{name}: botones y controles tocables (≥30 px)", not s, s)

async def main():
    p, br, pg = await browser()
    await pg.set_viewport_size({"width": 360, "height": 740})
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma Metropolitana del Norte"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    lid = pg.url.split("#/liga/")[1].split("/")[0]
    await pg.click(".tabbar >> text=Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura 2026 Categoría Libre Varonil"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    tid = await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).tourn[0].id")
    for n in ["Los Rayos del Norte", "Lobos FC", "Águilas Doradas", "Toros"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await audit(pg, "torneo: equipos")
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.click("text=Generar calendario"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd")
    await audit(pg, "torneo: calendario")
    await pg.click("button:text-is('Resultado') >> nth=0"); await pg.wait_for_selector("#sheet input[name=hg]"); await audit(pg, "hoja de resultado")
    await pg.fill("#sheet input[name=hg]", "1"); await pg.fill("#sheet input[name=ag]", "0"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('1 - 0')")
    await pg.click("button:text-is('Acta') >> nth=0"); await pg.wait_for_selector("#sheet input[type=file]"); await audit(pg, "hoja de acta")
    await pg.set_input_files("#sheet input[name=photo]", {"name": "a.png", "mimeType": "image/png", "buffer": PNG}); await pg.click("#sheet button:text-is('Subir foto')"); await pg.wait_for_selector("#sheet img.acta-img"); await audit(pg, "revisión de acta")
    await pg.click("#sheet [data-cl=close] >> nth=1")
    await pg.click("button[role=tab]:text-is('Tabla')"); await pg.wait_for_selector("table.tbl"); await audit(pg, "torneo: tabla")
    for sec, sel in [("Equipos", ".cl-card"), ("Jugadores", ".cl-card"), ("Sanciones", ".cl-card"), ("Finanzas", ".cl-card"), ("Ajustes", ".cl-card")]:
        await pg.click(f".tabbar >> text={sec}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{sec}')"); await pg.wait_for_selector(sel); await audit(pg, "sección " + sec)
    await pg.check("form[data-lf=pub] input[name=enabled]"); await pg.check("form[data-lf=pub] input[name=chat]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada"); await audit(pg, "ajustes con enlace público")
    await pg.goto(B + f"#/liga/{lid}/torneos"); await pg.reload(); await pg.wait_for_selector(".cl-card")
    if await pg.locator("button:text-is('Abrir')").count(): await pg.click("button:text-is('Abrir')")
    await pg.click("text=Publicar"); await pg.wait_for_selector(".cl-who:has-text('Publicado')")
    await pg.goto(B + f"#/p/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl"); await audit(pg, "página pública: tabla")
    await pg.click("[data-pt=calendario]"); await pg.wait_for_selector("h3"); await audit(pg, "página pública: calendario")
    await pg.click(".chat-ideas button >> nth=0"); await pg.wait_for_selector(".chat-bot"); await audit(pg, "página pública con asistente")
    await pg.goto(B + f"#/embed/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl"); await audit(pg, "versión integrable")
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
