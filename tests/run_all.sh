#!/bin/sh
# Corre todas las pruebas: base de datos (PostgreSQL temporal), unitarias y de navegador (modo demo).
# Requiere: PostgreSQL 16, Node, Python con Playwright. Desde la raíz del repositorio: sh tests/run_all.sh
cd "$(dirname "$0")/.." || exit 1
fail=0
run() { echo "== $1"; shift; "$@" > /tmp/run_all.out 2>&1 || { fail=1; tail -15 /tmp/run_all.out; }; tail -1 /tmp/run_all.out; }
run "Sintaxis de módulos" sh tests/check_syntax.sh
run "Base de datos" python3 tests/db/test_db.py
run "Formaciones" node tests/unit/test_forms.mjs
run "Posiciones y goleo" node tests/unit/test_standings.mjs
run "Saldos y CSV" node tests/unit/test_report.mjs
run "Lectura de actas" node tests/unit/test_ocr.mjs
run "Asistente de la liga" node tests/unit/test_chat.mjs
(sh tests/e2e/serve.sh >/dev/null 2>&1 &) ; sleep 1
for t in test_links test_regress test_team test_tournaments test_league_admin test_players test_public test_actas test_mobile; do run "Navegador: $t" python3 tests/e2e/$t.py; done
pkill -f "http.server 8765" 2>/dev/null
[ $fail = 0 ] && echo "TODO EN VERDE" || echo "HAY FALLAS"; exit $fail
