import asyncio, sys, os, re, base64
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
IMG = {"name": "foto.png", "mimeType": "image/png", "buffer": PNG}

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")

async def main():
    p, br, pg = await browser()
    # --- la liga, su torneo y una invitación para equipos
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    check("siete secciones caben en el móvil sin desbordar", await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1)
    await tab(pg, "Equipos"); await pg.fill("form[data-lf=invite] input[name=label]", "Otoño"); await pg.click("text=Crear código"); await pg.wait_for_selector(".code"); code = await pg.inner_text(".code")
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.fill("#sheet input[name=season]", "Otoño 2026"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    for n in ["Rayos", "Lobos"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await signout(pg)
    # --- el delegado crea su equipo y se vincula
    await signup(pg, "beto@eq.com", ["team"])
    await pg.fill("form[data-pf=team] input[name=nm]", "Los Halcones"); await pg.click("text=Crear equipo"); await pg.wait_for_selector("text=Agregar jugador")
    await pg.goto(B + "#/cuenta"); await pg.wait_for_selector("text=Vincular con una liga"); await pg.fill("input[name=code]", code); await pg.click("text=Pedir vinculación"); await toast(pg, "Solicitud enviada")
    await signout(pg)
    await signin(pg, "ana@liga.com"); await pg.click("text=Liga Reforma"); await pg.wait_for_selector(".tabbar"); await tab(pg, "Equipos"); await pg.click("text=Aprobar"); await toast(pg, "vinculado")
    await tab(pg, "Torneos")
    if await pg.locator("button:text-is('Abrir')").count(): await pg.click("button:text-is('Abrir')")
    await pg.wait_for_selector("button[role=tab]:text-is('Equipos')"); await pg.click("button[role=tab]:text-is('Equipos')"); await pg.wait_for_selector("form[data-lf=addteam] select[name=link]")
    await pg.select_option("form[data-lf=addteam] select[name=link]", index=1); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Equipo de la app')")
    check("el equipo de la app se inscribe al torneo", True)

    # --- sin aviso de privacidad no se registra a nadie; la liga lo publica desde la plantilla
    await tab(pg, "Jugadores"); await pg.wait_for_selector("text=Registrar jugador")
    check("sin aviso de privacidad se avisa que no se puede registrar", await pg.locator(".msg:has-text('aviso de privacidad')").count() >= 1)
    await pg.click("button:text-is('Registrar jugador')"); await pg.wait_for_selector("#sheet input[name=name]")
    check("y el botón de registrar está apagado", await pg.locator("#sheet button[type=submit][disabled]").count() == 1); await pg.click("#sheet button.x")
    await tab(pg, "Ajustes"); await pg.wait_for_selector("form[data-lf=privacy]"); await pg.click("button:text-is('Usar plantilla para revisar')")
    check("la plantilla trae partes por completar entre corchetes", "[" in await pg.input_value("form[data-lf=privacy] textarea[name=notice]"))
    await pg.fill("form[data-lf=privacy] input[name=contact]", "privacidad@liga.mx"); await pg.click("form[data-lf=privacy] button[type=submit]"); await toast(pg, "versión 1")
    # --- registro en oficina con foto
    await tab(pg, "Jugadores"); await pg.wait_for_selector("text=Registrar jugador")
    await pg.click("button:text-is('Registrar jugador')"); await pg.wait_for_selector("#sheet input[name=name]")
    await pg.select_option("#sheet select[name=team]", index=0)
    await pg.fill("#sheet input[name=name]", "Juan Pérez"); await pg.fill("#sheet input[name=birth]", "2000-05-01"); await pg.fill("#sheet input[name=number]", "9"); await pg.set_input_files("#sheet input[name=photo]", IMG)
    await pg.check("#sheet input[name=accept]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".pl:has-text('Juan Pérez')")
    check("registro en oficina: jugador activo con su equipo y número", "#9" in await pg.inner_text(".pl:has-text('Juan Pérez')"))
    check("la foto se muestra en el padrón", await pg.locator(".pl:has-text('Juan Pérez') .pl-ph img").count() == 1)
    # duplicado: misma persona, otro equipo, otro formato del nombre
    await pg.click("button:text-is('Registrar jugador')"); await pg.wait_for_selector("#sheet input[name=name]")
    await pg.select_option("#sheet select[name=team]", index=1)
    await pg.fill("#sheet input[name=name]", "JUAN PEREZ"); await pg.fill("#sheet input[name=birth]", "2000-05-01"); await pg.check("#sheet input[name=accept]"); await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector("#sheet .msg:has-text('ya está inscrito en otro equipo')"); check("la misma persona no se duplica ni juega en dos equipos del torneo", True)
    pg.errors[:] = [e for e in pg.errors if "ya está inscrito" not in e]
    await pg.click("#sheet button.x")
    check("sigue habiendo un solo jugador en el padrón", await pg.locator(".pl").count() == 1)
    # búsqueda
    await pg.fill("[data-search]", "perez"); check("la búsqueda ignora acentos", await pg.locator(".pl:visible").count() == 1)
    await pg.fill("[data-search]", "zzz"); check("la búsqueda oculta lo que no coincide", await pg.locator(".pl:visible").count() == 0); await pg.fill("[data-search]", "")

    # --- reglas: foto obligatoria
    await pg.select_option("form[data-lf=rules] select[name=photo]", "required"); await pg.click("form[data-lf=rules] button[type=submit]"); await toast(pg, "Reglas guardadas")
    await pg.click("button:text-is('Registrar jugador')"); await pg.wait_for_selector("#sheet input[name=photo][required]"); check("con foto obligatoria el formulario la exige", True); await pg.click("#sheet button.x")

    # --- enlace de registro, sin cuenta
    await pg.select_option("form[data-lf=mklink] select[name=team]", index=1); await pg.fill("form[data-lf=mklink] input[name=max]", "5"); await pg.click("form[data-lf=mklink] button[type=submit]")
    await pg.wait_for_selector(".inv .code"); lcode = await pg.inner_text(".inv .code"); check("se crea un enlace de registro", re.fullmatch(r"[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}", lcode), lcode)
    await signout(pg)
    await pg.goto(B + "#/registro/" + lcode); await pg.wait_for_selector("form[data-pf=reglink]")
    check("quien recibe el enlace ve solo liga, torneo y equipo", "lobos" in (await pg.inner_text("#view")).lower() and "liga reforma" in (await pg.inner_text(".top")).lower())
    check("el aviso de privacidad se muestra antes de enviar", await pg.locator("details.privacy").count() == 1 and "privacidad@liga.mx" in await pg.text_content("details.privacy"))
    await pg.fill("form[data-pf=reglink] input[name=name]", "Hugo Paz"); await pg.fill("form[data-pf=reglink] input[name=birth]", "2002-02-02")
    check("un adulto no ve los datos del tutor", await pg.locator(".guardian:visible").count() == 0)
    await pg.check("form[data-pf=reglink] input[name=accept]"); await pg.click("form[data-pf=reglink] button[type=submit]"); await pg.wait_for_selector("text=Recibimos tus datos para Lobos")
    # menor de edad: se piden madre, padre o tutor
    await pg.goto(B + "#/registro/" + lcode); await pg.reload(); await pg.wait_for_selector("form[data-pf=reglink]")
    await pg.fill("form[data-pf=reglink] input[name=name]", "Niña Prueba"); await pg.fill("form[data-pf=reglink] input[name=birth]", "2014-04-04"); await pg.check("form[data-pf=reglink] input[name=accept]")
    check("si es menor aparecen los datos del tutor y son obligatorios", await pg.locator(".guardian:visible input[name=guardian][required]").count() == 1)
    await pg.fill("form[data-pf=reglink] input[name=guardian]", "Rosa Prueba"); await pg.check("form[data-pf=reglink] input[name=gok]"); await pg.click("form[data-pf=reglink] button[type=submit]"); await pg.wait_for_selector("text=Recibimos tus datos para Lobos")
    # alguien que ya está inscrito recibe la misma respuesta (no se revela en qué equipo está)
    await pg.goto(B + "#/registro/" + lcode); await pg.reload(); await pg.wait_for_selector("form[data-pf=reglink]")
    await pg.fill("form[data-pf=reglink] input[name=name]", "Juan Pérez"); await pg.fill("form[data-pf=reglink] input[name=birth]", "2000-05-01"); await pg.check("form[data-pf=reglink] input[name=accept]"); await pg.click("form[data-pf=reglink] button[type=submit]")
    await pg.wait_for_selector("text=Recibimos tus datos para Lobos"); check("enlace: un ya inscrito ve lo mismo que alguien nuevo (sin pistas)", "Rayos" not in await pg.inner_text("#view"))
    await pg.goto(B + "#/registro/AAAA-BBBB-CCCC"); await pg.wait_for_selector("text=Enlace no válido"); check("un enlace falso no abre el formulario", True)

    # --- el delegado registra a un jugador
    await signin(pg, "beto@eq.com"); await pg.wait_for_selector("button:text-is('Registrar jugadores')"); await pg.click("button:text-is('Registrar jugadores')"); await pg.wait_for_selector("#sheet input[name=name]")
    await pg.fill("#sheet input[name=name]", "Carlos Soto"); await pg.fill("#sheet input[name=birth]", "1996-06-06"); await pg.check("#sheet input[name=accept]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("#sheet h3:text-is('Lo que has enviado')")
    check("el delegado ve su envío como pendiente", "pendiente" in (await pg.inner_text("#sheet")).lower())
    await pg.click("#sheet button.x"); await signout(pg)

    # --- la liga aprueba (la foto es obligatoria)
    await signin(pg, "ana@liga.com"); await pg.click("text=Liga Reforma"); await pg.wait_for_selector(".tabbar"); await tab(pg, "Jugadores"); await pg.wait_for_selector("text=Por revisar")
    check("llegan tres pendientes: dos del enlace y el del delegado (el duplicado no)", await pg.locator("button:text-is('Aprobar')").count() == 3)
    check("el pendiente del menor muestra quién lo autorizó", "Rosa Prueba" in await pg.inner_text(".cl-row:has-text('Niña Prueba')"))
    await pg.locator(".cl-row:has-text('Carlos Soto')").locator("button:text-is('Aprobar')").click(); await pg.wait_for_selector("#sheet input[name=photo][required]")
    await pg.fill("#sheet input[name=number]", "10"); await pg.set_input_files("#sheet input[name=photo]", IMG); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".pl:has-text('Carlos Soto'):has-text('#10')")
    check("aprobado con foto y número", True)
    await pg.locator(".cl-row:has-text('Hugo Paz')").locator("button:text-is('Rechazar')").click(); await toast(pg, "Registro rechazado"); check("un pendiente se puede rechazar", await pg.locator("button:text-is('Aprobar')").count() == 1)

    # --- baja y credenciales
    await pg.evaluate("window.__printed = null; window.print = () => { window.__printed = document.getElementById('print-root').innerHTML; }; 0")
    await pg.locator(".pl:has-text('Juan Pérez')").locator("button:text-is('Credencial')").click(); await pg.wait_for_function("window.__printed")
    html = await pg.evaluate("window.__printed")
    check("la credencial lleva nombre, número, equipo, torneo y código", all(x in html for x in ["Juan Pérez", "#9", "Rayos", "Apertura", "Credencial "]), html[:300])
    check("la credencial no lleva documento ni fecha de nacimiento", "2000" not in html and "doc" not in html.lower().replace("<div", ""))
    await pg.evaluate("window.__printed = null"); await pg.click("button:text-is('Todo el torneo')"); await pg.wait_for_function("window.__printed")
    check("la hoja del torneo imprime una credencial por jugador activo", (await pg.evaluate("window.__printed")).count('class="cred"') == 2)
    # marca
    await tab(pg, "Ajustes"); await pg.wait_for_selector("form[data-lf=brand]"); await pg.fill("form[data-lf=brand] input[name=color]", "#1a5cff") if False else await pg.evaluate("(()=>{const i=document.querySelector('form[data-lf=brand] input[name=color]'); i.value='#1a5cff'; i.dispatchEvent(new Event('input',{bubbles:true}));})()")
    await pg.set_input_files("form[data-lf=brand] input[name=logo]", IMG); await pg.click("form[data-lf=brand] button[type=submit]"); await toast(pg, "Marca guardada")
    await tab(pg, "Jugadores"); await pg.evaluate("window.__printed = null; window.print = () => { window.__printed = document.getElementById('print-root').innerHTML; }; 0")
    await pg.locator(".pl:has-text('Juan Pérez')").locator("button:text-is('Credencial')").click(); await pg.wait_for_function("window.__printed")
    html = await pg.evaluate("window.__printed"); check("la credencial usa el color y el logo de la liga", "--cc:#1a5cff" in html and "data:image" in html.split("cred-h")[1][:300], html[:400])
    # baja
    pg.dialog_text = "Se mudó"
    await pg.locator(".pl:has-text('Juan Pérez')").locator("button:text-is('Baja')").click(); await toast(pg, "Baja registrada")
    # derecho a borrar
    await pg.locator(".pl:has-text('Niña Prueba')").locator("button:text-is('Editar')").click(); await pg.wait_for_selector("#sheet details.danger")
    await pg.click("#sheet details.danger summary"); await pg.click("#sheet button:has-text('Borrar datos de')"); await toast(pg, "Datos borrados")
    check("borrar datos deja un registro anónimo", await pg.locator(".pl:has-text('Niña Prueba')").count() == 0 and await pg.locator(".pl:has-text('Jugador eliminado')").count() == 1)
    check("la baja libera al jugador pero lo conserva en el padrón", await pg.locator(".pl:has-text('Juan Pérez')").count() == 1 and "Rayos" not in await pg.inner_text(".pl:has-text('Juan Pérez')"))
    log = await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).audit.map(a=>a.action)")
    check("la bitácora registra altas, envíos, aprobaciones y bajas", all(a in log for a in ["player.register", "player.submit", "player.approve", "player.reject", "player.remove", "reglink.create", "registration.rules", "league.brand", "privacy.update", "player.submit_duplicate", "player.forget"]), log)
    check("sin desbordamiento horizontal en móvil", await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
