"""Prueba integral (modo demo): los 10 flujos principales de punta a punta, en orden, con varias cuentas.
1 cuenta y liga · 2 invitación y vínculo · 3 Pro de la liga y Pro propio · 4 registro por ambas vías y credenciales
5 torneo, calendario y resultados · 6 tabla y goleo · 7 sanción, objeción y movimiento · 8 página pública e iframe sin fugas
9 acta: subir, revisar, confirmar · 10 sin permisos no se lee ni se modifica lo ajeno.
Lo que depende de Supabase real (correo, Google, almacenamiento, IPs) está en supabase/LEEME.md §6."""
import asyncio, sys, os, re, base64
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
IMG = {"name": "foto.png", "mimeType": "image/png", "buffer": PNG}

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")

async def liga(pg):
    await signin(pg, "ana@liga.com"); await pg.click("text=Liga Reforma"); await pg.wait_for_selector(".tabbar")

async def open_tournament(pg):
    await tab(pg, "Torneos")
    if await pg.locator("button:text-is('Abrir')").count(): await pg.click("button:text-is('Abrir')")
    await pg.wait_for_selector(".cl-who")

async def main():
    p, br, pg = await browser()
    # 1. cuenta y liga
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    lid = pg.url.split("#/liga/")[1].split("/")[0]
    check("1. se crea la cuenta y la liga", lid == "liga-reforma", lid)

    # 2. invitación y vínculo
    await tab(pg, "Equipos"); await pg.fill("input[name=slots]", "1"); await pg.click("text=Activar contrato de prueba"); await pg.wait_for_selector("text=0 de 1 equipos con Pro")
    await pg.fill("form[data-lf=invite] input[name=label]", "Otoño"); await pg.click("text=Crear código"); await pg.wait_for_selector(".code"); code = await pg.inner_text(".code")
    await signout(pg)
    await signup(pg, "beto@eq.com", ["team"])
    await pg.fill("form[data-pf=team] input[name=nm]", "Los Halcones"); await pg.click("text=Crear equipo"); await pg.wait_for_selector("text=Agregar jugador")
    await pg.goto(B + "#/cuenta"); await pg.wait_for_selector("text=Vincular con una liga"); await pg.fill("input[name=code]", code); await pg.click("text=Pedir vinculación"); await toast(pg, "Solicitud enviada")
    await signout(pg)
    await liga(pg); await tab(pg, "Equipos"); await pg.click("text=Aprobar"); await toast(pg, "vinculado con Pro"); await pg.wait_for_selector("text=1 de 1 equipos con Pro")
    check("2. la invitación vincula al equipo con la liga", await pg.locator(".cl-row:has-text('Los Halcones')").count() >= 1)
    await signout(pg)

    # 3a. Pro concedido por la liga
    await signin(pg, "beto@eq.com"); await pg.wait_for_selector(".cl-row .chip.ok:has-text('Equipo Pro')")
    check("3. el equipo vinculado recibe Pro de la liga", "Pro de la liga" in await pg.inner_text("body"))
    await signout(pg)

    # 4. registro por ambas vías y credenciales (con aviso de privacidad)
    await liga(pg); await tab(pg, "Ajustes"); await pg.click("button:text-is('Usar plantilla para revisar')"); await pg.fill("form[data-lf=privacy] input[name=contact]", "privacidad@liga.mx")
    await pg.click("form[data-lf=privacy] button[type=submit]"); await toast(pg, "versión 1")
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    for n in ["Rayos", "Lobos"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await pg.select_option("form[data-lf=addteam] select[name=link]", index=1); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Equipo de la app')")
    await tab(pg, "Jugadores"); await pg.click("button:text-is('Registrar jugador')"); await pg.wait_for_selector("#sheet input[name=name]")
    await pg.select_option("#sheet select[name=team]", label=[o for o in await pg.locator("#sheet select[name=team] option").all_inner_texts() if o.startswith("Rayos")][0])
    await pg.fill("#sheet input[name=name]", "Juan Pérez"); await pg.fill("#sheet input[name=birth]", "2000-05-01"); await pg.fill("#sheet input[name=number]", "9"); await pg.set_input_files("#sheet input[name=photo]", IMG)
    await pg.check("#sheet input[name=accept]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".pl:has-text('Juan Pérez')")
    await pg.select_option("form[data-lf=mklink] select[name=team]", label=[o for o in await pg.locator("form[data-lf=mklink] select[name=team] option").all_inner_texts() if o.startswith("Lobos")][0])
    await pg.click("form[data-lf=mklink] button[type=submit]"); await pg.wait_for_selector(".inv .code"); lcode = await pg.inner_text(".inv .code")
    await signout(pg)
    await pg.goto(B + "#/registro/" + lcode); await pg.wait_for_selector("form[data-pf=reglink]")
    await pg.fill("form[data-pf=reglink] input[name=name]", "Hugo Paz"); await pg.fill("form[data-pf=reglink] input[name=birth]", "2002-02-02"); await pg.check("form[data-pf=reglink] input[name=accept]")
    await pg.click("form[data-pf=reglink] button[type=submit]"); await pg.wait_for_selector("text=Recibimos tus datos para Lobos")
    await signin(pg, "beto@eq.com"); await pg.click("button:text-is('Registrar jugadores')"); await pg.wait_for_selector("#sheet input[name=name]")
    await pg.fill("#sheet input[name=name]", "Carlos Soto"); await pg.fill("#sheet input[name=birth]", "1996-06-06"); await pg.check("#sheet input[name=accept]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("#sheet h3:text-is('Lo que has enviado')")
    await pg.click("#sheet button.x"); await signout(pg)
    await liga(pg); await tab(pg, "Jugadores"); await pg.wait_for_selector("text=Por revisar")
    for n in ["Hugo Paz", "Carlos Soto"]:
        await pg.locator(f".cl-row:has-text('{n}')").locator("button:text-is('Aprobar')").click(); await pg.wait_for_selector("#sheet button[type=submit]"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(f".pl:has-text('{n}')")
    check("4. registro en oficina, por enlace y por delegado: tres jugadores activos", await pg.locator("button:text-is('Aprobar')").count() == 0 and await pg.locator(".pl").count() == 3)
    await pg.evaluate("window.__printed = null; window.print = () => { window.__printed = document.getElementById('print-root').innerHTML; }; 0")
    await pg.click("button:text-is('Todo el torneo')"); await pg.wait_for_function("window.__printed"); html = await pg.evaluate("window.__printed")
    check("4. credenciales de todo el torneo, sin fecha de nacimiento", html.count('class="cred"') == 3 and "2000-05-01" not in html and "1996" not in html)

    # 5. calendario y resultados
    await open_tournament(pg); await pg.click("button[role=tab]:text-is('Calendario')"); await pg.click("text=Generar calendario"); await pg.fill("#sheet input[name=start]", "2026-11-01T10:00"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd")
    rl = pg.locator(".cl-row:has-text('Rayos'):has-text(' vs '):has-text('Lobos')").first
    await rl.locator("text=Resultado").click(); await pg.fill("#sheet input[name=hg]", "2"); await pg.fill("#sheet input[name=ag]", "0")
    for _ in range(2):
        await pg.click("#sheet >> text=+ Agregar gol o tarjeta")
    await pg.locator("#sheet .ev input[name=ev_player]").nth(0).fill("Juan Pérez"); await pg.locator("#sheet .ev input[name=ev_player]").nth(1).fill("Juan Pérez")
    await pg.click("#sheet button[type=submit]")
    await pg.wait_for_selector(".cl-row:has-text('2 - 0')")
    check("5. torneo con calendario de 3 partidos y un resultado", await pg.locator(".cl-row:has-text(' vs ')").count() == 2 and await pg.locator(".cl-row:has-text('2 - 0')").count() == 1)

    # 6. tabla y goleo
    await pg.click("button[role=tab]:text-is('Tabla')"); await pg.wait_for_selector("table.tbl"); rows = await pg.locator("table.tbl tbody tr").all_inner_texts()
    check("6. tabla: Rayos primero con 3 puntos", rows[0].split("\t")[1].startswith("Rayos") and rows[0].split("\t")[-1].strip() == "3", rows)
    await pg.click("button[role=tab]:text-is('Goleo')"); await pg.wait_for_selector("table.tbl")
    check("6. goleo: Juan Pérez con 2", "Juan Pérez" in (g := await pg.inner_text("table.tbl")) and g.strip().endswith("2"), g)

    # 7. sanción, objeción y movimiento financiero
    await tab(pg, "Sanciones"); await pg.click("text=Nueva sanción"); await pg.wait_for_selector("#sheet select[name=team]")
    await pg.select_option("#sheet select[name=team]", label=[o for o in await pg.locator("#sheet select[name=team] option").all_inner_texts() if o.startswith("Lobos")][0]); await pg.select_option("#sheet select[name=kind]", "multa"); await pg.fill("#sheet textarea[name=reason]", "No se presentó a tiempo"); await pg.fill("#sheet input[name=amount]", "300")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Multa: No se presentó a tiempo')")
    await pg.click("text=Registrar objeción o protesta"); await pg.fill("#sheet input[name=subject]", "Cancha en mal estado"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Objeción: Cancha en mal estado')")
    await tab(pg, "Finanzas"); await pg.click("text=Registrar ingreso o gasto"); await pg.fill("#sheet input[name=concept]", "Pago a árbitros"); await pg.fill("#sheet input[name=amount]", "400"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector(".cl-row:has-text('Pago a árbitros')")
    log = await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).audit.map(a=>a.action)")
    check("7. sanción, objeción y movimiento quedan en la bitácora", all(a in log for a in ["sanction.create", "dispute.file"]) and any(a.startswith("movement.") for a in log), log[-8:])

    # 8. página pública e iframe sin datos privados
    await tab(pg, "Ajustes"); await pg.check("form[data-lf=pub] input[name=enabled]"); await pg.select_option("form[data-lf=pub] select[name=names]", "initials"); await pg.click("form[data-lf=pub] button[type=submit]"); await toast(pg, "Página pública guardada")
    await open_tournament(pg); await pg.click("text=Publicar"); await pg.wait_for_selector(".cl-who:has-text('Publicado')")
    tid = await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).tourn[0].id")
    await pg.goto(B + f"#/p/{lid}/{tid}/goleo"); await pg.reload(); await pg.wait_for_selector("table.tbl"); html = await pg.content()
    PRIV = ["2000-05-01", "2002-02-02", "1996-06-06", "beto@eq.com", "ana@liga.com", "No se presentó", "Cancha en mal estado", "Pago a árbitros", "Pérez", "data:image"]
    check("8. página pública: goleo con iniciales y sin datos privados", "Juan P." in html and not [x for x in PRIV if x in html], [x for x in PRIV if x in html])
    await pg.goto(B + f"#/embed/{lid}/{tid}/tabla"); await pg.reload(); await pg.wait_for_selector("table.tbl"); html = await pg.content()
    check("8. iframe: solo la tabla, sin datos privados", await pg.locator("header.top").count() == 0 and not [x for x in PRIV if x in html], [x for x in PRIV if x in html])

    # 9. acta: subir, revisar lo detectado y confirmar
    await pg.goto(B + f"#/liga/{lid}/torneos"); await pg.reload(); await open_tournament(pg); await pg.click("button[role=tab]:text-is('Calendario')"); await pg.wait_for_selector("h3.rnd")
    await pg.locator(".cl-row:has-text(' vs ')").first.locator("button:text-is('Acta')").click(); await pg.wait_for_selector("#sheet input[type=file]")
    await pg.set_input_files("#sheet input[name=photo]", IMG); await pg.click("#sheet button:text-is('Subir foto')"); await pg.wait_for_selector("#sheet img.acta-img")
    home = (await pg.inner_text("#sheet .sp-h p")).split(" vs ")[0]
    await pg.fill("#sheet textarea[name=text]", f"Marcador: 1 - 1\nGol: Pepe ({home})"); await pg.click("#sheet button:text-is('Interpretar texto')"); await pg.wait_for_selector("#sheet .ev")
    check("9. el acta propone marcador y goleador para revisar", await pg.input_value("#sheet input[name=hg]") == "1" and await pg.locator("#sheet .ev").count() == 1)
    await pg.click("#sheet button:text-is('Confirmar y registrar resultado')"); await toast(pg, "Resultado registrado desde el acta")
    await pg.wait_for_selector(".cl-row:has-text('1 - 1')"); check("9. al confirmar, el resultado del acta es oficial", True)

    # 10. sin permisos no se lee ni se modifica lo ajeno (control: la dueña sí lee lo mismo con la misma llamada)
    ctl = await pg.evaluate(f"""(async () => {{ const {{ api }} = await import('./app/cloud.js'); return [(await api.registry('{lid}')).players.length, (await api.sanctions('{lid}')).length]; }})()""")
    check("10. control: la administradora sí lee padrón y sanciones con la misma llamada", ctl[0] == 3 and ctl[1] >= 1, ctl)
    await signout(pg)
    await signin(pg, "beto@eq.com"); await pg.goto(B + f"#/liga/{lid}/jugadores"); await pg.wait_for_selector("text=Sin acceso")
    leak = await pg.evaluate(f"""(async () => {{ const {{ api }} = await import('./app/cloud.js'); const out = {{}};
      for (const [k, f] of Object.entries({{ registry: () => api.registry('{lid}'), finanzas: () => api.leagueFinance('{lid}'), torneos: () => api.tournaments('{lid}'), disputas: () => api.disputes('{lid}'), sanciones: () => api.sanctions('{lid}'), auditoria: () => api.auditView('{lid}', 10) }})) {{
        try {{ const r = await f(); out[k] = Array.isArray(r) ? r.length : Object.values(r || {{}}).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0); }} catch (e) {{ out[k] = 'negado'; }} }}
      try {{ await api.recordResult('{lid}', JSON.parse(localStorage.getItem('demo-db')).lmatches[0].id, 9, 9, [], ''); out.escribir = 'PERMITIDO'; }} catch (e) {{ out.escribir = 'negado'; }}
      return out; }})()""")
    check("10. un delegado no lee el padrón, finanzas, sanciones ni bitácora de la liga, ni captura resultados", all(v in (0, "negado") for v in leak.values()) and leak["escribir"] == "negado", leak)
    await signout(pg)
    await signup(pg, "cris@x.com", ["team"]); await pg.goto(B + f"#/liga/{lid}/finanzas"); await pg.wait_for_selector("text=Sin acceso")
    check("10. una cuenta ajena no entra a la liga", True)
    await signout(pg)

    # 3b. Pro propio: se conserva al desvincularse de la liga
    await pg.evaluate("""() => { const d = JSON.parse(localStorage.getItem('demo-db')); d.subs.push({ subject_type: 'team', subject_id: 'los-halcones/principal', plan_id: 'team-pro', source: 'manual', status: 'active' }); localStorage.setItem('demo-db', JSON.stringify(d)); }""")
    await liga(pg); await tab(pg, "Equipos"); await pg.click("text=Desvincular"); await toast(pg, "desvinculado"); await signout(pg)
    await signin(pg, "beto@eq.com"); await pg.wait_for_selector(".cl-row .chip.ok:has-text('Equipo Pro')")
    check("3. al desvincularse conserva su propio Pro (y ya no el de la liga)", "Pro de la liga" not in await pg.inner_text("body"))
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
