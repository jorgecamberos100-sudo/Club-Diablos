"""Regresión: Diablos y el club de ejemplo siguen funcionando igual, con y sin cuentas (?demo)."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

async def main():
    p, br, pg = await browser()
    for base, label in (("http://localhost:8765/", "sin cuentas"), ("http://localhost:8765/?demo", "demo")):
        await pg.goto(base); await pg.wait_for_selector(".top h1")
        check(f"[{label}] raíz abre Diablos", "diablos" in pg.url and "CLUB DIABLOS" in (await pg.inner_text(".top h1")).upper())
        for v, txt in (("inicio", "Próximo"), ("partidos", "Partidos"), ("plantel", "Plantel"), ("alineacion", "Alineación"), ("finanzas", "Finanzas")):
            await pg.goto(base + f"#/diablos/domingos/{v}"); await pg.wait_for_selector(".tabbar")
            check(f"[{label}] Diablos {v}", await pg.locator("#view").inner_text() != "")
        await pg.goto(base + "#/ejemplo/primera/plantel")
        try: await pg.wait_for_function("getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() === '#0a1428'", timeout=8000); okc = True
        except Exception: okc = False
        check(f"[{label}] ejemplo con su estética", okc)
        check(f"[{label}] botón de cuenta {'visible' if 'demo' in base else 'oculto'}", (await pg.locator(".top-acc").count() == 1) == ("demo" in base))
        await pg.goto(base + "#/diablos/domingos/finanzas"); await pg.wait_for_selector(".tabbar")
        check(f"[{label}] Diablos conserva sus finanzas de archivo", "$" in await pg.locator("#view").inner_text())
    ok = summary(pg); await br.close(); await p.stop(); sys.exit(0 if ok else 1)
asyncio.run(main())
