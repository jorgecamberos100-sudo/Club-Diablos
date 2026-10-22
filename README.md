# App de equipos

App web instalable para administrar equipos de fútbol amateur: cuentas, plantel con tarjetas y alineaciones.
Pensada para varios clubes y varios equipos por club.

## Estructura

- `index.html`, `app/`, `styles/`: la app. No necesita compilarse.
- `app/data.js`: la única parte que sabe de dónde vienen los datos. Hoy lee archivos JSON; para pasar a base de datos solo se cambia este archivo.
- `data/clubs.json`: lista de clubes.
- `data/clubs/<club>/club.json`: marca del club (nombre, escudo, colores, contacto). Cambiar estos valores personaliza toda la app.
- `data/clubs/<club>/players.json`: jugadores del club. Un jugador puede estar en varios equipos. `attrs` lleva vel, tir, pas, reg, def, fis (0 a 99); `photo` el nombre de una imagen en la carpeta del club.
- `data/clubs/<club>/teams/<equipo>.json`: plantel con dorsales, finanzas, preguntas y respuestas, y formato (11 o 7).
- `sw.js` y `manifest.webmanifest`: instalación en el celular. El service worker siempre pide la versión más nueva y solo usa la copia guardada sin conexión.

## Rutas

`#/<club>/<equipo>/<vista>`, con vista `cuentas`, `plantel` o `alineacion`.

## Secciones

Inicio, Partidos, Plantel, Alineación y Finanzas (Finanzas solo aparece si el equipo tiene `finance`).

## Estética por club (`club.json` -> `theme`)

- `colors`: bg, panel, raise, line, text, muted, primary, primarySoft, onPrimary
- `fonts`: display, cond, body (cualquier fuente de Google Fonts)
- `card`: `escudo`, `redonda` o `recta`
- `pattern`: `franjas`, `diagonal` o `liso`

Ver `data/clubs/ejemplo` (datos ficticios) para un club con otra estética.

## Calificación (`app/rating.js`)

Votos de compañeros, nunca del administrador ni de uno mismo:
- `evaluations` del equipo: atributos 1 a 10 (inicio y mitad de temporada).
- `matches[].ratings`: calificación 1 a 10 por partido; `matches[].mvp`: voto al mejor del partido.
- Media = 50% atributos + 40% forma (últimos 5 partidos) + 10% compromiso, escala 40 a 99. Pesos ajustables en `club.json` -> `rating.weights`.
- Mínimo 3 votos; con 5 o más se quitan el más alto y el más bajo.

## Cuentas y datos en vivo
Ver `supabase/LEEME.md`. Con `app/config.js` vacío la app funciona sin cuentas. `app/cloud.js` tiene dos motores (Supabase y demo) con la misma interfaz; `app/live.js` mezcla resultados, votos y fotos con los archivos del equipo; `app/cloudui.js` tiene las pantallas.
