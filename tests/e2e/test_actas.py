import asyncio, sys, os, base64
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
IMG = {"name": "acta.png", "mimeType": "image/png", "buffer": PNG}

async def tab(pg, name):
    await pg.click(f".tabbar >> text={name}"); await pg.wait_for_selector(f".tabbar a[aria-current=page]:has-text('{name}')"); await pg.wait_for_timeout(300); await pg.wait_for_selector(".cl-card")

async def main():
    p, br, pg = await browser()
    await signup(pg, "ana@liga.com", ["league"])
    await pg.fill("input[name=nm]", "Liga Reforma"); await pg.click("text=Crear liga"); await pg.wait_for_selector(".tabbar")
    await tab(pg, "Torneos"); await pg.click("text=Nuevo torneo"); await pg.fill("#sheet input[name=name]", "Apertura"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Inscribir equipo")
    for n in ["Rayos", "Lobos"]:
        await pg.fill("form[data-lf=addteam] input[name=name]", n); await pg.click("form[data-lf=addteam] button[type=submit]"); await pg.wait_for_selector(f".cl-row:has-text('{n}')")
    await pg.click("button[role=tab]:text-is('Calendario')"); await pg.click("text=Generar calendario"); await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("h3.rnd")
    check("el partido pendiente ofrece subir su acta", await pg.locator("button:text-is('Acta')").count() == 1)

    await pg.click("button:text-is('Acta')"); await pg.wait_for_selector("#sheet input[type=file]")
    await pg.set_input_files("#sheet input[name=photo]", {"name": "acta.html", "mimeType": "text/html", "buffer": b"<script>alert(1)</script>"}); await pg.click("#sheet button:text-is('Subir foto')")
    await pg.wait_for_selector("#sheet .msg:has-text('tipo de archivo')"); check("un archivo que no es foto se rechaza antes de subir", await pg.locator("#sheet img.acta-img").count() == 0)
    pg.errors[:] = [e for e in pg.errors if "Archivo no permitido" not in e]
    await pg.set_input_files("#sheet input[name=photo]", IMG); await pg.click("#sheet button:text-is('Subir foto')")
    await pg.wait_for_selector("#sheet img.acta-img"); check("al subir la foto se abre la revisión con la imagen", (await pg.get_attribute("#sheet img.acta-img", "src")).startswith("data:image/jpeg"))
    check("el servicio de lectura solo aparece si está configurado", await pg.locator("#sheet button:text-is('Leer con el servicio')").count() == 0)

    # texto → borrador (con un error a propósito para ver el aviso)
    await pg.fill("#sheet textarea[name=text]", "Marcador: 2 - 1\nGol: Pepe Pérez (Rayos)\nGol: Pepe Pérez (Rayos)\nGol: Tito (Lobos)\nAmarilla: Beto")
    await pg.click("#sheet button:text-is('Interpretar texto')"); await pg.wait_for_selector("#sheet .ev")
    check("el texto llena marcador y eventos", await pg.input_value("#sheet input[name=hg]") == "2" and await pg.input_value("#sheet input[name=ag]") == "1" and await pg.locator("#sheet .ev").count() == 4)
    check("avisa del dato dudoso (jugador sin equipo)", "Beto" in await pg.inner_text("#sheet #warns"))
    # el borrador no cambia nada oficial
    await pg.click("#sheet button:text-is('Guardar borrador')"); await toast(pg, "todavía no es oficial")
    await pg.click("#sheet [data-cl=close] >> nth=1")
    check("con solo borrador el partido sigue pendiente", await pg.locator(".cl-row:has-text('2 - 1')").count() == 0)
    # reabrir el borrador pendiente
    await pg.click("button:text-is('Acta')"); await pg.wait_for_selector("#sheet button:text-is('Revisar')")
    check("el acta queda pendiente y se puede retomar", "Pendiente" in await pg.inner_text("#sheet .cl-row"))
    await pg.click("#sheet button:text-is('Revisar')"); await pg.wait_for_selector("#sheet .ev")
    check("el borrador conserva marcador y eventos", await pg.input_value("#sheet input[name=hg]") == "2" and await pg.locator("#sheet .ev").count() == 4)
    # un borrador incoherente no se confirma
    await pg.fill("#sheet input[name=hg]", "1"); pg.dialog_text = ""
    await pg.click("#sheet button:text-is('Confirmar y registrar resultado')"); await pg.wait_for_selector("#sheet .msg:has-text('superan el marcador')")
    check("las reglas de la captura manual también aplican al acta", True); pg.errors[:] = [e for e in pg.errors if "superan el marcador" not in e]
    await pg.fill("#sheet input[name=hg]", "2")
    await pg.click("#sheet button:text-is('Confirmar y registrar resultado')"); await toast(pg, "Resultado registrado desde el acta")
    await pg.wait_for_selector(".cl-row:has-text('2 - 1')"); check("al confirmar, el resultado es oficial", True)
    check("ya no se ofrece subir acta a un partido jugado", await pg.locator("button:text-is('Acta')").count() == 0)
    # tabla y goleo
    await pg.click("button[role=tab]:text-is('Goleo')"); await pg.wait_for_selector("table.tbl")
    check("el goleo refleja las actas confirmadas", "Pepe Pérez" in await pg.inner_text("table.tbl"))
    # bitácora
    await tab(pg, "Ajustes"); await pg.wait_for_selector("text=Bitácora")
    log = await pg.inner_text("body"); check("la bitácora registra subida y confirmación", "Subió la foto de un acta" in log and "Confirmó un acta" in log)
    # la foto original sigue guardada
    check("el original se conserva", await pg.evaluate("JSON.parse(localStorage.getItem('demo-db')).actas.filter(a=>a.status==='confirmed' && a.path.includes('#data:image')).length") == 1)
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
