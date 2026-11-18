import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def main():
    p, br, pg = await browser()

    # --- Mi cuenta: entrar con Google crea la sesión (modo demo) ---
    await pg.goto(B + "#/cuenta"); await pg.wait_for_selector(".top h1")
    check("Mi cuenta ofrece Continuar con Google", await pg.locator("button.gbtn:has-text('Continuar con Google')").count() == 1)
    check("Mi cuenta ofrece entrar con correo como alternativa", await pg.locator("text=Entrar con correo").count() >= 1)
    await pg.click("button.gbtn")
    await pg.wait_for_selector("text=¿Qué vas a organizar?")
    check("con Google se crea la sesión y pide elegir qué organizar", True)
    await signout(pg)

    # --- Hoja de entrar / crear cuenta: Google primero, correo como alternativa ---
    await pg.click("text=Entrar con correo"); await pg.wait_for_selector("#sheet form[data-form=auth]")
    check("la hoja de entrar ofrece Google", await pg.locator("#sheet button.gbtn:has-text('Continuar con Google')").count() == 1)
    check("la hoja de entrar separa Google del correo", await pg.locator("#sheet .or:has-text('o con correo')").count() == 1)
    check("la hoja de entrar tiene el formulario de correo", await pg.locator("#sheet input[name=email]").count() == 1 and await pg.locator("#sheet input[name=pw]").count() == 1)
    await pg.click("#sheet >> text=No tengo cuenta"); await pg.wait_for_selector("#sheet >> text=Crear cuenta")
    check("la hoja de crear cuenta también ofrece Google", await pg.locator("#sheet button.gbtn:has-text('Continuar con Google')").count() == 1)
    check("la hoja de crear cuenta no dice solo correo", "Crear cuenta con correo" not in await pg.inner_text("#sheet"))
    await pg.click("#sheet button.x")

    # --- Vista de equipo: entrar con Google desde Inicio ---
    await pg.goto(B + "#/diablos/domingos/inicio"); await pg.wait_for_selector(".tabbar")
    check("Inicio del equipo ofrece Continuar con Google", await pg.locator("button.gbtn:has-text('Continuar con Google')").count() == 1)
    await pg.click("button.gbtn")
    await pg.wait_for_selector(".cl-card >> text=Elige tu nombre")
    check("con Google en el equipo pide elegir nombre", True)

    # --- Sin nube no hay botón muerto: modo sin cuentas ---
    await pg.goto("http://localhost:8765/#/diablos/domingos/inicio"); await pg.wait_for_selector(".tabbar")
    check("sin nube no aparece ningún botón de Google en el equipo", await pg.locator(".gbtn").count() == 0)
    await pg.goto("http://localhost:8765/#/cuenta"); await pg.wait_for_selector(".top h1")
    check("sin nube Mi cuenta no ofrece Google", await pg.locator(".gbtn").count() == 0)

    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
