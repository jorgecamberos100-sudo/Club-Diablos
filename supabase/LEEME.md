# Activar Club Diablos con Supabase real (guía de activación)

**Estado honesto:** el código y el SQL se probaron contra PostgreSQL 16 local con un simulador de Supabase (que imita sus permisos por omisión) y contra el modo demo del navegador. **Nunca se ha activado contra un proyecto real de Supabase.** No declares la app lista para producción hasta completar el punto 6.

Mientras `app/config.js` esté vacío, la app funciona como siempre (Diablos y el club de ejemplo desde sus archivos, sin cuentas). Para probar cuentas, ligas y torneos sin servidor: agrega `?demo` antes del `#` del enlace (por ejemplo `.../Club-Diablos/?demo#/cuenta`). En demo todo se guarda solo en ese navegador.

## Pasos, en este orden (unos 30 minutos)

### 1. Crear el proyecto
1. Entra a https://supabase.com y crea un proyecto nuevo. Guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. **SQL Editor > New query**: pega **todo** `supabase/schema.sql` y toca **Run**. Debe terminar sin error.
   - Es un solo archivo **seguro de repetir**: cada vez que cambie, se vuelve a correr completo y no borra datos. Los cambios de datos de una sola vez quedan anotados en la tabla `schema_migrations` y no se repiten. Las pruebas lo reaplican con datos y comprueban que no cambia ninguna fila.
3. **SQL Editor > New query**: pega `supabase/verificar.sql` y toca **Run**. Las 10 filas deben decir **OK**. Si alguna dice REVISAR, vuelve a correr `schema.sql` y repite; si sigue, no actives la app.

### 2. Cuentas con correo
1. **Authentication > URL Configuration**:
   - **Site URL**: `https://jorgecamberos100-sudo.github.io/Club-Diablos/`
   - **Redirect URLs**: agrega `https://jorgecamberos100-sudo.github.io/Club-Diablos/**`
2. **Authentication > Sign In / Providers > Email**: deja **Confirm email** encendido (recomendado). La app avisa que hay que abrir el correo de confirmación. Si lo apagas, cualquiera puede crear cuentas con correos que no son suyos.
3. Para producción, configura un **servidor de correo propio (SMTP)** en la sección de correos de Authentication: Supabase indica que su correo incluido es para pruebas y tiene un límite bajo de envíos. (No verificado aquí: revisa la página de Supabase al hacerlo.)

### 3. Entrar con Google (opcional, recomendado)
Guía oficial: https://supabase.com/docs/guides/auth/social-login/auth-google
1. En https://console.cloud.google.com, en **Google Auth Platform > Clients**, crea un cliente OAuth de tipo **Web application**.
2. **Authorized JavaScript origins**: `https://jorgecamberos100-sudo.github.io` (solo el dominio, sin ruta).
3. **Authorized redirect URIs**: la URL de callback que muestra Supabase en la página del proveedor Google (termina en `/auth/v1/callback`).
4. En **Data Access (Scopes)** confirma `openid`, `userinfo.email` y `userinfo.profile`. No pidas más permisos.
5. Copia **Client ID** y **Client Secret** en Supabase (**Authentication > Sign In / Providers > Google**) y actívalo. El secreto de Google se queda en Supabase: nunca en el repositorio.

### 4. Conectar la app
1. En Supabase, **Settings > API Keys** (o el botón **Connect**): copia la **Project URL** y la **clave publicable** (`sb_publishable_...`). Si tu proyecto todavía muestra la clave **anon** (legacy), también sirve; Supabase anunció que las claves legacy se retiran hacia finales de 2026, así que usa la publicable.
2. Ponlas en `app/config.js`:

   `export const CLOUD = { url: "https://TU-PROYECTO.supabase.co", key: "sb_publishable_..." };`

3. **Nunca** pongas la clave **secret** (`sb_secret_...`) ni la **service_role**: saltan todas las reglas de seguridad. La prueba `tests/check_secrets.sh` falla si aparece alguna en el repositorio o en su historial.
4. Sube el cambio a `main` (GitHub Pages lo publica solo).

### 5. Primer uso
1. Entra tú primero. En `#/cuenta` elige «Liga» y crea tu liga: quedas como **superadministrador**. Para Diablos, entra y elige tu nombre: la primera cuenta queda como administrador del equipo.
2. En **Ajustes** de la liga, antes de registrar jugadores: **Privacidad** (aviso de privacidad, contacto, y si hay menores). Sin aviso publicado la app no deja registrar a nadie.
3. Planes: tabla `plans`. Funciones (`features`) y límites (`limits`) se cambian ahí sin tocar código. Los precios quedan vacíos: la app no cobra.
4. Dar Pro a un equipo a mano: fila en `subscriptions` con `subject_type` = team, `subject_id` = `club/equipo` y `plan_id` = `team-pro`. Nadie puede darse Pro desde la app.

### 6. Prueba integral en el proyecto real (obligatoria, unos 30 minutos)
Esto **no** se pudo probar sin un proyecto real. Usa dos navegadores (o uno normal y una ventana privada) y marca cada punto:
- [ ] Crear cuenta con correo (llega el correo de confirmación), entrar, salir. Entrar con Google.
- [ ] Crear liga, publicar el aviso de privacidad, crear un código de invitación para equipos; con otra cuenta crear un equipo y vincularlo; aprobarlo.
- [ ] Pro: con contrato de liga el equipo vinculado recibe Pro; un equipo con su propia fila en `subscriptions` lo conserva al desvincularse.
- [ ] Registrar un jugador en oficina con foto; abrir su foto (enlace temporal); con una cuenta sin permiso de registro, comprobar que **no** se abre.
- [ ] Crear un enlace de registro; abrirlo en ventana privada; registrarse como adulto y como menor (pide tutor). Repetir con alguien ya inscrito: debe decir lo mismo que un registro nuevo.
- [ ] Imprimir credenciales.
- [ ] Crear torneo, inscribir equipos, generar calendario, capturar un resultado con goleadores; revisar tabla y goleo.
- [ ] Registrar una sanción, una objeción y un pago de la liga.
- [ ] Activar la página pública, publicar el torneo, abrir `#/p/<liga>` en ventana privada: solo tabla, calendario y (si lo activaste) goleo. Pegar el `<iframe>` en una página de prueba.
- [ ] Subir la foto de un acta, revisar y confirmar; en **Storage > actas** el archivo sigue ahí.
- [ ] Con una cuenta administradora que solo tenga «calendario»: no puede capturar resultados, ver finanzas ni el padrón.
- [ ] Intentar subir un archivo que no sea foto (por ejemplo un PDF) como foto o acta: se rechaza. (Las fotos grandes la app las reduce antes de subir.)
- [ ] Topes por IP: abrir muchas veces seguidas un enlace de registro falso desde la misma conexión; después de unos 30 intentos debe decir «Espera un momento». Si **nunca** lo dice, Supabase no está pasando la IP (`X-Forwarded-For`) y solo quedan los topes por enlace y por liga: anótalo.
- [ ] **Advisors** (seguridad) en el panel de Supabase: sin errores de tablas sin RLS. Si marca funciones `SECURITY DEFINER` ejecutables, deben ser solo las de la lista de abajo.
- [ ] Volver a correr `verificar.sql`: todo OK.

Funciones que puede ejecutar un visitante sin cuenta: `claimed`, `team_paid`, `team_doc`, `reg_link_info`, `register_by_link`, `public_league`, `public_tournament`, `chat_take`. Al final de `schema.sql` un bloque de endurecimiento le quita a `anon` todas las demás en cada corrida; cada función además valida el permiso por dentro.

## Almacenes de archivos (Storage)
Los crea `schema.sql` con tope de tamaño y solo imágenes JPG, PNG o WEBP (nada de SVG, HTML ni PDF):

| Almacén | Público | Tope | Qué guarda | Quién lo ve |
|---|---|---|---|---|
| `photos` | sí (por URL) | 2 MB | escudos, logo de la liga, fotos de perfil que los jugadores suben a su tarjeta | cualquiera con la URL; nadie puede listarlo |
| `receipts` | no | 5 MB | comprobantes de pago | quien lo subió y el administrador del equipo |
| `player-photos` | **no** | 1 MB | fotos del padrón de la liga | administradores con permiso de registro, con enlaces temporales |
| `actas` | **no** | 5 MB | foto original de las actas | administradores con permiso de resultados; **no se puede borrar ni reemplazar** |

## Privacidad y menores
- **Privado por omisión:** la página pública no muestra nombres de jugadores; la liga puede activar «nombre e inicial» o «nombre completo». Si marca que hay menores, los nombres no se publican nunca (la base lo impide). Hora y cancha de los partidos se pueden ocultar. Fotos, documentos, fechas de nacimiento, contactos, notas, finanzas y motivos de sanciones nunca son públicos.
- **Aviso de privacidad y consentimiento:** cada liga publica su aviso (Ajustes > Privacidad). Quien se registra por enlace lo acepta; el delegado o la liga declaran que el jugador lo aceptó. Para menores se pide el nombre y la autorización de madre, padre o tutor. Se guarda con la versión del aviso; si el aviso cambia, se vuelve a pedir.
- **La plantilla del aviso no es asesoría legal.** Tiene partes entre [corchetes] que la liga completa y revisa con quien la asesore. La app no garantiza el cumplimiento de ninguna ley (por ejemplo, la de protección de datos de tu país).
- **Documento de identidad:** no se pide por omisión; la liga lo activa solo si de verdad lo necesita.
- **Derecho a borrar:** en Jugadores > Editar > «Borrar sus datos personales». Quedan los resultados históricos sin datos personales.
- **Finanzas de equipos de la app:** solo las ven los jugadores aprobados del equipo, salvo que el administrador las abra. Diablos y el ejemplo siguen como siempre (sus datos salen de los archivos del repositorio).

## Servicios opcionales que NO vienen desplegados
- Lectura automática de actas con servicio propio: `docs/ACTAS.md`.
- Asistente con modelo de lenguaje: `docs/ASISTENTE.md`.
- WhatsApp oficial (Cloud API): `docs/WHATSAPP.md`.

## Probar el código (para quien lo mantenga)
`sh tests/run_all.sh` corre todo: sintaxis, búsqueda de secretos, base de datos (PostgreSQL 16 temporal), pruebas unitarias y de navegador en modo demo. Requiere PostgreSQL 16, Node y Python con Playwright.

## Pagos del equipo (Diablos)
- El jugador, en **Finanzas > Mi cuenta**, toca **Ya pagué**, pone la cantidad y la foto del comprobante. Queda en revisión; al aprobar se actualizan su cuenta, la caja y lo que falta.
- En el **Panel de administrador** se registran pagos en efectivo, uniformes y lo que se paga a la liga. Los comprobantes son privados.
