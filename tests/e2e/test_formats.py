"""Formatos de torneo en modo demo: grupos con sorteo, tablas por grupo, eliminatoria con penales, final, campeón y página pública."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")

async def ttab(pg, name):
    await pg.click(f"button[role=tab]:text-is('{name}')"); await pg.wait_for_selector(f"button[role=tab][aria-selected=true]:text-is('{name}')"); await pg.wait_for_timeout(200)

async def result(pg, home, hg, ag, hp=None, ap=None):
    r = pg.locator(f".cl-row:has-text('{home} vs')").first
    await r.locator("button:text-is('Resultado')").click(); await pg.wait_for_selector("#sheet input[name=hg]")
    await pg.fill("#sheet input[name=hg]", str(hg)); await pg.fill("#sheet input[name=ag]", str(ag))
    if hp is not None: await pg.fill("#sheet input[name=hp]", str(hp)); await pg.fill("#sheet input[name=ap]", str(ap))
    await pg.click("#sheet button[type=submit]")

async def main():
    p, br, pg = await browser()
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    lid = pg.url.split("#/liga/")[1].split("/")[0]
    # eliminación directa con 3 equipos: mensaje claro
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Copa Rápida"); await pg.select_option("#sheet select[name=format]", "knockout"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    for n in ["Uno", "Dos", "Tres"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await ttab(pg, "Calendario"); await pg.click("button:text-is('Armar eliminatoria')"); await toast(pg, "2, 4, 8, 16 o 32")
    check("eliminación directa con 3 equipos da un mensaje claro", True)
    pg.errors[:] = []
    await pg.click("button:text-is('← Torneos')"); await pg.wait_for_selector("text=Nuevo torneo")

    # grupos y eliminación
    await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Copa Grupos"); await pg.select_option("#sheet select[name=format]", "groups_knockout")
    await pg.fill("#sheet input[name=groups]", "2"); await pg.fill("#sheet input[name=advance]", "2"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    for n in ["Rayos", "Lobos", "Águilas", "Toros"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await ttab(pg, "Calendario")
    check("antes de tener grupos se avisa que hay que asignarlos", await pg.locator("text=asigna un grupo a cada equipo").count() == 1)
    await ttab(pg, "Equipos"); await pg.wait_for_selector("form[data-lf=groups]")
    await pg.click("button:text-is('Sortear grupos')"); vals = [await s.input_value() for s in await pg.locator("form[data-lf=groups] select").all()]
    check("el sorteo reparte 2 y 2", sorted(vals) == ["A", "A", "B", "B"], vals)
    # grupos fijos para que la prueba sea predecible: A = Rayos, Lobos · B = Águilas, Toros
    for n, g in [("Rayos", "A"), ("Lobos", "A"), ("Águilas", "B"), ("Toros", "B")]:
        await pg.locator(f".grp-sel:has-text('{n}') select").select_option(g)
    await pg.click("form[data-lf=groups] button[type=submit]"); await toast(pg, "Grupos guardados")
    await ttab(pg, "Calendario"); await pg.click("button:text-is('Generar partidos de grupos')"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text(' vs ')")
    rows = await pg.locator(".cl-row:has-text(' vs ')").all_inner_texts()
    check("un partido por grupo, sin cruces entre grupos", len(rows) == 2 and any(r.startswith("A · ") for r in rows) and any(r.startswith("B · ") for r in rows), rows)
    check("la eliminatoria no se ofrece hasta terminar los grupos", await pg.locator("button:text-is('Armar eliminatoria')").count() == 0)
    a_home = (await pg.locator(".cl-row:has-text('A · ')").first.inner_text()).split(" · ")[1].split(" vs")[0]
    b_home = (await pg.locator(".cl-row:has-text('B · ')").first.inner_text()).split(" · ")[1].split(" vs")[0]
    await result(pg, a_home, 2, 0); await pg.wait_for_selector(".cl-row:has-text('2 - 0')")
    await result(pg, b_home, 1, 0); await pg.wait_for_selector(".cl-row:has-text('1 - 0')")
    await ttab(pg, "Tabla"); await pg.wait_for_selector("h2:text-is('Grupo A')")
    check("una tabla por grupo con los que pasan marcados", await pg.locator("h2:text-is('Grupo B')").count() == 1 and await pg.locator("table.tbl tr.q").count() == 4)
    await ttab(pg, "Calendario"); await pg.click("button:text-is('Armar eliminatoria')"); await pg.wait_for_selector("#sheet form[data-tform=ko]")
    pre = await pg.inner_text("#sheet form[data-tform=ko]")
    check("cruces: 1º de A contra 2º de B y 1º de B contra 2º de A", f"{a_home} vs" in pre and f"{b_home} vs" in pre, pre)
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd:text-is('Semifinal')")
    await result(pg, a_home, 1, 1); await pg.wait_for_selector("#sheet .msg:has-text('penales')")
    check("un empate en eliminatoria exige penales", True); pg.errors[:] = [e for e in pg.errors if "penales" not in e]
    await pg.fill("#sheet input[name=hp]", "4"); await pg.fill("#sheet input[name=ap]", "3"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('(4-3 pen.)')")
    await result(pg, b_home, 0, 2); await pg.wait_for_selector(".cl-row:has-text('0 - 2')")
    await pg.click("button:text-is('Armar Final')"); await pg.wait_for_selector("#sheet form[data-tform=ko]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd:text-is('Final')")
    final_home = (await pg.locator("h3.rnd:text-is('Final') + .cl-row").inner_text()).split(" vs")[0]
    check("la final es entre los ganadores (el 1º de A abre la llave)", final_home == a_home, [final_home, a_home])
    corr = pg.locator(".cl-row:has-text('(4-3 pen.)')").locator("button:text-is('Corregir')"); await corr.click(); await pg.fill("#sheet input[name=hg]", "0"); await pg.fill("#sheet input[name=ag]", "1"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet .msg:has-text('siguiente ronda')"); check("con la final armada no se corrige la semifinal", True); pg.errors[:] = [e for e in pg.errors if "siguiente ronda" not in e]
    await pg.click("#sheet button.x")
    fin = pg.locator("h3.rnd:text-is('Final') + .cl-row"); await fin.locator("button:text-is('Resultado')").click(); await pg.fill("#sheet input[name=hg]", "3"); await pg.fill("#sheet input[name=ag]", "1"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("h3.rnd:text-is('Final') + .cl-row:has-text('3 - 1')")
    await ttab(pg, "Tabla"); await pg.wait_for_selector(".champ"); champ = await pg.inner_text(".champ")
    check("se declara campeón al ganador de la final", final_home in champ, champ)
    await ttab(pg, "Reglas"); check("las reglas explican el formato", "Grupos y eliminación directa" in await pg.inner_text(".view") and "penales" in await pg.inner_text(".view"))
    # página pública: grupos y llaves
    await tab(pg, "Ajustes"); await pg.check("form[data-lf=pub] input[name=enabled]"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await tab(pg, "Torneos")
    if await pg.locator(".cl-row:has-text('Copa Grupos') button:text-is('Abrir')").count(): await pg.locator(".cl-row:has-text('Copa Grupos')").locator("button:text-is('Abrir')").click()
    await pg.wait_for_selector(".cl-who:has-text('Copa Grupos')"); await pg.click("text=Publicar"); await pg.wait_for_selector(".cl-who:has-text('Publicado')")
    tid = await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).tourn.find(t => t.name === 'Copa Grupos').id")
    await pg.goto(B + f"#/p/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl")
    check("página pública: tablas por grupo", await pg.locator("h3:text-is('Grupo A')").count() == 1 and await pg.locator("h3:text-is('Grupo B')").count() == 1)
    await pg.click("[data-pt=llaves]"); await pg.wait_for_selector(".bracket")
    check("página pública: llaves con penales y campeón", "(4-3 pen.)" in await pg.inner_text(".bracket") and final_home in await pg.inner_text(".champ"))
    check("las llaves caben en el móvil", await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
