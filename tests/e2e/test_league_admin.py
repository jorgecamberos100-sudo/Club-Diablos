import asyncio, sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")

async def main():
    p, br, pg = await browser()
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    # torneo con dos equipos y calendario
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    for n in ["Rayos", "Lobos"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.click("text=Generar calendario"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text(' vs ')")
    await pg.locator(".cl-row:has-text(' vs ')").first.locator("text=Resultado").click(); await pg.fill("#sheet input[name=hg]", "2"); await pg.fill("#sheet input[name=ag]", "0"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('2 - 0')")
    # protesta desde el calendario
    await pg.locator(".cl-row:has-text('2 - 0')").locator("text=Protesta").click(); await pg.select_option("#sheet select[name=kind]", "protest"); await pg.fill("#sheet input[name=subject]", "Jugador sin credencial"); await pg.click("#sheet button[type=submit]"); await toast(pg, "Guardado")
    # invitación de administrador con permisos limitados
    await tab(pg, "Ajustes"); await pg.wait_for_selector("text=Invitar a un administrador")
    await pg.click("form[data-lf=adminvite] label:has-text('Sanciones y objeciones')"); await pg.click("form[data-lf=adminvite] label:has-text('Finanzas de la liga')")
    await pg.click("form[data-lf=adminvite] button[type=submit]"); await pg.wait_for_selector(".code")
    code = await pg.inner_text(".code"); check("se genera código de administrador", re.fullmatch(r"[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}", code), code)
    await signout(pg)

    # el invitado entra con su cuenta
    await signup(pg, "gus@liga.com", ["team"])
    await pg.wait_for_selector("form[data-pf=adminjoin]")
    await pg.fill("form[data-pf=adminjoin] input[name=code]", "AAAA-AAAA-AAAA"); await pg.click("form[data-pf=adminjoin] button[type=submit]"); await pg.wait_for_selector("text=no es válido")
    check("código de administrador inválido da mensaje claro", True)
    await pg.fill("form[data-pf=adminjoin] input[name=code]", code.lower()); await pg.click("form[data-pf=adminjoin] button[type=submit]"); await pg.wait_for_selector(".top h1:text-is('Liga Reforma')")
    check("el invitado entra a la liga", "liga reforma" in (await pg.inner_text(".top h1")).lower())
    await tab(pg, "Torneos")
    if await pg.locator("button:text-is('Abrir')").count(): await pg.click("button:text-is('Abrir')")   # puede ver torneos
    await pg.wait_for_selector(".cl-who")
    check("sin permiso de torneos no puede editarlos", await pg.locator("text=Editar").count() == 0 and await pg.locator("text=Publicar").count() == 0)
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.wait_for_selector("h3.rnd")
    check("sin permiso de resultados no hay botón de resultado", await pg.locator("button:text-is('Resultado')").count() == 0 and await pg.locator("button:text-is('Corregir')").count() == 0)

    # sanciones
    await tab(pg, "Sanciones"); await pg.wait_for_selector("text=Protesta: Jugador sin credencial")
    await pg.click("text=Nueva sanción"); await pg.wait_for_selector("#sheet select[name=team]"); await pg.select_option("#sheet select[name=team]", index=2); await pg.select_option("#sheet select[name=kind]", "multa")
    await pg.fill("#sheet textarea[name=reason]", "No se presentó"); await pg.fill("#sheet input[name=amount]", "300"); await pg.click("#sheet label:has-text('crear el cargo')"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector(".cl-row:has-text('Multa: No se presentó')"); check("se registra una multa", True)
    await pg.click("text=Nueva sanción"); await pg.wait_for_selector("#sheet select[name=team]"); await pg.select_option("#sheet select[name=team]", index=1); await pg.select_option("#sheet select[name=kind]", "puntos")
    await pg.fill("#sheet textarea[name=reason]", "Alineación indebida"); await pg.fill("#sheet input[name=points]", "3"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Descuento de puntos')")
    await pg.click("text=Registrar objeción o protesta") ; await pg.fill("#sheet input[name=subject]", "Cancha en mal estado"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Objeción: Cancha en mal estado')")
    await pg.locator(".cl-row:has-text('Protesta: Jugador sin credencial')").locator("text=Resolver").click(); await pg.select_option("#sheet select[name=status]", "rejected"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet .msg:has-text('resolución')"); check("resolver exige texto de resolución", True); pg.errors[:] = [e for e in pg.errors if "resolución" not in e.lower()]
    await pg.fill("#sheet textarea[name=res]", "Sin pruebas"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Improcedente')"); check("la protesta queda resuelta", True)
    async with pg.expect_download() as dl:
        await pg.click("text=Exportar CSV")
    d = await dl.value; txt = open(await d.path(), encoding="utf-8-sig").read()
    check("exporta sanciones a CSV", "Motivo" in txt and "No se presentó" in txt and "Alineación indebida" in txt, txt[:200])
    check("quien no tiene permiso de bitácora no ve Historial", await pg.locator("button:text-is('Historial')").count() == 0)

    # finanzas
    await tab(pg, "Finanzas"); await pg.wait_for_selector("text=Cargar a todos los equipos")
    await pg.click("text=Cargar a todos los equipos"); await pg.fill("#sheet input[name=concept]", "Inscripción"); await pg.fill("#sheet input[name=amount]", "2500"); await pg.click("#sheet button[type=submit]"); await toast(pg, "Guardado")
    await pg.wait_for_selector(".cl-row:has-text('Lobos'):has-text('Debe $2,800')"); check("el cargo y la multa suman en el saldo (2,500 + 300)", True)
    await pg.locator(".cl-row:has-text('Lobos')").locator("button:text-is('Pago')").click(); await pg.fill("#sheet input[name=amount]", "1000"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector(".cl-row:has-text('Lobos'):has-text('Debe $1,800')"); check("un pago baja el saldo", True)
    await pg.click("text=Cargar a todos los equipos"); await pg.fill("#sheet input[name=concept]", "inscripción"); await pg.fill("#sheet input[name=amount]", "2500"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector(".cl-row:has-text('Lobos'):has-text('Debe $1,800')"); check("repetir el cargo no lo duplica", True)
    await pg.click("text=Registrar ingreso o gasto"); await pg.fill("#sheet input[name=concept]", "Pago a árbitros"); await pg.fill("#sheet input[name=amount]", "400"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Pago a árbitros')")
    async with pg.expect_download() as dl:
        await pg.click("text=Exportar saldos")
    d = await dl.value; txt = open(await d.path(), encoding="utf-8-sig").read()
    check("exporta saldos a CSV", "Saldo" in txt and "Lobos" in txt and "1800" in txt, txt)
    await signout(pg)

    # la dueña revisa la bitácora y le quita el acceso
    await signin(pg, "ana@liga.com"); await pg.click("text=Liga Reforma"); await pg.wait_for_selector(".tabbar")
    await tab(pg, "Torneos"); await pg.click("text=Abrir"); await pg.wait_for_selector(".cl-who")
    await pg.wait_for_selector("table.tbl")
    rows = await pg.locator("table.tbl tbody tr").all_inner_texts()
    check("la tabla aplica el descuento de puntos (3 − 3 = 0, con marca)", any("Rayos" in r and "(-3)" in r for r in rows), rows)
    await tab(pg, "Ajustes"); await pg.wait_for_selector("text=Bitácora")
    body = await pg.inner_text("body")
    check("la bitácora dice quién hizo qué", "gus@liga.com" in body and "Registró una sanción" in body and "Registró un pago" in body, body[-600:])
    await pg.locator(".cl-row:has-text('gus@liga.com')").locator("text=Quitar").click(); await toast(pg, "Acceso retirado")
    check("el administrador quitado aparece como retirado", await pg.locator(".cl-row:has-text('gus@liga.com'):has-text('Retirado')").count() == 1)
    await signout(pg)
    await signin(pg, "gus@liga.com"); await pg.goto(B + "#/liga/liga-reforma/finanzas"); await pg.wait_for_selector("text=Sin acceso")
    check("quien perdió el acceso ya no entra", True)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
