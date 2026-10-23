# Avance de la plataforma (Club Diablos → equipos y ligas)

Estados: **Hecho y probado** = implementado y cubierto por pruebas automáticas. **Parcial** = existe, con huecos que se indican. **Pendiente** = no empezado.
Importante: todo lo de Supabase se probó contra un PostgreSQL local con un simulador de Supabase (`tests/db`), **no contra un proyecto real**. Activar Supabase y repetir una prueba manual sigue siendo configuración externa (ver `supabase/LEEME.md`).

| Etapa | Estado | Notas |
|---|---|---|
| 1. Cuentas, roles, ligas, planes configurables | Hecho y probado | Planes en tabla `plans`; la app pregunta `can()`, nunca "¿es Pro?". |
| 1b. Invitaciones y Pro por contrato de liga | Hecho y probado | Código aleatorio de 48 bits, límite de intentos; el Pro de la liga es derivado y se quita solo al desvincular o vencer el contrato. |
| 2. Gestión de equipos y jugadores | Hecho y probado | Equipos en base de datos con las mismas pantallas que los de archivo; Diablos y el club de ejemplo no se tocan. |
| 3. Torneos, inscripción, calendario, resultados, tabla, goleo | Hecho y probado | Ver detalle abajo. Desde la etapa 10 también grupos y eliminatorias. |
| 4. Administradores con permisos, sanciones, objeciones y protestas, finanzas de liga, bitácora, reportes | Hecho y probado | Ver detalle abajo. Reportes en CSV y, desde la etapa 10, para imprimir o guardar como PDF. |
| 5. Registro de jugadores, padrón central, credenciales | Hecho y probado | Ver detalle abajo. `match_events.player_id` sigue sin enlazarse al padrón (los goleadores se escriben a mano). |
| 6. Página pública y componente incrustable | Hecho y probado (demo + SQL local) | Ver detalle abajo. |
| 7a. Acta por foto con confirmación humana | Hecho y probado salvo el OCR real | Captura a mano e intérprete de texto probados; OCR en el celular y servicio propio **sin probar** (ver `docs/ACTAS.md`). |
| 7b. Asistente por liga | Motor local hecho y probado; servicio con modelo **no desplegado** | Cupo diario en base de datos probado. Ver `docs/ASISTENTE.md`. |
| 7c. WhatsApp oficial | Solo documentado, no implementado | `docs/WHATSAPP.md`. |
| 8. Pulido móvil, guía de activación, revisión independiente | Hecho | `supabase/LEEME.md`; prueba móvil a 360 px; revisión por un agente aparte (abajo). |
| 9. Seguridad, privacidad y preparación para Supabase real | Hecho y probado (local + demo) | Ver «Etapa 9». **Pendiente: probar en un proyecto real** (`supabase/LEEME.md` §6). |
| 10. Grupos y eliminatorias, reportes PDF, exportaciones | Hecho y probado (local + demo) | Ver «Etapa 10». |

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
- Desde la etapa 9 la app pide y guarda el consentimiento (y el del tutor para menores); la validez legal del aviso la revisa la liga.
- Las fotos solo se probaron con el almacenamiento simulado (modo demo) y con las políticas de storage cargadas en PostgreSQL local; falta una prueba real contra un proyecto de Supabase.

## Límites conocidos de la etapa 4
- Los delegados de los equipos todavía no presentan objeciones ellos mismos desde su cuenta: las registra un administrador de la liga.
- La evidencia de una sanción es texto o enlace; subir la foto o el archivo llega con el almacenamiento de imágenes (etapas 5 y 7).
- Las suspensiones se registran y se ven, pero no bloquean automáticamente la captura de goles/alineaciones de ese jugador.
- ~~Reportes en PDF~~: resuelto en la etapa 10 (imprimir o guardar como PDF).

## Límites conocidos de la etapa 3
- El cobro de la cuota de inscripción solo se muestra; su seguimiento llega con las finanzas de la liga (etapa 4).
- ~~Eliminatorias y grupos~~: resuelto en la etapa 10.
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

## Etapa 9 en detalle (seguridad, privacidad y preparación para producción, 23 oct 2026)
- **Registro por enlace sin sondeo:** quien ya está inscrito recibe exactamente la misma respuesta que alguien nuevo; no se crea nada y la liga lo ve en la bitácora («registro duplicado»). Un envío por enlace o por delegado nunca modifica a una persona que ya existe en el padrón. Al delegado no se le dice en qué equipo está la persona.
- **Topes de frecuencia en la base de datos**, contados antes de cualquier error (los errores se devuelven, no se lanzan, para que el conteo no se deshaga): enlace de registro 30 intentos cada 10 min por red y hasta 3 por cupo por hora por enlace; información del enlace 60 cada 10 min; página pública 600 cada 10 min; asistente 20 por hora por persona y el tope diario de la liga (el día cuenta en la zona horaria de la liga); delegado 60 por hora. La IP se toma de `X-Forwarded-For` (guía de Supabase) y se guarda solo como huella con un secreto; los topes por enlace, liga y cuenta no dependen de la IP. Tamaño máximo de los datos de registro: 3 KB.
- **Archivos:** cada almacén tiene tope (1 a 5 MB) y solo admite JPG, PNG o WEBP; la ruta, el permiso y el plan se validan al subir (`storage_can_write`); las actas solo para partidos de esa liga; el almacén público ya no se puede listar. En el navegador se rechaza antes de subir lo que no es foto.
- **Privacidad por omisión:** la página pública no publica nombres (la liga elige «iniciales» o «completo»); si la liga marca que hay menores, la base impide publicarlos; hora y cancha se pueden ocultar. El reglamento escrito ya no sale en la API pública. El logo de la liga solo puede ser un archivo de nuestro almacén.
- **Aviso de privacidad y consentimiento:** cada liga publica un aviso versionado (plantilla con partes [entre corchetes] por completar; no es asesoría legal). Sin aviso no se registra a nadie. Quien se registra por enlace lo acepta; la liga o el delegado declaran el consentimiento; para menores de 18 años se exigen nombre y autorización de madre, padre o tutor. Queda guardado con la versión. Si el aviso cambia, lo aceptado antes ya no vale en el enlace.
- **Datos mínimos:** el documento de identidad ya no se pide por omisión; la fecha de nacimiento es obligatoria (sin ella no se sabe si es menor). **Derecho a borrar:** «Borrar sus datos personales» deja un registro anónimo y elimina la foto.
- **Finanzas de equipos de la app privadas** por omisión (solo jugadores aprobados); el administrador puede abrirlas. Diablos y el ejemplo siguen como siempre.
- **Preparación para Supabase:** `supabase/verificar.sql` (10 revisiones de solo lectura, probadas también en negativo), `tests/check_secrets.sh` (sin claves secretas en archivos ni historial), migraciones de datos de una sola vez (`schema_migrations`), reaplicar el esquema con datos sin cambiar ninguna fila (probado), registro con «Confirm email» encendido, guía con clave publicable y pasos verificados en la documentación de Supabase.
- **Prueba integral** de los 10 flujos (`tests/e2e/test_integral.py`, con control positivo) y **matriz de acceso** en la base (anon, cuenta sin rol, otra liga y administrador limitado no leen ni escriben datos ajenos).

## Etapa 10 en detalle (formatos y reportes)
- Formatos: liga, grupos, eliminación directa, y grupos con eliminación (pasan 1 a 4 por grupo). Sorteo equilibrado de grupos, tablas por grupo con los clasificados marcados, eliminatoria sembrada (el 1 y el 2 solo pueden cruzarse en la final; 1º de un grupo contra 2º de otro), siguiente ronda con los ganadores, penales en empates de eliminatoria y campeón.
- La base valida que los partidos de grupo sean del mismo grupo, que la eliminatoria espere a que terminen los grupos, que cada ronda sea entre los ganadores, los penales, y que no se corrija una llave si la siguiente ronda ya está armada. Los torneos que ya existían siguen como liga.
- Reportes para imprimir o «Guardar como PDF»: tabla (con grupos y llaves), calendario, goleo, saldos de finanzas, sanciones y planillas por equipo para el día de partido (sin datos personales). Exportación CSV de tabla, calendario y goleo.
- Pruebas: 19 unitarias de llaves, 8 de reportes, 21 de base de datos y 23 de navegador (formatos y reportes).

## Riesgos que siguen abiertos
- **Nada se ha probado contra un proyecto real de Supabase** (correo, Google, almacenamiento, cabecera `X-Forwarded-For`, Advisors). Es lo primero antes de usarlo con datos reales.
- Si Supabase no pasara la IP en `X-Forwarded-For`, los topes por persona se volverían comunes para todos los visitantes (más estrictos); los topes por enlace y por liga siguen. Está en la lista de comprobación.
- Cualquier persona puede gastar el tope diario del asistente de una liga (solo afecta al servicio con modelo, que no existe todavía; las respuestas locales siguen).
- `profiles.photo_url` y el escudo de equipos de la app guardan una URL completa (funciones de equipo anteriores): no se restringió el dominio como se hizo con el logo de liga.
- Tesseract.js (lectura en el celular) se descarga de un CDN sin verificación de integridad y descarga sus datos de idioma de servidores de terceros; no se probó.
- supabase-js está fijado en 2.45.4. Supabase indica que cualquier versión funciona con la clave publicable, pero no se pudo comprobar aquí: si el inicio de sesión falla con la clave publicable, actualizar la versión es lo siguiente a revisar.
- La plantilla del aviso de privacidad no es un documento legal; el consentimiento de menores lo declara la liga o el delegado (la app guarda quién lo declaró).
- Paridad demo/SQL con diferencias menores conocidas (formato del marcador de actas, ruta de archivos, el demo no simula topes por IP).

## Lista priorizada de pendientes
1. **Activar Supabase real y completar `supabase/LEEME.md` §6** (incluye la prueba de topes por IP y el Security Advisor). Sin esto no declarar la app lista para producción.
2. Revisión legal del aviso de privacidad y del flujo de consentimiento de menores por parte del responsable de cada liga.
3. Probar el OCR con actas reales; decidir si vale un servicio de lectura.
4. Restringir también las URLs de escudos y fotos de perfil de los equipos de la app a nuestro almacén.
5. Enlazar goles y tarjetas al padrón (hoy son texto) para que las suspensiones bloqueen alineaciones.
6. Precios y planes reales (hoy configurables y vacíos).
7. Avisos por WhatsApp oficial (`docs/WHATSAPP.md`) si la liga acepta el costo por mensaje.
