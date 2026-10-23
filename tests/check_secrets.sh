#!/bin/sh
# Busca claves privadas o secretos en el repositorio (archivos actuales y todo el historial de git).
# La clave pública (anon o sb_publishable_) puede ir en app/config.js; una clave service_role o sb_secret_ NUNCA.
cd "$(dirname "$0")/.." || exit 1
PAT='sb_secret_[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{32,}|sk_live_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}'
JWT='eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
fail=0
hits=$(git grep -nIE "$PAT" -- . ':!tests/check_secrets.sh' 2>/dev/null); [ -n "$hits" ] && { echo "Secreto en archivos actuales:"; echo "$hits"; fail=1; }
hist=$(git log -p --all 2>/dev/null | grep -nE "^\+.*($PAT)" | grep -v "check_secrets.sh" | head -5); [ -n "$hist" ] && { echo "Secreto en el historial de git:"; echo "$hist"; fail=1; }
# Cualquier JWT: solo se permite en app/config.js y solo si es de rol anon.
for t in $(git grep -hoIE "$JWT" -- . ':!tests/check_secrets.sh' 2>/dev/null; git log -p --all 2>/dev/null | grep -oE "$JWT"); do
  role=$(printf '%s' "$t" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | grep -o '"role":"[a-z_]*"')
  [ "$role" = '"role":"anon"' ] || { echo "Token no permitido ($role): ${t%%.*}..."; fail=1; }
done
grep -qE 'key: *"(|eyJ[^"]*|sb_publishable_[^"]*)"' app/config.js || { echo "app/config.js: la clave debe estar vacía o ser la pública (anon / sb_publishable_)."; fail=1; }
[ $fail = 0 ] && echo "Sin secretos en el repositorio ni en su historial" ; exit $fail
