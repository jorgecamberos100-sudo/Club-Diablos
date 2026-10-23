# Avance de la plataforma (Club Diablos → equipos y ligas)

Estados: **Hecho y probado** = implementado y cubierto por pruebas automáticas. **Parcial** = existe, con huecos que se indican. **Pendiente** = no empezado.
Importante: todo lo de Supabase se probó contra un PostgreSQL local con un simulador de Supabase (`tests/db`), **no contra un proyecto real**. Activar Supabase y repetir una prueba manual sigue siendo configuración externa (ver `supabase/LEEME.md`).

| Etapa | Estado | Notas |
|---|---|---|
| 1. Cuentas, roles, ligas, planes configurables | Hecho y probado | Planes en tabla `plans`; la app pregunta `can()`, nunca "¿es Pro?". |
| 1b. Invitaciones y Pro por contrato de liga | Hecho y probado | Código aleatorio de 48 bits, límite de intentos; el Pro de la liga es derivado y se quita solo al desvincular o vencer el contrato. |
| 2. Gestión de equipos y jugadores | Hecho y probado | Equipos en base de datos con las mismas pantallas que los de archivo; Diablos y el club de ejemplo no se tocan. |
| 3. Torneos, inscripción, calendario, resultados, tabla, goleo | Hecho y probado | Ver detalle abajo. |
| 4. Administradores con permisos, sanciones, objeciones, finanzas de liga, reportes | Parcial | La bitácora (`audit_log`) y los permisos por función ya existen en la base; falta todo lo demás. |
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

## Límites conocidos de la etapa 3
- El cobro de la cuota de inscripción solo se muestra; su seguimiento llega con las finanzas de la liga (etapa 4).
- Eliminatorias y grupos no existen todavía: solo liguilla todos contra todos (el calendario manual permite armar cualquier cruce).
- La tarjeta amarilla/roja alimenta el desempate de juego limpio, pero aún no genera sanciones automáticas.
- Los nombres de jugadores en el acta son texto libre hasta que exista el padrón de la etapa 5.
