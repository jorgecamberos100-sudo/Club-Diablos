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
| 5. Registro de jugadores, padrón central, credenciales | Pendiente | `match_events.player_id` ya está reservado para enlazar con el padrón. |
| 6. Página pública y componente incrustable | Pendiente | El estado "Publicado" del torneo ya existe; aún no hay lectura pública. |
| 7. Acta por foto (OCR) y chatbot por liga | Pendiente | |
| 8. Pulido, guía de activación, informe final | En curso | |

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
