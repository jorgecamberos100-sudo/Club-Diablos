# GEMINI.md — Contexto para la auditoría de Club-Diablos

## Qué es
App web instalable (PWA) en JavaScript vainilla, SIN paso de compilación, para administrar
equipos de fútbol amateur: cuentas, plantel con tarjetas y alineaciones, partidos, posiciones,
brackets, finanzas (caja, depósitos, préstamos), actas, sanciones, calificación de jugadores,
OCR, chatbot y WhatsApp. Multi-club y multi-equipo por club. Repo público:
github.com/jorgecamberos100-sudo/Club-Diablos, rama main. Desplegada en GitHub Pages
(https://jorgecamberos100-sudo.github.io/Club-Diablos/).

## Cómo se ejecuta
- Sin build: se sirve `index.html` tal cual (p. ej. `python3 -m http.server 8765`).
- `sw.js` + `manifest.webmanifest`: PWA instalable; el service worker pide siempre la
  versión más nueva y solo usa la copia guardada sin conexión.
- Rutas por hash: `#/<club>/<equipo>/<vista>` (vistas: cuentas, plantel, alineacion).
  También `#/p/<liga>...` (página pública) y `#/embed/...` (iframe).
- Datos: archivos JSON en `data/clubs/...` (modo archivo, sin cuentas). Con
  `app/config.js` vacío la app funciona sin cuentas. `?demo` antes del `#` activa el
  modo demo (cuentas y votos solo en ese navegador).
- Supabase OPCIONAL (nunca probado contra un proyecto real): `app/config.js` ->
  `CLOUD = { url, key }` (solo clave publicable/anon; NUNCA service_role ni
  sb_secret_). Esquema en `supabase/schema.sql` (2438 líneas, seguro de repetir),
  verificación en `supabase/verificar.sql`, guía en `supabase/LEEME.md`.

## Estructura
- `index.html`, `styles/app.css`, `sw.js`, `manifest.webmanifest`, `icons/`
- `app/`: `main.js` (arranque/rutas), `data.js` (ÚNICA parte que sabe de dónde vienen
  los datos: hoy JSON), `util.js`, `ui.js`, `theme.js`, `color.js`, `platform.js`,
  `finance.js` (cálculo de cuentas, funciones puras), `rating.js`, `matches.js`,
  `live.js`, `cloud.js` (1123 líneas: motores Supabase y demo, misma interfaz),
  `cloudui.js`, `teamadmin.js`, `sheet.js`, `chatbot.js`, `plans.js`, `public.js`,
  `consent.js`, `config.js` (vacío = sin cuentas).
- `app/league/`: torneos, posiciones (`standings.js`), brackets, finanzas de liga,
  sanciones, actas, jugadores/padrón, credenciales, reportes, ajustes, auditoría.
- `app/views/`: inicio, cuentas, plantel, alineacion, partidos.
- `app/ocr/`: `parse.js` (intérprete de texto de actas), `engines.js` (Tesseract.js
  en el celular, descarga de CDN sin verificación de integridad — riesgo conocido).
- `data/clubs/<club>/`: `club.json` (marca: nombre, escudo, colores, contacto),
  `players.json` (attrs vel/tir/pas/reg/def/fis 0-99), `teams/<equipo>.json`
  (plantel, dorsales, finanzas, formato 11 o 7). Clubes reales: `diablos`, `ejemplo`.
- `supabase/`: `schema.sql`, `verificar.sql`, `LEEME.md`.
- `docs/`: `ACTAS.md`, `ASISTENTE.md`, `WHATSAPP.md` (WhatsApp solo documentado).
- `tests/`: `run_all.sh` (todo), `check_syntax.sh`, `check_secrets.sh`,
  `unit/*.mjs` (node, 7 suites), `e2e/*.py` (Playwright, modo demo),
  `db/test_db.py` + `harness.py` (PostgreSQL 16 temporal + simulador Supabase).

## Pruebas (línea base, 2026-11-17, antes de la auditoría)
- `check_syntax.sh`: verde. `check_secrets.sh`: verde.
- Unitarias node: test_forms, test_standings (19), test_report (9), test_ocr (21),
  test_chat (23), test_bracket (19), test_printout (8) — todas en verde.
- DB (238 pruebas) y e2e (12 archivos): NO corrieron en esta VM (sin PostgreSQL 16
  ni Playwright instalados). Si puedes, instálalos y corre `sh tests/run_all.sh`.

## Reglas de negocio (NO cambiar sin marcarlo)
- Finanzas de equipo (`app/finance.js`, funciones puras): cuota por jugador; multa
  total repartida solo entre los multados; saldo = aportado - toca; nada se borra
  (anulaciones con motivo). Finanzas de liga separadas de las del equipo.
- Calificación (`app/rating.js`): media = 50% atributos + 40% forma (últimos 5
  partidos) + 10% compromiso, escala 40-99, pesos ajustables en `club.json` ->
  `rating.weights`. Votos de compañeros, nunca del admin ni de uno mismo. Mínimo
  3 votos; con 5+ se quitan el más alto y el más bajo.
- Posiciones (`app/league/standings.js`): puntos por victoria/empate/derrota
  configurables; desempates configurables (DG, GF, ganados, menos GC, h2h, juego
  limpio); un equipo no juega dos veces por jornada; marcador y goles deben
  cuadrar; torneo terminado no se modifica; partido jugado no se borra (se corrige
  con bitácora); equipo con partidos jugados se retira, no se borra.
- Sanciones: amonestación, suspensión, multa, descuento de puntos, expulsión.
  La multa puede crear su cargo en finanzas; revocarla anula el cargo. El
  descuento de puntos se aplica en la tabla. Las suspensiones se registran pero
  NO bloquean alineaciones (límite conocido).
- Padrón: una persona existe una sola vez (mismo documento, o mismo nombre sin
  acentos/mayúsculas + misma fecha de nacimiento). Registro por enlace siempre
  llega como pendiente y espera aprobación.
- Página pública apagada por omisión; solo torneos publicado/pausado/terminado
  (nunca borradores); no salen finanzas, sanciones, correos, notas ni fotos.
  Nombres de goleadores visibles por omisión (hay ligas con menores: decidirlo).
- Privacidad: aviso versionado obligatorio para registrar; consentimiento de
  menores (nombre + autorización de tutor); derecho a borrar (registro anónimo,
  foto eliminada). Invitaciones: código aleatorio de 48 bits, límite de intentos;
  en bitácora solo los últimos 4 caracteres.
- Topes de frecuencia en base (enlace registro 30/10min, pública 600/10min,
  asistente 20/hora + tope diario de la liga, etc.). Archivos: 1-5 MB, solo
  JPG/PNG/WEBP; almacén público no listable.
- Planes: la app pregunta `can()`, nunca "¿es Pro?". Pro de liga derivado del
  contrato; se quita solo al desvincular o vencer.

## Riesgos ya conocidos (PROGRESO.md — no los re-reportes como nuevos)
- Nada probado contra Supabase real. OCR real sin probar. Asistente con modelo
  no desplegado. WhatsApp solo documentado. `profiles.photo_url` y escudos de
  equipo guardan URL completa sin restricción de dominio. Tesseract.js de CDN sin
  integridad. supabase-js fijado en 2.45.4. Goles/tarjetas en actas son texto libre
  (no enlazados al padrón). Sin datos en tiempo real en la página pública.

## LENTE DE PRODUCTO VENDIBLE (meta de negocio confirmada por George 2026-11-17)
Club Diablos NO es solo la app de su equipo: la meta es VENDERLA como plataforma
a ligas de fútbol amateur (páginas web por liga). Evalúa la auditoría también
como producto vendible, además de cazar errores:
- Modelo de plataforma ya construido: planes configurables (tabla `plans`,
  permisos por `can()`), Pro por contrato de liga (etapa 1b), finanzas de la liga
  separadas del contrato y de los "pagos a la plataforma", página pública por
  liga + componente incrustable iframe (etapa 6), invitaciones, superadministrador.
- PENDIENTE según PROGRESO.md: "Precios y planes reales (hoy configurables y
  vacíos)", quién paga WhatsApp (un número por liga o compartido: decisión de
  negocio pendiente), probar Supabase real (todo se probó contra PostgreSQL
  local, no proyecto real), OCR real sin probar, servicio del asistente no
  desplegado.
- En el reporte, agrega una sección: ¿qué tan lista está la plataforma para
  venderle a una liga nueva? (onboarding de una liga desde cero, aislamiento de
  datos entre ligas, límites del plan realmente enforced, página pública,
  contrato Pro, qué falta para cobrar). Marca qué huecos son BLOQUEANTES para
  vender y cuáles son pulido. No cambies precios ni decisiones de negocio; solo
  repórtalos.

## DATOS REALES — REGLA DURA
`data/clubs/diablos/` contiene datos REALES de dinero (caja, depósitos, préstamos)
y de personas. NUNCA escribas en esos archivos ni en producción. Para probar usa
solo el club `ejemplo` o el modo demo (`?demo`). Ningún cambio debe alterar ni
una fila de datos reales.

## Guardarraíles de esta auditoría
- Sin secretos en código (la prueba `tests/check_secrets.sh` debe seguir verde).
- Sin escrituras a base de datos ni a datos de producción; sin deploys.
- Sin cambiar reglas de negocio sin dejarlo marcado en el resumen.
- Sin romper el modo sin cuentas (`config.js` vacío) ni el PWA offline.
- No edites migraciones/esquema aplicado sin una razón documentada; si hace falta
  un cambio de base, propónlo como migración nueva y separada.
- Al final corre: `sh tests/check_syntax.sh`, `sh tests/check_secrets.sh` y todas
  las unitarias node; deja todo en verde. Si hay PostgreSQL/Playwright disponibles,
  corre también `sh tests/run_all.sh`.
- Entrega un resumen con cada hallazgo (archivo:línea, qué es, por qué importa,
  evidencia) y los resultados de las pruebas.
