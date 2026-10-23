import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")

async def main():
    p, br, pg = await browser()
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    lid = pg.url.split("#/liga/")[1].split("/")[0]
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.fill("#sheet input[name=season]", "Otoño 2026"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    tid = (await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).tourn[0].id"))
    for n in ["Rayos", "Lobos", "Águilas", "Toros"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.click("text=Generar calendario"); await pg.fill("#sheet input[name=start]", "2026-11-01T10:00"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd:text-is('J3')")
    first = pg.locator(".cl-row:has-text(' vs ')").first
    await first.locator("text=Resultado").click(); await pg.wait_for_selector("#sheet input[name=hg]")
    await pg.fill("#sheet input[name=hg]", "2"); await pg.fill("#sheet input[name=ag]", "1")
    await pg.click("#sheet >> text=+ Agregar gol o tarjeta"); await pg.fill("#sheet .ev input[name=ev_player]", "Pepe")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('2 - 1')")

    # apagada por defecto, y un borrador nunca se ve
    pub = B + f"#/p/{lid}"
    await pg.goto(pub); await pg.reload(); await pg.wait_for_selector("text=Página no disponible"); check("la página pública nace apagada", True)

    # activar
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    await pg.check("form[data-lf=pub] input[name=enabled]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(pub); await pg.reload(); await pg.wait_for_selector("text=Todavía no hay torneos publicados"); check("con la página activa, un borrador no aparece", True)

    # publicar el torneo
    await pg.goto(B + f"#/liga/{lid}/torneos"); await pg.reload(); await pg.wait_for_selector(".cl-card")
    if await pg.locator("button:text-is('Abrir')").count(): await pg.click("button:text-is('Abrir')")
    await pg.wait_for_selector("text=Publicar"); await pg.click("text=Publicar"); await pg.wait_for_selector(".cl-who:has-text('Publicado')")
    await pg.goto(B + f"#/p/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl")
    txt = await pg.inner_text("body")
    check("la tabla pública muestra equipos y puntos", "Rayos" in txt and "Toros" in txt and await pg.locator("table.tbl tbody tr").count() == 4)
    check("sin cuenta no hay botones de administración", await pg.locator("text=Resultado").count() == 0 and await pg.locator(".tabbar").count() == 0)
    await pg.click("[data-pt=calendario]"); await pg.wait_for_selector("h3:text-is('J3')"); check("calendario público con marcador", "2 - 1" in await pg.inner_text("body"))
    await pg.click("[data-pt=goleo]"); await pg.wait_for_selector("table.tbl"); check("goleo público con nombres", "Pepe" in await pg.inner_text("table.tbl"))
    check("no se fuga el id de usuario ni el correo", "ana@liga.com" not in await pg.content())

    # quitar nombres de goleadores
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    check("se ofrece el enlace y el código para integrar", "<iframe" in await pg.locator("textarea.snip").input_value() and "#/embed/" in await pg.locator("textarea.snip").input_value())
    await pg.uncheck("form[data-lf=pub] input[name=scorers]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(B + f"#/p/{lid}/{tid}/goleo"); await pg.reload(); await pg.wait_for_selector("text=no publica el goleo"); check("sin permiso de goleo no salen nombres", "Pepe" not in await pg.inner_text("body"))

    # integrable
    await pg.goto(B + f"#/embed/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl")
    check("la versión integrable no lleva encabezado ni barra", await pg.locator("header.top").count() == 0 and await pg.locator(".tabbar").count() == 0)
    check("el color de la liga se aplica", await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--red').trim()") != "")
    check("la tabla integrable cabe en el móvil", await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1)

    # apagar de nuevo
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    await pg.uncheck("form[data-lf=pub] input[name=enabled]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(pub); await pg.reload(); await pg.wait_for_selector("text=Página no disponible"); check("apagar la página la oculta de inmediato", True)
    check("sin errores en la página pública", not pg.errors, pg.errors)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
