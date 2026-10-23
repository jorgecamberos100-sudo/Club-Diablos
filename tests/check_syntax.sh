#!/bin/sh
# Revisa que cada módulo de la app sea JavaScript válido como módulo (node --check a secas no lo garantiza).
cd "$(dirname "$0")/.." || exit 1
bad=0
for f in app/*.js app/league/*.js app/views/*.js sw.js; do node --input-type=module --check < "$f" >/dev/null 2>/tmp/syn.err || { echo "ERROR de sintaxis en $f"; head -5 /tmp/syn.err; bad=1; }; done
[ $bad = 0 ] && echo "Sintaxis correcta en todos los módulos"; exit $bad
