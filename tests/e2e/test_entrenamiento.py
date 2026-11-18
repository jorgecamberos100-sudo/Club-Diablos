import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")

async def generar(pg, focos=("pas", "res")):
    await pg.wait_for_selector("form[data-tr=perfil]")
    for f in focos:
        await pg.check(f"form[data-tr=perfil] input[name=foco][value={f}]")
    await pg.click("text=Generar mi plan"); await pg.wait_for_selector("text=Tu plan de la semana")

async def main():
    p, br, pg = await browser()
    # --- 1. Planificador solo, sin liga ni cuenta
    await pg.goto(B + "#/mi-entrenamiento"); await pg.wait_for_selector("text=Mi entrenamiento")
    await pg.fill("form[data-tr=solo] input[name=birth]", "2000-01-01"); await pg.click("form[data-tr=solo] button[type=submit]")
    await generar(pg)
    check("el plan tiene 3 sesiones", await pg.locator("h3:has-text('Sesión')").count() == 3)
    check("el plan muestra los minutos por semana", "min por semana" in await pg.inner_text("body"))
    check("el plan trae ejercicios con series", await pg.locator(".tbl tbody tr").count() >= 9)
    await pg.click("text=Generar otro plan"); await pg.wait_for_selector("text=Tu plan de la semana")
    check("regenerar no rompe el plan", await pg.locator("h3:has-text('Sesión')").count() == 3)
    await pg.reload(); await pg.wait_for_selector("form[data-tr=solo]")
    check("la fecha se recuerda en este celular", await pg.input_value("form[data-tr=solo] input[name=birth]") == "2000-01-01")
    # --- 2. Menor: sesiones cortas y sin cargas
    await pg.evaluate("localStorage.clear()"); await pg.goto(B + "#/mi-entrenamiento"); await pg.wait_for_selector("form[data-tr=solo]")
    await pg.fill("form[data-tr=solo] input[name=birth]", "2016-01-01"); await pg.click("form[data-tr=solo] button[type=submit]")
    await generar(pg, ("tir",))
    check("el menor es banda Infantil", "Infantil" in await pg.inner_text("body"))
    check("el menor entrena 30 minutos por sesión", "30 min" in await pg.inner_text("body"))

    # --- 3. Jugador de la liga: se identifica y guarda su plan
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    await set_league_plan(pg, "liga-reforma"); await pg.reload(); await pg.wait_for_selector(".tabbar")   # la liga demo necesita Liga Pro para el registro de jugadores
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.fill("#sheet input[name=season]", "Otoño 2026"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    await pg.fill("form[data-lf=addteam] input[name=name]", "Lobos"); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Lobos')")
    await tab(pg, "Ajustes"); await pg.wait_for_selector("form[data-lf=privacy]"); await pg.click("button:text-is('Usar plantilla para revisar')")
    await pg.fill("form[data-lf=privacy] input[name=contact]", "privacidad@liga.mx"); await pg.click("form[data-lf=privacy] button[type=submit]"); await toast(pg, "versión 1")
    await tab(pg, "Jugadores"); await pg.wait_for_selector("text=Registrar jugador")
    await pg.click("button:text-is('Registrar jugador')"); await pg.wait_for_selector("#sheet input[name=name]")
    await pg.select_option("#sheet select[name=team]", index=0)
    await pg.fill("#sheet input[name=name]", "Juan Pérez"); await pg.fill("#sheet input[name=birth]", "2000-05-01"); await pg.fill("#sheet input[name=number]", "9")
    await pg.check("#sheet input[name=accept]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".pl:has-text('Juan Pérez')")
    check("registro en oficina: jugador activo en el padrón", "#9" in await pg.inner_text(".pl:has-text('Juan Pérez')"))
    # el jugador abre su plan desde la liga y se identifica
    await pg.goto(B + "#/mi-entrenamiento/liga-reforma"); await pg.wait_for_selector("form[data-tr=ident]")
    await pg.fill("form[data-tr=ident] input[name=name]", "Juan Perez"); await pg.fill("form[data-tr=ident] input[name=birth]", "2000-05-02")
    await pg.click("form[data-tr=ident] button[type=submit]"); await pg.wait_for_selector("text=No te encontré en el padrón")
    check("con datos que no coinciden no se abre el plan", await pg.locator("form[data-tr=perfil]").count() == 0)
    await pg.fill("form[data-tr=ident] input[name=name]", "Juan Pérez"); await pg.fill("form[data-tr=ident] input[name=birth]", "2000-05-01")
    await pg.click("form[data-tr=ident] button[type=submit]"); await pg.wait_for_selector("form[data-tr=perfil]")
    check("con nombre y fecha correctos se abre su perfil", "Juan Pérez" in await pg.inner_text("body"))
    await generar(pg)
    check("el plan de la liga se genera y se guarda", await pg.locator("h3:has-text('Sesión')").count() == 3)
    # la liga lo abre desde el padrón, sin identificarse
    await pg.goto(B + "#/liga/liga-reforma/jugadores"); await pg.wait_for_selector(".pl:has-text('Juan Pérez')")
    await pg.click(".pl:has-text('Juan Pérez') button:text-is('Plan')"); await pg.wait_for_selector("form[data-tr=perfil]")
    check("la liga abre el plan del jugador desde el padrón", "Juan Pérez" in await pg.inner_text("body") and await pg.locator("h3:has-text('Sesión')").count() == 3)

    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
