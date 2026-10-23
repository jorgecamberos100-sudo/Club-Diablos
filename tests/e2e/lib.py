"""Ayudas para pruebas en navegador (modo demo). Requiere: python3 -m http.server 8765 desde la raíz del repositorio."""
import re
from playwright.async_api import async_playwright
B = "http://localhost:8765/?demo"
IGNORE = ("ERR_TUNNEL_CONNECTION_FAILED", "fonts.g")

async def browser():
    p = await async_playwright().start(); br = await p.chromium.launch()
    pg = await br.new_page(viewport={"width": 390, "height": 844}); pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and not any(i in m.text for i in IGNORE) and pg.errors.append(m.text))
    pg.dialog_text = ""; pg.on("dialog", lambda d: d.accept(pg.dialog_text))   # confirm() se acepta; en prompt() se escribe pg.dialog_text
    return p, br, pg

async def signup(pg, email, roles=None):
    await pg.goto(B + "#/cuenta"); await pg.wait_for_selector(".top h1")
    await pg.click("text=Entrar con correo"); await pg.click("text=No tengo cuenta")
    await pg.fill("#sheet input[name=email]", email); await pg.fill("#sheet input[name=pw]", "123456")
    await pg.click("#sheet button[type=submit]")
    if roles:
        await pg.wait_for_selector("text=¿Qué vas a organizar?")
        for r in roles: await pg.click(f"input[value={r}]")
        await pg.click("text=Continuar")
    await pg.wait_for_selector("text=Lo que organizas")

async def signin(pg, email):
    await pg.goto(B + "#/cuenta"); await pg.wait_for_selector(".top h1")
    await pg.click("text=Entrar con correo"); await pg.fill("#sheet input[name=email]", email); await pg.fill("#sheet input[name=pw]", "123456")
    await pg.click("#sheet button[type=submit]"); await pg.wait_for_selector("text=Lo que organizas")

async def signout(pg):
    await pg.goto(B + "#/cuenta"); await pg.wait_for_selector("button:text-is('Salir')"); await pg.click("button:text-is('Salir')"); await pg.wait_for_selector("text=Entra para organizar")

async def toast(pg, text):
    await pg.wait_for_selector(f".toast.show:has-text('{text}')", timeout=5000)

results = []
def check(name, cond, info=""):
    results.append(bool(cond)); print(("  ok   " if cond else "  FALLA ") + name + ("" if cond else " -> " + str(info)))
def summary(pg=None):
    errs = pg.errors if pg else []
    check("sin errores de JavaScript", not errs, errs)
    print(f"\n{sum(results)} de {len(results)} pruebas pasaron"); return all(results)
