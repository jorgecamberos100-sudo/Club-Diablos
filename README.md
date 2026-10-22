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
