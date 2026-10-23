# Avance de la plataforma (Club Diablos → equipos y ligas)

Estados: **Hecho y probado** = implementado y cubierto por pruebas automáticas. **Parcial** = existe, con huecos que se indican. **Pendiente** = no empezado.
Importante: todo lo de Supabase se probó contra un PostgreSQL local con un simulador de Supabase (`tests/db`), **no contra un proyecto real**. Activar Supabase y repetir una prueba manual sigue siendo configuración externa (ver `supabase/LEEME.md`).

| Etapa | Estado | Notas |
|---|---|---|
| 1. Cuentas, roles, ligas, planes configurables | Hecho y probado | Planes en tabla `plans`; la app pregunta `can()`, nunca "¿es Pro?". |
| 1b. Invitaciones y Pro por contrato de liga | Hecho y probado | Código aleatorio de 48 bits, límite de intentos; el Pro de la liga es derivado y se quita solo al desvincular o vencer el contrato. |
| 2. Gestión de equipos y jugadores | Hecho y probado | Equipos en base de datos con las mismas pantallas que los de archivo; Diablos y el club de ejemplo no se tocan. |
| 3. Torneos, inscripción, calendario, resultados, tabla, goleo | Hecho y probado | Ver detalle abajo. |
| 4. Administradores con permisos, sanciones, objeciones y protestas, finanzas de liga, bitácora, reportes | Hecho y probado | Ver detalle abajo. Los reportes salen como CSV (abre en Excel); falta PDF. |
| 5. Registro de jugadores, padrón central, credenciales | Hecho y probado | Ver detalle abajo. `match_events.player_id` sigue sin enlazarse al padrón (los goleadores se escriben a mano). |
| 6. Página pública y componente incrustable | Hecho y probado (demo + SQL local) | Ver detalle abajo. |
| 7a. Acta por foto con confirmación humana | Hecho y probado salvo el OCR real | Captura a mano e intérprete de texto probados; OCR en el celular y servicio propio **sin probar** (ver `docs/ACTAS.md`). |
| 7b. Asistente por liga | Motor local hecho y probado; servicio con modelo **no desplegado** | Cupo diario en base de datos probado. Ver `docs/ASISTENTE.md`. |
| 7c. WhatsApp oficial | Solo documentado, no implementado | `docs/WHATSAPP.md`. |
| 8. Pulido móvil, guía de activación, revisión independiente | Hecho | `supabase/LEEME.md`; prueba móvil a 360 px; revisión por un agente aparte (abajo). |

## Etapa 3 en detalle
- Base de datos (`supabase/schema.sql`, sección "Etapa 5 del producto"): `tournaments`, `tournament_teams`, `league_matches`, `match_events`; todas con RLS (solo lectura para administradores de la liga) y escritura únicamente por funciones con permiso (`tournaments`, `schedule`, `results`).
- Reglas aplicadas en la base, no solo en pantalla: un equipo no juega dos veces por jornada; los equipos deben estar inscritos y activos; el marcador y los goles de los jugadores deben cuadrar; un torneo terminado no se modifica; un partido jugado no se borra ni reprograma (se corrige con el resultado, y queda el antes y el después en la bitácora); un equipo con partidos jugados se retira, no se borra; límites y funciones salen del plan (`tournaments`, `schedule`).
- Desempates configurables por torneo (diferencia de goles, goles a favor, ganados, menos goles en contra, enfrentamiento directo, juego limpio), puntos por victoria/empate/derrota configurables. Cálculo en `app/league/standings.js` (18 pruebas).
- Pantalla: `app/league/torneos.js` (torneos, equipos, calendario con generador todos contra todos, captura y corrección de resultados con goleadores y tarjetas, tabla, goleo, reglas).
- Pruebas: 131 de base de datos, 18 unitarias, 20 de navegador para torneos; las 3 suites anteriores siguen verdes. Todo con `sh tests/run_all.sh`.

## Etapa 4 en detalle
- Administradores: el superadministrador invita con un código de un solo uso y elige permisos por función (equipos, torneos, calendario, resultados, sanciones, finanzas, registro, bitácora, ajustes). Puede cambiarlos o quitar el acceso al instante; el límite de administradores sale del plan. Nadie puede delegar el permiso de administrar administradores.
- Sanciones (amonestación, suspensión, multa, descuento de puntos, expulsión) con motivo, duración, monto, evidencia (texto o enlace) y estado (vigente, cumplida, revocada). Una multa puede crear su cargo en las finanzas de la liga; revocarla anula el cargo. El descuento de puntos se aplica en la tabla de posiciones para todos los administradores.
- Objeciones y protestas: se registran (también desde un partido del calendario), pasan a revisión y se resuelven con texto obligatorio; un cambio posterior queda como cambio con el estado y la resolución anteriores. Una protesta no altera el resultado: el resultado se corrige aparte y queda en la bitácora.
- Finanzas de la liga: cargos por equipo (individuales o a todos, sin duplicar el concepto), pagos que abonan un cargo, ingresos y gastos de la liga, anulación con motivo (nada se borra). Saldos y caja se calculan solo con lo vigente. Totalmente separado del contrato y de los pagos a la plataforma.
- Bitácora legible con quién, cuándo y el antes/después; se puede filtrar por registro (historial de una sanción u objeción).
- Reportes: saldos por equipo, movimientos y sanciones en CSV con acentos correctos y protegidos contra fórmulas.
- Pruebas: 187 de base de datos (permisos, planes, RLS, anulaciones, bitácora), 19 de posiciones, 9 de saldos/CSV, 19 de navegador para esta etapa.

## Etapa 6 en detalle (página pública e integrable)
- Apagada por defecto. Se activa en Ajustes → Página pública (requiere la función `public_page` del plan y el permiso de ajustes). Se puede pausar en cualquier momento y se oculta al instante.
- Solo se publican torneos en estado publicado, en pausa o terminado. Los borradores nunca salen.
- Datos expuestos (funciones SQL `public_league` y `public_tournament`, únicas lecturas para visitantes sin cuenta): nombre y marca de la liga, equipos, partidos con marcador, goles/tarjetas y descuentos de puntos. No salen notas de partido, documentos, fotos, finanzas, sanciones ni correos. Los nombres de goleadores se pueden ocultar.
- Rutas: `#/p/<liga>[/<torneo>/<tabla|calendario|goleo>]` y `#/embed/<liga>/<torneo>/<parte>` (sin encabezado ni barra, para iframe). Ajustes entrega el enlace, botón de WhatsApp y el código `<iframe>` por torneo.
- Colores y logo de la liga se aplican con el mismo tema que las credenciales.
- Los goleadores salen visibles por omisión (la liga lo apaga en Ajustes); hay ligas con menores: decídelo antes de publicar. El calendario público incluye los descuentos de puntos (sin su motivo), no el reglamento escrito.
- Pruebas: base de datos (apagada por defecto, anon sin acceso a tablas, borradores ocultos, goleadores ocultos, plan requerido) y 19 de navegador (incluye asistente).

## Límites conocidos de la etapa 6
- Se probó el modo demo en navegador y las funciones SQL en PostgreSQL local; falta probar contra un proyecto de Supabase real y desde un dominio externo con el iframe.
- No hay datos en tiempo real: la página lee al abrirse (recargar para ver cambios).
- El código QR de credenciales que apunte a esta página sigue pendiente.

## Etapa 5 en detalle
- Padrón central por liga (`league_players`): una persona existe una sola vez (mismo documento, o mismo nombre sin acentos/mayúsculas y misma fecha de nacimiento; garantizado por índices únicos en la base). Un jugador solo puede estar activo o pendiente en un equipo por torneo; la baja se conserva como historial y permite el traspaso.
- Método 1 (delegado o enlace): el delegado del equipo vinculado registra desde «Mi cuenta → Registrar jugadores»; o la liga crea un enlace con tope de usos y vigencia que cualquiera abre sin cuenta (`#/registro/<código>`). Todo llega como pendiente; la liga aprueba o rechaza con motivo.
- Método 2 (oficina): un administrador con permiso registra con foto y documento; el jugador queda activo en el acto.
- Reglas por liga: foto y documento «no se pide / opcional / obligatoria», y si lo que mandan delegados y enlaces espera aprobación. Se validan en la base: no se activa a quien no cumple.
- Fotos de jugadores en un bucket **privado** (`player-photos`) con enlaces firmados temporales, visibles solo para administradores con permiso de registro. Las fotos se reducen en el navegador antes de subirse.
- Credenciales imprimibles (85.6 × 54 mm, 10 por hoja A4; una sola o por equipo o todo el torneo) con el color y logo de la liga (Ajustes → Marca). Llevan nombre, número, equipo, torneo, foto y código; no llevan documento ni fecha de nacimiento.
- Pruebas: 238 de base de datos en total (51 nuevas de esta etapa), 24 de navegador (alta con foto, duplicados, búsqueda, reglas, enlace sin cuenta, delegado, aprobación, impresión, marca, baja).

## Límites conocidos de la etapa 5
- Quien se registra por enlace no sube foto (un formulario anónimo con subida de archivos es un riesgo de abuso): la agrega el delegado o la liga al aprobar.
- La credencial no lleva código QR ni hay una página para verificarla; el código es solo una referencia. Se puede agregar con la página pública.
- Los menores de edad se marcan como «Menor», pero el consentimiento del tutor lo gestiona la liga fuera de la app (ver aviso de privacidad en la guía de activación).
- Las fotos solo se probaron con el almacenamiento simulado (modo demo) y con las políticas de storage cargadas en PostgreSQL local; falta una prueba real contra un proyecto de Supabase.

## Límites conocidos de la etapa 4
- Los delegados de los equipos todavía no presentan objeciones ellos mismos desde su cuenta: las registra un administrador de la liga.
- La evidencia de una sanción es texto o enlace; subir la foto o el archivo llega con el almacenamiento de imágenes (etapas 5 y 7).
- Las suspensiones se registran y se ven, pero no bloquean automáticamente la captura de goles/alineaciones de ese jugador.
- Reportes en PDF o impresos de la tabla/finanzas: pendiente (CSV sí).

## Límites conocidos de la etapa 3
- El cobro de la cuota de inscripción solo se muestra; su seguimiento llega con las finanzas de la liga (etapa 4).
- Eliminatorias y grupos no existen todavía: solo liguilla todos contra todos (el calendario manual permite armar cualquier cruce).
- La tarjeta amarilla/roja alimenta el desempate de juego limpio, pero aún no genera sanciones automáticas.
- Los nombres de jugadores en el acta son texto libre hasta que exista el padrón de la etapa 5.

## Etapa 7 en detalle (actas, asistente)
- Actas: foto original en el almacén privado `actas` (sin borrar ni reemplazar); borrador a mano, por texto interpretado, por OCR del celular o por servicio propio; **solo `confirm_acta` vuelve oficial el resultado**, usando `record_result` (mismas reglas, bitácora). Límite de 5 actas pendientes por partido.
- Asistente: reglas locales sobre datos públicos, sin costo. Para un modelo de lenguaje hay un adaptador y un cupo diario (`chat_take`), pero el servicio debe llamar al cupo; ese servicio no existe en el repositorio.
- Pruebas: 21 unitarias del intérprete/adaptadores de OCR, 23 del asistente, 15 de navegador de actas, 33 de la revisión móvil.

## Endurecimiento y revisión independiente (23 oct 2026)
Un agente aparte, sin haber visto el trabajo, revisó el repositorio y encontró fallas reales. Corregidas y con prueba:
- **XSS almacenado** en la revisión de actas (marcador con HTML): ahora la base valida enteros 0–99 y el cliente escapa.
- **Escritura directa a `leagues`** por un administrador de ajustes (saltaba topes y reglas): eliminada la política y el permiso de escritura.
- **Códigos de invitación completos en la bitácora** (quien solo ve la bitácora podía usarlos): ahora solo se guardan los últimos 4 caracteres.
- Código `<iframe>` con atributos sin escapar; etiqueta de partido cancelado; reglamento completo en la API pública; reabrir un torneo saltaba el límite del plan; quitar un equipo con cobros o jugadores daba un error de llave foránea (ahora se retira conservando el historial).
- La opción «aprobación de delegados» **no se aplicaba** (todo lo que llega por delegado o enlace siempre espera aprobación). Se quitó la casilla y se dejó el texto honesto; no se automatiza porque un enlace abierto no debe activar jugadores sin revisión.
- El simulador de pruebas ahora imita los privilegios por omisión de Supabase; así dos pruebas que pasaban "por falta de permisos" se reescribieron para comprobar que los datos no cambian.

## Límites conocidos que quedan (de la revisión, sin corregir)
- `register_by_link` (sin cuenta) deja sondear si una persona ya está inscrita en otro equipo, sin límite de intentos.
- El logo de liga acepta cualquier dominio con la forma de una URL de Storage; los almacenes `actas` y `player-photos` no limitan tamaño/tipo ni revisan el plan al subir.
- Cualquier visitante puede agotar el cupo diario del asistente; el día cuenta en UTC.
- Reaplicar `schema.sql` vuelve a agregar `actas` al plan base aunque se haya quitado; las funciones nuevas no se agregan solas a planes ya existentes.
- Paridad demo/SQL con diferencias menores (formato del marcador de actas, validación de ruta, marca de liga con `data:`); el demo no simula el cupo del asistente.
- Pruebas con checks constantes (`True`) en `test_public.py` y `test_actas.py`; no hay prueba de navegador con HTML en nombres.
- Tesseract.js se carga desde un CDN sin integridad, y no se verificó de dónde descarga el idioma.
- Google Fonts se carga también en la página pública.

## Lista priorizada de pendientes
1. **Activar Supabase real y hacer la lista de comprobación de `supabase/LEEME.md` §6** (nada de esto corrió contra un proyecto real).
2. Probar OCR con actas reales y decidir si vale un servicio de pago.
3. Aviso de privacidad y consentimiento de menores (la liga lo gestiona fuera de la app).
4. Límite de intentos y topes de subida en registro por enlace y almacenes.
5. Precios y planes reales (hoy configurables y vacíos).
6. Reportes en PDF; eliminatorias y grupos; sanciones que bloqueen alineaciones.
7. Avisos por WhatsApp oficial (`docs/WHATSAPP.md`) si la liga lo quiere y acepta el costo por mensaje.
