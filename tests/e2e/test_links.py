import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def main():
    p, br, pg = await browser()
    # Ana crea la liga
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    await pg.click(".tabbar >> text=Equipos"); await pg.wait_for_selector("text=Sin contrato vigente")
    check("liga sin contrato muestra aviso", True)
    await pg.fill("input[name=slots]", "1"); await pg.click("text=Activar contrato de prueba"); await pg.wait_for_selector("text=0 de 1 equipos con Pro")
    await pg.fill("form[data-lf=invite] input[name=label]", "Otoño"); await pg.click("text=Crear código"); await pg.wait_for_selector(".code")
    code = await pg.inner_text(".code"); check("se genera código con formato", re.fullmatch(r"[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}", code), code)
    await signout(pg)

    # Beto (delegado) crea su equipo y pide vincularse
    await signup(pg, "beto@eq.com", ["team"])
    await pg.fill("form[data-pf=team] input[name=nm]", "Los Halcones"); await pg.click("text=Crear equipo"); await pg.wait_for_selector("text=Agregar jugador")
    await pg.goto(B + "#/cuenta"); await pg.wait_for_selector("text=Vincular con una liga")
    await pg.fill("input[name=code]", "AAAA-BBBB-CCCC"); await pg.click("text=Pedir vinculación")
    await pg.wait_for_selector("text=no es válido"); check("código inválido da mensaje claro", True)
    await pg.fill("input[name=code]", code.lower()); await pg.click("text=Pedir vinculación"); await toast(pg, "Solicitud enviada a Liga Reforma")
    await pg.wait_for_selector("text=Esperando a la liga"); check("el delegado ve la solicitud pendiente", True)
    check("sin aprobar sigue en plan gratis", await pg.locator(".cl-row .chip.ok:has-text('Equipo Gratis')").count() == 1)
    await pg.fill("input[name=code]", code); await pg.click("text=Pedir vinculación"); await pg.wait_for_selector("text=ya está vinculado o pendiente"); check("no se duplica", True)
    await signout(pg)

    # Ana aprueba -> Pro
    await signin(pg, "ana@liga.com"); await pg.click("text=Liga Reforma"); await pg.wait_for_selector(".tabbar"); await pg.click(".tabbar >> text=Equipos")
    await pg.wait_for_selector("text=Solicitudes por revisar"); await pg.click("text=Aprobar"); await toast(pg, "vinculado con Pro")
    await pg.wait_for_selector("text=1 de 1 equipos con Pro"); check("aprobar usa el cupo", True)
    await signout(pg)

    await signin(pg, "beto@eq.com"); await pg.wait_for_selector(".cl-row .chip.ok:has-text('Equipo Pro')")
    check("el equipo recibe Pro de la liga", "Pro de la liga" in await pg.inner_text("body"))
    await signout(pg)

    # Ana quita el Pro, luego desvincula
    await signin(pg, "ana@liga.com"); await pg.click("text=Liga Reforma"); await pg.click(".tabbar >> text=Equipos")
    await pg.wait_for_selector("text=Quitar Pro"); await pg.click("text=Quitar Pro"); await toast(pg, "Pro retirado")
    await pg.click("text=Dar Pro"); await toast(pg, "Pro asignado")
    await pg.click("text=Desvincular"); await toast(pg, "desvinculado"); await pg.wait_for_selector("text=Historial (1)"); check("historial conservado", True)
    await signout(pg)
    await signin(pg, "beto@eq.com"); await pg.wait_for_selector(".cl-row .chip.ok:has-text('Equipo Gratis')")
    check("al desvincular pierde solo el Pro de liga", "Pro de la liga" not in await pg.inner_text("body"))
    await pg.click("text=Los Halcones"); await pg.wait_for_selector(".tabbar >> text=Plantel"); check("el equipo sigue existiendo", "LOS HALCONES" in (await pg.inner_text(".top h1")).upper())
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
