import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
from PIL import Image, ImageDraw

CREST = "/tmp/claude-0/crest.png"
im = Image.new("RGBA", (200, 200), (0, 0, 0, 0)); ImageDraw.Draw(im).ellipse((20, 20, 180, 180), fill=(200, 30, 120, 255)); im.save(CREST)   # círculo magenta

async def sheet_btn(pg, text): await pg.click(f"#sheet >> text={text}")
async def go(pg, v): await pg.goto(B + f"#/los-halcones/principal/{v}"); await pg.wait_for_selector(".tabbar")
async def set_plan(pg, plan):
    await pg.evaluate("""(plan) => { const d = JSON.parse(localStorage.getItem('demo-db')); d.subs = d.subs.filter(s => s.subject_id !== 'los-halcones/principal');
      if (plan) d.subs.push({ subject_type: 'team', subject_id: 'los-halcones/principal', plan_id: plan, source: 'manual', status: 'active' }); localStorage.setItem('demo-db', JSON.stringify(d)); }""", plan)

async def main():
    p, br, pg = await browser()
    await signup(pg, "beto@eq.com", ["team"])
    await pg.fill("form[data-pf=team] input[name=nm]", "Los Halcones"); await pg.click("form[data-pf=team] label.opt:has-text('Fútbol 9')"); await pg.click("text=Crear equipo")
    await pg.wait_for_selector("text=Agregar jugador")
    check("el equipo se crea en fútbol 9", await pg.evaluate("window.__ctx().team.format") == 9)

    # ---- plantel
    await pg.click("text=Agregar jugador")
    for n, num, pos in [("Carlos Ruiz", "9", "DC"), ("Luis Pérez", "1", "POR"), ("Memo Soto", "5", "DFC")]:
        await pg.fill("#sheet input[name=nm]", n); await pg.fill("#sheet input[name=num]", num); await pg.select_option("#sheet select", pos)
        await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(f"#sheet .ok-note:has-text('{n}')")
    await pg.click("#sheet button.x"); await pg.click("text=Administrar jugadores"); await pg.wait_for_selector("#sheet >> text=Memo Soto")
    check("el plantel lista a los 3 jugadores", await pg.locator("#sheet .cl-row").count() == 3)
    await pg.locator("#sheet .cl-row", has_text="Memo Soto").locator("text=Editar").click()
    await pg.fill("#sheet input[name=nm]", "Guillermo Soto"); await pg.fill("#sheet input[name=num]", "55"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet >> text=#55 Guillermo Soto"); check("editar nombre y dorsal", await pg.locator("#sheet >> text=Memo Soto").count() == 0)
    await pg.locator("#sheet .cl-row", has_text="Luis Pérez").locator("text=Dar de baja").click(); await pg.wait_for_selector("#sheet >> text=dado de baja")
    check("dar de baja conserva al jugador", await pg.evaluate("window.__ctx().team.roster.length") == 3 and await pg.evaluate("window.__ctx().team.roster.filter(r=>r.status==='congelado').length") == 1)
    await pg.locator("#sheet .cl-row", has_text="Luis Pérez").locator("text=Reactivar").click(); await pg.wait_for_selector("#sheet .cl-row:not(.off) >> text=Luis Pérez"); check("reactivar jugador", await pg.evaluate("window.__ctx().team.roster.filter(r=>r.status==='congelado').length") == 0)
    await pg.click("#sheet button.x")

    # ---- alineación del formato
    await go(pg, "alineacion"); await pg.wait_for_selector(".pitch, #lineup")
    nslots = await pg.evaluate("document.querySelectorAll('#lineup [data-slot], #lineup .slot').length")
    check("la alineación de fútbol 9 tiene 9 puestos", nslots == 9, nslots)

    # ---- calendario
    await go(pg, "partidos"); await pg.click("text=Agregar partido")
    await pg.fill("#sheet input[name=rival]", "Cañoneros"); await pg.fill("#sheet input[name=date]", "2030-11-01T09:10"); await pg.fill("#sheet input[name=jornada]", "J1"); await pg.fill("#sheet input[name=venue]", "Cancha 2")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("#sheet >> text=Cañoneros")
    await pg.click("#sheet >> text=Agregar partido"); await pg.fill("#sheet input[name=rival]", "Tigres"); await pg.fill("#sheet input[name=date]", "2026-10-01T09:10")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("#sheet >> text=Tigres"); check("agregar dos partidos", await pg.locator("#sheet .cl-row").count() == 2)
    await pg.locator("#sheet .cl-row", has_text="Cañoneros").locator("text=Editar").click(); await pg.fill("#sheet input[name=rival]", "Cañoneros FC"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet >> text=Cañoneros FC"); check("editar partido", await pg.locator("#sheet >> text=Cañoneros FC").count() == 1)
    await pg.click("#sheet button.x"); await pg.wait_for_selector("text=Anotar resultado")
    await pg.click("text=Anotar resultado"); await pg.fill("#sheet input[name=sf]", "3"); await pg.fill("#sheet input[name=sa]", "1")
    await pg.locator("#sheet label.opt").first.click(); await pg.click("#sheet button[type=submit]")
    await go(pg, "partidos"); await pg.click("text=Administrar calendario"); await pg.wait_for_selector("#sheet >> text=resultado 3-1")
    check("el resultado se registra en el partido", await pg.locator("#sheet .cl-row", has_text="Tigres").count() == 1)
    check("un partido con resultado no se puede quitar", await pg.locator("#sheet .cl-row", has_text="Tigres").locator("text=Quitar").count() == 0)
    await pg.locator("#sheet .cl-row", has_text="Cañoneros FC").locator("text=Quitar").click()
    await pg.wait_for_function("document.querySelectorAll('#sheet .cl-row').length === 1"); check("quitar un partido sin resultado", await pg.locator("#sheet >> text=Cañoneros").count() == 0)
    await pg.click("#sheet button.x")

    # ---- ajustes, escudo y plan gratis
    await go(pg, "inicio"); await pg.click("text=Ajustes y escudo"); await pg.wait_for_selector("#sheet >> text=Colores propios")
    check("sin Pro los colores propios se ofrecen como Pro", await pg.locator("#sheet input[name=primary]").count() == 0)
    await pg.fill("#sheet input[name=nm]", "Halcones del Norte"); await pg.fill("#sheet input[name=comp]", "Liga Reforma"); await pg.click("#sheet label.opt:has-text('Fútbol 7')")
    await pg.set_input_files("#sheet input[name=crest]", CREST); await pg.click("#sheet button[type=submit]"); await toast(pg, "Ajustes guardados")
    await pg.wait_for_function("window.__ctx().club.name === 'Halcones del Norte' && window.__ctx().team.format === 7")
    check("nombre, torneo y modalidad se guardan", await pg.evaluate("window.__ctx().team.competition") == "Liga Reforma")
    check("el escudo se guarda y se muestra", (await pg.evaluate("window.__ctx().club.crest")).startswith("data:image/png") and (await pg.get_attribute(".top-cr", "src")).startswith("data:image/png"))
    check("sin Pro las calificaciones, las finanzas y los colores están deshabilitados", await pg.evaluate("!window.__ctx().live.can('ratings') && !window.__ctx().live.can('finance') && !window.__ctx().live.can('themes')"))
    await pg.goto(B + "#/los-halcones/principal/inicio"); await pg.wait_for_selector("text=Finanzas"); await pg.click(".row-acts >> text=Finanzas"); await pg.wait_for_selector("#sheet >> text=plan Pro")
    check("sin Pro las finanzas se ofrecen como Pro", await pg.locator("#sheet form").count() == 0); await pg.click("#sheet button.x")
    check("sin Pro no hay pestaña de Finanzas", await pg.locator(".tabbar >> text=Finanzas").count() == 0)

    # ---- con Pro: colores y finanzas
    await set_plan(pg, "team-pro"); await pg.reload(); await pg.wait_for_selector(".tabbar")
    await pg.click("text=Ajustes y escudo"); await pg.wait_for_selector("#sheet input[name=primary]")
    await pg.set_input_files("#sheet input[name=crest]", CREST); await pg.wait_for_function("document.querySelector('#sheet input[name=primary]').value !== '#1f9d61'", timeout=5000)
    col = await pg.input_value("#sheet input[name=primary]"); r, g, b = (int(col[i:i+2], 16) for i in (1, 3, 5))
    check("el color sacado del escudo es el magenta del círculo", r > 150 and b > 80 and g < 90, col)
    await pg.click("#sheet label.opt:has-text('Redonda')"); await pg.click("#sheet button[type=submit]"); await toast(pg, "Ajustes guardados")
    await pg.wait_for_function("window.__ctx().club.theme.colors.primary !== '#1f9d61'")
    check("el tema se aplica a la app", await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--red').trim()") == col and await pg.evaluate("document.documentElement.dataset.card") == "redonda")
    check("con Pro las calificaciones y las finanzas están habilitadas", await pg.evaluate("window.__ctx().live.can('ratings') && window.__ctx().live.can('finance') && window.__ctx().live.can('themes')"))

    await go(pg, "inicio"); await pg.click(".row-acts >> text=Finanzas"); await pg.wait_for_selector("#sheet input[name=cuota]")
    await pg.fill("#sheet input[name=cuota]", "350"); await pg.fill("#sheet input[name=liga_label]", "Inscripción"); await pg.fill("#sheet input[name=liga_costo]", "2500")
    await pg.fill("#sheet input[name=gastos_label]", "Árbitro"); await pg.fill("#sheet input[name=gastos_costo]", "300")
    await pg.fill("#sheet input[name=multa]", "200"); await pg.click("#sheet label.opt:has-text('Carlos Ruiz')")
    await pg.click("#sheet button[type=submit]"); await toast(pg, "Finanzas guardadas"); await pg.wait_for_selector(".tabbar >> text=Finanzas")
    check("aparece la pestaña de Finanzas", await pg.locator(".tabbar >> text=Finanzas").count() == 1)
    await pg.click(".tabbar >> text=Finanzas"); await pg.wait_for_selector("#falta")
    txt = await pg.inner_text("#view")
    check("Finanzas muestra conceptos y totales", "Inscripción" in txt and "Árbitro" in txt and "$2,500" in txt, txt[:300])
    check("sin errores de división (NaN/Infinity)", "NaN" not in txt and "Infinity" not in txt)

    # registrar pagos desde el panel
    await go(pg, "inicio"); await pg.click("text=Panel de administrador"); await pg.wait_for_selector("#sheet >> text=Registrar un pago")
    await pg.click("#sheet >> text=De un jugador"); await pg.select_option("#sheet select[name=player]", label="Carlos Ruiz"); await pg.fill("#sheet input[name=amount]", "550"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet >> text=Pago registrado")
    await pg.click("#sheet >> text=Otro ingreso"); await pg.fill("#sheet input[name=detail]", "Patrocinio tienda"); await pg.fill("#sheet input[name=amount]", "1000"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet >> text=Pago registrado")
    await pg.click("#sheet >> text=A la liga o gasto"); await pg.fill("#sheet input[name=amount]", "300"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("#sheet >> text=Pago registrado")
    await pg.click("#sheet button.x"); await go(pg, "finanzas"); await pg.wait_for_selector("#caja")
    caja = await pg.inner_text("#caja"); await pg.click("#movimientos summary"); mov = await pg.inner_text("#movimientos")
    check("la caja suma cuotas e ingresos y resta pagos (550+1000-300=1,250)", "$1,250" in caja, caja)
    check("el ingreso aparece en la caja", "Patrocinio tienda" in caja)
    check("el historial lista los 3 movimientos", mov.count("$") >= 3 and "Cuota" in mov and "Ingreso" in mov and "Pago" in mov, mov)

    # regreso al plan gratis: lo guardado se conserva, el administrador ya no registra
    await set_plan(pg, None); await pg.reload(); await pg.wait_for_selector(".tabbar")
    check("al volver a gratis las finanzas guardadas se conservan", await pg.locator(".tabbar >> text=Finanzas").count() == 1)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
