import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def main():
    p, br, pg = await browser()

    # ---------- Encabezado del equipo y panel (sin cuentas) ----------
    await pg.goto(B + "#/diablos/domingos/inicio"); await pg.wait_for_selector(".top")
    check("el encabezado muestra a Baloncho en círculo con su nombre",
          await pg.locator(".mascota-chip").count() == 1 and "Baloncho" in await pg.inner_text(".mascota-chip")
          and await pg.locator(".mascota-chip img.mascota-av").count() == 1)
    check("el avatar del encabezado es de 40 px por defecto",
          await pg.evaluate("document.querySelector('.mascota-chip img').getBoundingClientRect().width") == 40)
    await pg.click(".mascota-chip"); await pg.wait_for_selector("#sheet .mascota-panel")
    check("el panel tiene editar nombre con 2 sugerencias",
          await pg.locator("#sheet input[name=nm]").count() == 1 and await pg.locator("#sheet [data-mascotaj=sug]").count() == 2)
    check("el panel tiene 4 personalidades", await pg.locator("#sheet [data-mascotaj=vibe]").count() == 4)
    check("el panel tiene 6 aspectos", await pg.locator("#sheet [data-mascotaj=aspecto]").count() == 6)
    check("el panel tiene 3 tamaños", await pg.locator("#sheet [data-mascotaj=tam]").count() == 3)
    check("el panel tiene el botón ¡Baila!", await pg.locator("#sheet [data-mascotaj=baila]").count() == 1)

    # Baile
    await pg.click("#sheet [data-mascotaj=baila]"); await pg.wait_for_timeout(200)
    check("¡Baila! hace bailar a la mascota", await pg.locator("#sheet .mascota-hero img.bailando").count() == 1)

    # Sugerencia rellena el campo
    await pg.click("#sheet [data-mascotaj=sug][data-v=Baloncito]")
    check("una sugerencia rellena el nombre", await pg.input_value("#sheet input[name=nm]") == "Baloncito")

    # Cambiar el nombre: se guarda, se ve en el encabezado y persiste al recargar
    await pg.fill("#sheet input[name=nm]", "Bola"); await pg.click("#sheet button[type=submit]:has-text('Guardar nombre')")
    await toast(pg, "Tu mascota ahora se llama Bola")
    check("el encabezado usa el nombre elegido", "Bola" in await pg.inner_text(".mascota-chip"))
    await pg.reload(); await pg.wait_for_selector(".top")
    check("el nombre persiste al recargar", "Bola" in await pg.inner_text(".mascota-chip"))

    # Tamaño grande: el avatar del encabezado crece a 56 px
    await pg.click(".mascota-chip"); await pg.wait_for_selector("#sheet .mascota-panel")
    await pg.click("#sheet [data-mascotaj=tam][data-v=grande]"); await pg.wait_for_selector("#sheet .mascota-panel")
    check("el tamaño grande pone el avatar a 56 px",
          await pg.evaluate("document.querySelector('.mascota-chip img').getBoundingClientRect().width") == 56)

    # Personalidad bromista: el saludo del panel cambia
    await pg.click("#sheet [data-mascotaj=vibe][data-v=bromista]"); await pg.wait_for_selector("#sheet .mascota-panel")
    check("la personalidad cambia el saludo", "goles hasta en los sueños" in await pg.inner_text("#sheet .mascota-hero"))

    # Aspecto: elegir Pensando cambia la imagen del avatar
    src_antes = await pg.get_attribute(".mascota-chip img", "src")
    await pg.click("#sheet [data-mascotaj=aspecto][data-v=pensando]"); await pg.wait_for_selector("#sheet .mascota-panel")
    src_despues = await pg.get_attribute(".mascota-chip img", "src")
    check("el aspecto cambia la imagen", src_despues.startswith("data:image") and src_despues != src_antes, src_despues[:30])

    # Volver a Baloncho con la sugerencia (deja el estado limpio)
    await pg.click("#sheet [data-mascotaj=sug][data-v=Baloncho]")
    await pg.click("#sheet button[type=submit]:has-text('Guardar nombre')"); await toast(pg, "Tu mascota ahora se llama Baloncho")
    check("el nombre vuelve a Baloncho", "Baloncho" in await pg.inner_text(".mascota-chip"))
    await pg.click("#sheet .sp-h [data-cl=close]"); await pg.wait_for_timeout(300)
    check("la hoja se cierra", await pg.locator("#sheet .mascota-panel").count() == 0)

    # ---------- Chat en la página pública: avatar junto a sus mensajes ----------
    await signup(pg, "mascota@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Mascota"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    lid = pg.url.split("#/liga/")[1].split("/")[0]
    await set_league_plan(pg, lid); await pg.reload(); await pg.wait_for_selector(".tabbar")
    await pg.goto(B + f"#/liga/{lid}/ajustes"); await pg.reload(); await pg.wait_for_selector("form[data-lf=pub]")
    await pg.check("form[data-lf=pub] input[name=enabled]"); await pg.check("form[data-lf=pub] input[name=chat]")
    await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await pg.goto(B + f"#/liga/{lid}/torneos"); await pg.reload(); await pg.wait_for_selector("text=Nuevo torneo")
    await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.fill("#sheet input[name=season]", "Otoño 2026")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    tid = (await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).tourn[0].id"))
    if await pg.locator("button:text-is('Abrir')").count(): await pg.click("button:text-is('Abrir')")
    await pg.wait_for_selector("text=Publicar"); await pg.click("text=Publicar"); await pg.wait_for_selector(".cl-who:has-text('Publicado')")
    await pg.goto(B + f"#/p/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector(".chat")
    check("la página pública también lleva a Baloncho en el encabezado",
          await pg.locator("header.top .mascota-chip").count() == 1)
    h2 = " ".join((await pg.inner_text(".chat h2")).split())
    check("el chat se presenta con el nombre de la mascota", h2.lower() == "pregúntale a baloncho", h2)
    check("el saludo de la mascota lleva su avatar",
          "Baloncho" in await pg.locator(".chat-bot").first.inner_text()
          and await pg.locator(".chat-row img.mascota-av").count() >= 1)
    await pg.click(".chat-ideas button >> nth=0"); await pg.wait_for_selector(".chat-bot >> nth=1")
    check("la respuesta del asistente lleva el avatar de la mascota",
          await pg.locator(".chat-row").nth(1).locator("img.mascota-av").count() == 1)
    check("sin errores de JavaScript en la mascota", not pg.errors, pg.errors)

    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
