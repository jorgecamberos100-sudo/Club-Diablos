import asyncio, sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def main():
    p, br, pg = await browser()
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    await pg.click(".tabbar >> text=Torneos"); await pg.wait_for_selector("text=Todavía no hay torneos.")
    await pg.click("text=Nuevo torneo")
    await pg.fill("#sheet input[name=name]", "Apertura 2026"); await pg.fill("#sheet input[name=season]", "Otoño"); await pg.fill("#sheet input[name=category]", "Libre")
    await pg.select_option("#sheet select[name=modality]", "7"); await pg.fill("#sheet input[name=fee]", "2500")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    check("se crea el torneo y abre en Equipos", "Apertura 2026" in await pg.inner_text(".cl-who"))
    check("nace como borrador", "Borrador" in await pg.inner_text(".cl-who"))
    for n in ["Rayos", "Lobos", "Águilas", "Toros"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    check("cuatro equipos inscritos", await pg.locator(".cl-row").count() == 4)
    await pg.fill("form[data-lf=addteam] input[name=name]", "rayos"); await pg.click("form[data-lf=addteam] button[type=submit]")
    await pg.wait_for_selector(".toast.bad:has-text('ya está inscrito')"); check("no se inscribe dos veces el mismo equipo", True)

    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.wait_for_selector("text=Generar calendario")
    await pg.click("text=Generar calendario"); await pg.select_option("#sheet select[name=v]", "1"); await pg.fill("#sheet input[name=start]", "2026-11-01T10:00")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd:text-is('J3')")
    check("calendario de 6 partidos en 3 jornadas", await pg.locator(".cl-row:has-text(' vs ')").count() == 6 and await pg.locator("h3.rnd").count() == 3)
    check("ya no ofrece generar otra vez", await pg.locator("text=Generar calendario").count() == 0)

    # resultado con goleadores
    first = pg.locator(".cl-row:has-text(' vs ')").first
    await first.locator("text=Resultado").click(); await pg.wait_for_selector("#sheet input[name=hg]")
    await pg.fill("#sheet input[name=hg]", "2"); await pg.fill("#sheet input[name=ag]", "1")
    await pg.click("#sheet >> text=+ Agregar gol o tarjeta"); await pg.fill("#sheet .ev input[name=ev_player]", "Pepe")
    await pg.click("#sheet >> text=+ Agregar gol o tarjeta"); await pg.locator("#sheet .ev input[name=ev_player]").nth(1).fill("Pepe")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('2 - 1')")
    check("el resultado aparece en el calendario", True)
    # un gol de más se rechaza
    await pg.locator(".cl-row:has-text('2 - 1')").locator("text=Corregir").click(); await pg.wait_for_selector("#sheet input[name=hg]")
    await pg.fill("#sheet input[name=hg]", "1"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet .msg:has-text('superan el marcador')"); check("goles de jugadores no pueden superar el marcador", True); pg.errors[:] = [e for e in pg.errors if "superan el marcador" not in e]   # error esperado, ya comprobado
    await pg.fill("#sheet input[name=hg]", "3"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('3 - 1')")
    check("el resultado se corrige", True)

    await pg.click("button[role=tab]:text-is('Tabla')"); await pg.wait_for_selector("table.tbl")
    rows = await pg.locator("table.tbl tbody tr").all_inner_texts()
    check("la tabla cuenta solo lo jugado y ordena", len(rows) == 4 and rows[0].split()[2] == "1" and "3" in rows[0].split() and rows[3].split()[-1] == "0", rows)
    await pg.click("button[role=tab]:text-is('Goleo')"); await pg.wait_for_selector("text=Pepe")
    check("goleo suma los goles del jugador", (await pg.locator("table.tbl tbody tr").first.inner_text()).split()[-1] == "2")

    # editar, publicar y terminar
    await pg.click("text=Editar"); await pg.fill("#sheet input[name=pts_win]", "2"); await pg.select_option("#sheet select[name=tb0]", "gf"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("text=Victoria 2" if False else "button[role=tab]"); await pg.click("button[role=tab]:text-is('Reglas')"); await pg.wait_for_selector("text=Victoria 2")
    check("las reglas de puntos son configurables", "Goles a favor" in await pg.inner_text("main, body"))
    await pg.click("text=Publicar"); await pg.wait_for_selector(".cl-who:has-text('Publicado')"); check("publicar cambia el estado", True)
    await pg.click("text=Terminar"); await pg.wait_for_selector(".cl-who:has-text('Terminado')")
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.wait_for_selector("h3.rnd")
    check("torneo terminado no permite capturar ni editar", await pg.locator("text=Resultado").count() == 0 and await pg.locator("text=Corregir").count() == 0 and await pg.locator("text=Agregar partido").count() == 0)
    await pg.click("text=Reabrir"); await pg.wait_for_selector(".cl-who:has-text('Publicado')"); check("se puede reabrir", True)

    # quitar un equipo con partidos jugados lo retira y conserva su historial
    await pg.click("button[role=tab]:text-is('Equipos')"); await pg.wait_for_selector("text=Inscribir equipo")
    n_before = await pg.locator(".cl-row").count()
    await pg.locator(".cl-row").first.locator("text=Quitar").click(); await pg.wait_for_selector("text=Retirados (1)")
    check("equipo con partidos jugados se retira, no se borra", await pg.locator(".cl-row").count() == n_before - 1)
    await pg.click("button[role=tab]:text-is('Tabla')"); await pg.wait_for_selector("table.tbl")
    check("la tabla conserva al equipo retirado", await pg.locator("table.tbl tbody tr").count() == 4)

    # vista móvil: la tabla no desborda la página
    ov = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("sin desbordamiento horizontal en móvil", ov <= 1, ov)
    # bitácora
    log = await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).audit.map(a=>a.action)")
    check("la bitácora registra los cambios importantes", all(a in log for a in ["tournament.create", "match.generate", "result.record", "result.correct", "tournament.status", "tournament.team_remove"]), log)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
