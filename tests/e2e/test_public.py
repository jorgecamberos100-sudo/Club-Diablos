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
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", 'Apertura "A"'); await pg.fill("#sheet input[name=season]", "Otoño 2026"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    tid = (await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).tourn[0].id"))
    for n in ["Rayos", "Lobos", "Águilas", "Toros"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.click("text=Generar calendario"); await pg.fill("#sheet input[name=start]", "2026-11-01T10:00"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd:text-is('J3')")
    first = pg.locator(".cl-row:has-text(' vs ')").first
    await first.locator("text=Resultado").click(); await pg.wait_for_selector("#sheet input[name=hg]")
    await pg.fill("#sheet input[name=hg]", "2"); await pg.fill("#sheet input[name=ag]", "1")
    await pg.click("#sheet >> text=+ Agregar gol o tarjeta"); await pg.fill("#sheet .ev input[name=ev_player]", "Pepe Pérez")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('2 - 1')")

    # apagada por defecto, y un borrador nunca se ve
    pub = B + f"#/p/{lid}"
    await pg.goto(pub); await pg.reload(); await pg.wait_for_selector(".error h1")
    check("la página pública nace apagada", (await pg.text_content(".error h1")) == "Página no disponible")

    # activar
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    check("los nombres de goleadores nacen apagados", await pg.input_value("form[data-lf=pub] select[name=names]") == "off")
    await pg.evaluate("(()=>{const i=document.querySelector('form[data-lf=brand] input[name=color]'); i.value='#1a5cff';})()"); await pg.click("form[data-lf=brand] button[type=submit]"); await toast(pg, "Marca guardada")
    await pg.fill("form[data-lf=privacy] textarea[name=notice]", "Aviso de privacidad de prueba de la Liga Reforma. Usamos los datos solo para organizar el torneo y publicar resultados."); await pg.fill("form[data-lf=privacy] input[name=contact]", "privacidad@liga.mx")
    await pg.click("form[data-lf=privacy] button[type=submit]"); await toast(pg, "versión 1")
    await pg.check("form[data-lf=pub] input[name=enabled]"); await pg.check("form[data-lf=pub] input[name=chat]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(pub); await pg.reload(); await pg.wait_for_selector(".view .cl-card")
    check("con la página activa, un borrador no aparece", "Todavía no hay torneos publicados" in await pg.inner_text(".view") and "Apertura" not in await pg.inner_text(".view"))

    # publicar el torneo
    await pg.goto(B + f"#/liga/{lid}/torneos"); await pg.reload(); await pg.wait_for_selector(".cl-card")
    if await pg.locator("button:text-is('Abrir')").count(): await pg.click("button:text-is('Abrir')")
    await pg.wait_for_selector("text=Publicar"); await pg.click("text=Publicar"); await pg.wait_for_selector(".cl-who:has-text('Publicado')")
    await pg.goto(B + f"#/p/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl")
    txt = await pg.inner_text("body")
    check("la tabla pública muestra equipos y puntos", "Rayos" in txt and "Toros" in txt and await pg.locator("table.tbl tbody tr").count() == 4)
    check("sin cuenta no hay botones de administración", await pg.locator("button:text-is('Resultado')").count() == 0 and await pg.locator(".tabbar").count() == 0)
    check("el color de la liga se aplica", (await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--red').trim()")).lower() == "#1a5cff")
    check("la página muestra el aviso de privacidad de la liga", "privacidad@liga.mx" in await pg.text_content(".pub-priv"))
    await pg.click("[data-pt=calendario]"); await pg.wait_for_selector("h3:text-is('J3')"); cal = await pg.inner_text(".view")
    check("calendario público con marcador y hora", "2 - 1" in cal and "10:00" in cal, cal[:200])
    await pg.click("[data-pt=goleo]"); await pg.wait_for_selector("[data-pt=goleo][aria-selected=true]")
    c0 = await pg.content(); i0 = c0.find("Pepe")
    check("por omisión el goleo no publica nombres", "no publica los nombres" in await pg.inner_text(".view") and i0 < 0, [await pg.inner_text(".view"), i0])
    await pg.wait_for_selector(".chat"); await pg.click(".chat-ideas button >> nth=0"); await pg.wait_for_selector(".chat-bot")
    check("el asistente responde con los datos públicos", "Tabla" in await pg.inner_text(".chat-bot") and "Rayos" in await pg.inner_text(".chat-bot"), await pg.inner_text(".chat-log"))
    await pg.wait_for_timeout(1600); await pg.fill(".chat-form input[name=q]", "¿Quién ganará el mundial?"); await pg.click(".chat-form button"); await pg.wait_for_selector(".chat-bot >> nth=1")
    check("lo que no sabe, lo dice", "No tengo ese dato" in await pg.locator(".chat-bot").nth(1).inner_text())
    await pg.fill(".chat-form input[name=q]", "otra"); await pg.click(".chat-form button"); await pg.wait_for_timeout(300)
    check("hay freno entre preguntas seguidas", await pg.locator(".chat-bot:has-text('Un momento')").count() == 1)
    check("no se fuga el id de usuario ni el correo", "ana@liga.com" not in await pg.content())

    # quitar nombres de goleadores
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    check("se ofrece el enlace y el código para integrar", "<iframe" in await pg.locator("textarea.snip").input_value() and "#/embed/" in await pg.locator("textarea.snip").input_value())
    check("el código para integrar escapa el nombre del torneo", 'title="Liga Reforma - Apertura &quot;A&quot;"' in await pg.locator("textarea.snip").input_value())
    await pg.select_option("form[data-lf=pub] select[name=names]", "full"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(B + f"#/p/{lid}/{tid}/goleo"); await pg.reload(); await pg.wait_for_selector("table.tbl"); check("con permiso explícito: nombre completo", "Pepe Pérez" in await pg.inner_text("table.tbl"))
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    await pg.select_option("form[data-lf=pub] select[name=names]", "initials"); await pg.uncheck("form[data-lf=pub] input[name=details]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(B + f"#/p/{lid}/{tid}/goleo"); await pg.reload(); await pg.wait_for_selector("table.tbl"); g = await pg.inner_text("table.tbl")
    check("con iniciales: sin apellido completo", "Pepe P." in g and "Pérez" not in g, g)
    await pg.click("[data-pt=calendario]"); await pg.wait_for_selector("h3:text-is('J3')"); cal = await pg.inner_text(".view")
    check("sin detalles: fecha sin hora ni cancha", "10:00" not in cal and "nov" in cal, cal[:200])
    # liga con menores: los nombres se apagan solos
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=privacy]")
    await pg.check("form[data-lf=privacy] input[name=minors]"); await pg.click("form[data-lf=privacy] button[type=submit]"); await toast(pg, "Aviso guardado")
    check("con menores el selector de nombres se bloquea", await pg.locator("form[data-lf=pub] select[name=names][disabled]").count() == 1)
    await pg.goto(B + f"#/p/{lid}/{tid}/goleo"); await pg.reload(); await pg.wait_for_selector(".view .cl-card"); check("con menores no salen nombres", "Pepe" not in await pg.content())

    # integrable
    await pg.goto(B + f"#/embed/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl")
    check("la versión integrable no lleva asistente", await pg.locator(".chat").count() == 0)
    check("la versión integrable no lleva encabezado ni barra", await pg.locator("header.top").count() == 0 and await pg.locator(".tabbar").count() == 0)
    check("la tabla integrable cabe en el móvil", await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1)

    # apagar de nuevo
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    await pg.uncheck("form[data-lf=pub] input[name=enabled]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(pub); await pg.reload(); await pg.wait_for_selector(".error h1"); check("apagar la página la oculta de inmediato", (await pg.text_content(".error h1")) == "Página no disponible")
    check("sin errores en la página pública", not pg.errors, pg.errors)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
