"""Reportes: imprimir/PDF y CSV de torneo, finanzas, sanciones y planillas (modo demo). Se captura lo que se manda a imprimir."""
import asyncio, sys, os, base64
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")
HOOK = "window.__printed = null; window.print = () => { window.__printed = document.getElementById('print-root').innerHTML; }; 0"

async def main():
    p, br, pg = await browser()
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    await tab(pg, "Ajustes"); await pg.click("button:text-is('Usar plantilla para revisar')"); await pg.fill("form[data-lf=privacy] input[name=contact]", "privacidad@liga.mx"); await pg.click("form[data-lf=privacy] button[type=submit]"); await toast(pg, "versión 1")
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    for n in ["Rayos", "Lobos"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.click("text=Generar calendario"); await pg.fill("#sheet input[name=start]", "2026-11-01T10:00"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text(' vs ')")
    await pg.locator(".cl-row:has-text(' vs ')").first.locator("text=Resultado").click(); await pg.fill("#sheet input[name=hg]", "3"); await pg.fill("#sheet input[name=ag]", "1")
    await pg.click("#sheet >> text=+ Agregar gol o tarjeta"); await pg.fill("#sheet .ev input[name=ev_player]", "Pepe"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('3 - 1')")
    await pg.evaluate(HOOK)
    await pg.click("button:text-is('Imprimir / PDF')"); await pg.click("#sheet button:text-is('Todo')"); await pg.wait_for_function("window.__printed")
    html = await pg.evaluate("window.__printed")
    check("PDF del torneo: tabla, calendario y goleo con encabezado de la liga", all(x in html for x in ["Liga Reforma", "Torneo Apertura", "Calendario", "Goleo", "Pepe", "3 - 1", "Generado el"]), html[:300])
    async with pg.expect_download() as dl:
        await pg.click("button:text-is('Exportar CSV')"); await pg.click("#sheet button:text-is('Calendario')")
    txt = open(await (await dl.value).path(), encoding="utf-8-sig").read()
    check("CSV del calendario", "Local" in txt and "Rayos" in txt and ",3,1," in txt, txt[:200])
    async with pg.expect_download() as dl:
        await pg.click("button:text-is('Exportar CSV')"); await pg.click("#sheet button:text-is('Tabla')")
    txt = open(await (await dl.value).path(), encoding="utf-8-sig").read()
    check("CSV de la tabla", txt.splitlines()[1].startswith("1,Rayos"), txt[:200])
    # finanzas
    await tab(pg, "Finanzas"); await pg.click("text=Cargar a todos los equipos"); await pg.fill("#sheet input[name=concept]", "Inscripción"); await pg.fill("#sheet input[name=amount]", "2500"); await pg.click("#sheet button[type=submit]"); await toast(pg, "Guardado")
    await pg.evaluate(HOOK); await pg.click("button:text-is('Imprimir / PDF')"); await pg.wait_for_function("window.__printed")
    html = await pg.evaluate("window.__printed"); check("PDF de saldos", "Saldos de los equipos" in html and "Debe $2,500" in html and "no cobra dinero" in html, html[:300])
    # sanciones
    await tab(pg, "Sanciones"); await pg.click("text=Nueva sanción"); await pg.wait_for_selector("#sheet select[name=team]"); await pg.select_option("#sheet select[name=team]", index=1); await pg.select_option("#sheet select[name=kind]", "amonestacion")
    await pg.fill("#sheet textarea[name=reason]", "Conducta antideportiva"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Conducta antideportiva')")
    await pg.evaluate(HOOK); await pg.click("button:text-is('Imprimir / PDF')"); await pg.wait_for_function("window.__printed")
    check("PDF de sanciones", "Conducta antideportiva" in await pg.evaluate("window.__printed"))
    # planillas
    await tab(pg, "Jugadores"); await pg.click("button:text-is('Registrar jugador')"); await pg.wait_for_selector("#sheet input[name=name]")
    await pg.fill("#sheet input[name=name]", "Juan Pérez"); await pg.fill("#sheet input[name=birth]", "2000-05-01"); await pg.fill("#sheet input[name=number]", "9"); await pg.check("#sheet input[name=accept]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".pl:has-text('Juan Pérez')")
    await pg.evaluate(HOOK); await pg.click("button:text-is('Planillas para el partido (PDF)')"); await pg.wait_for_function("window.__printed")
    html = await pg.evaluate("window.__printed")
    check("planillas: un equipo por página, nombre y número, sin fecha de nacimiento", html.count('class="rep-page"') == 2 and "Juan Pérez" in html and "2000-05-01" not in html, html[:300])
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
