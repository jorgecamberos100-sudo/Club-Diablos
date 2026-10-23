# Activar Club Diablos como plataforma (guía de activación)

**Estado honesto:** todo el código y el SQL se probaron contra una base PostgreSQL local con un simulador de Supabase y contra el modo demo del navegador. **Nunca se ha activado contra un proyecto real de Supabase.** Esta guía es el camino para hacerlo; el punto 6 es una lista de comprobación para confirmar que todo funciona de verdad.

Mientras `app/config.js` esté vacío, la app funciona como siempre (Diablos y el club de ejemplo desde sus archivos, sin cuentas). Para probar las cuentas, ligas y torneos sin servidor: agrega `?demo` antes del `#` del enlace (por ejemplo `.../Club-Diablos/?demo#/cuenta`). En demo todo se guarda solo en ese navegador.

## 1. Crear el proyecto en Supabase (plan gratis alcanza para empezar)
1. Entra a https://supabase.com y crea un proyecto nuevo. Guarda la contraseña de la base de datos.
2. **SQL Editor > New query**: pega todo `supabase/schema.sql` y toca **Run**.
   - Es **un solo archivo, seguro de repetir**: se puede correr de nuevo completo cada vez que cambie, sin borrar datos (las pruebas lo aplican dos veces para comprobarlo). Esas son las "migraciones": no hay carpeta de migraciones aparte.
   - Crea tablas, permisos por fila, funciones, planes, y los cuatro almacenes de archivos (ver punto 5).
3. **Authentication > URL Configuration**:
   - Site URL: `https://jorgecamberos100-sudo.github.io/Club-Diablos/`
   - Redirect URLs: agrega `https://jorgecamberos100-sudo.github.io/Club-Diablos/**`
4. **Authentication > Sign In / Providers > Email**: apaga **Confirm email** si quieres que quien entre con correo no tenga que confirmarlo.

## 2. Entrar con Google (opcional, recomendado)
1. https://console.cloud.google.com: crea un proyecto ("Club Diablos").
2. **APIs y servicios > Pantalla de consentimiento de OAuth**: tipo **Externo**, nombre, tu correo. Publica la app.
3. **Credenciales > Crear credenciales > ID de cliente de OAuth**: tipo **Aplicación web**. En **URI de redireccionamiento autorizados** pega la que muestra Supabase en **Authentication > Sign In / Providers > Google** (termina en `/auth/v1/callback`).
4. Copia el **ID de cliente** y el **Secreto**, pégalos en Supabase (Google) y activa el proveedor.

## 3. Conectar la app
En Supabase, **Project Settings > API**: copia **Project URL** y la clave **anon public** y ponlas en `app/config.js`:

```
export const CLOUD = { url: "https://xxxx.supabase.co", key: "<clave anon public>" };
```

La clave anon es pública y es segura ahí (las reglas de acceso están en la base de datos). **Nunca** pongas ni compartas la clave `service_role`, ni claves de proveedores de OCR o de modelos de lenguaje: no hay secretos en este repositorio.

## 4. Primer uso
1. Entra tú primero. En `#/cuenta` elige "Liga", crea tu liga: quedas como **superadministrador**. Para Diablos, entra y elige tu nombre: la primera cuenta queda como administrador del equipo.
2. En la liga: **Equipos** (crea un código de invitación para los delegados), **Torneos** (crea, inscribe equipos, genera el calendario), **Jugadores**, **Sanciones**, **Finanzas**, **Ajustes** (marca, página pública, administradores, bitácora).
3. Planes: tabla `plans`. Las funciones (`features`) y límites (`limits`) se cambian ahí **sin tocar código**. Los precios quedan vacíos: la app no cobra ni fija precios. Toda liga recibe el plan `league-base` (marcado `is_default`).
4. Dar Pro a un equipo a mano: fila en `subscriptions` con `subject_type` = team, `subject_id` = `club/equipo` (ej. `diablos/domingos`) y `plan_id` = `team-pro`. Nadie puede darse Pro desde la app.
5. Si ya tenías el proyecto activado antes de estas etapas, solo vuelve a correr `schema.sql` completo.

## 5. Almacenes de archivos (Storage)
Los crea `schema.sql`. Comprueba que existan en **Storage**:

| Almacén | Público | Qué guarda | Quién lo ve |
|---|---|---|---|
| `photos` | sí | escudos, logo de la liga y las fotos de perfil que los jugadores de un equipo suben a su propia tarjeta | cualquiera con el enlace |
| `receipts` | no | comprobantes de pago | quien lo subió y el administrador |
| `player-photos` | **no** | fotos de jugadores del padrón de la liga | administradores con permiso de registro, con enlaces firmados temporales |
| `actas` | **no** | foto original de las actas | administradores con permiso de resultados; **no se puede borrar ni reemplazar** desde la app |

## 6. Lista de comprobación después de activar (hazla una vez, 20 minutos)
Esto es lo que **no** se pudo probar sin un proyecto real. Marca cada punto:
- [ ] Entrar con correo y con Google; cerrar sesión.
- [ ] Crear liga, torneo, inscribir equipos, generar calendario, capturar un resultado, ver la tabla.
- [ ] Una segunda cuenta (otro navegador) con un código de invitación de administrador con solo "calendario": confirmar que **no puede** capturar resultados ni ver finanzas (el error debe decir que no tiene permiso).
- [ ] Registro de un jugador con foto; abrirla (enlace firmado); confirmar que con una cuenta sin permiso **no** se abre.
- [ ] Activar la página pública, publicar el torneo, abrir `#/p/<liga>` **sin sesión** (ventana privada) y comprobar que solo se ven tabla, calendario y goleo.
- [ ] Subir la foto de un acta, confirmarla, y comprobar que en Storage > `actas` el archivo sigue ahí aunque descartes otra.
- [ ] Pegar el código `<iframe>` de Ajustes en una página de prueba y confirmar que carga.
- [ ] En **Advisors** (Security) de Supabase: revisar que no haya tablas sin RLS. Las funciones del esquema validan el permiso dentro de la base de datos; si el Advisor señala funciones ejecutables por `anon`, revisa que sean solo las públicas de la lista siguiente.

Funciones que puede ejecutar un visitante sin cuenta (`anon`): `claimed`, `team_paid`, `reg_link_info`, `register_by_link`, `public_league`, `public_tournament`, `chat_take`. Al final de `schema.sql` un bloque de endurecimiento le quita a `anon` y a `public` el permiso de ejecutar todas las demás (se reaplica en cada corrida), y además cada función valida el permiso por dentro. La prueba de base de datos comprueba esa lista exacta.

## 7. Servicios opcionales que NO vienen desplegados
- **Lectura automática de actas** (OCR con servicio propio): `docs/ACTAS.md`. Sin él, se captura a mano o se lee en el celular.
- **Asistente con modelo de lenguaje**: `docs/ASISTENTE.md`. Sin él, el asistente responde con reglas locales sin costo.
- **WhatsApp oficial** (Cloud API): `docs/WHATSAPP.md`, solo diseño y requisitos. Hoy la app solo crea enlaces `wa.me` que una persona envía desde su WhatsApp.

## 8. Privacidad y menores (léelo antes de registrar jugadores)
- Se guardan datos personales: nombre, fecha de nacimiento, documento (opcional), foto, número. La liga es responsable de tener un **aviso de privacidad** y, para **menores de edad**, el consentimiento del padre, madre o tutor; la app marca a los menores pero no gestiona ese consentimiento.
- Las credenciales impresas no llevan documento ni fecha de nacimiento. La página pública no muestra jugadores salvo el nombre de goleadores, y la liga puede ocultarlo (por omisión se muestran: apágalo en Ajustes si hay menores). Las fotos de jugadores y las actas están en almacenes privados.
- Quien se registra por enlace público no sube foto (evita abuso); la agrega la liga al aprobar.
- La bitácora de cambios no se puede borrar desde la app.

## 9. Probar el código (para quien lo mantenga)
`sh tests/run_all.sh` corre todo: sintaxis de módulos, base de datos (PostgreSQL 16 temporal con un simulador de Supabase), pruebas unitarias y pruebas de navegador en modo demo (Playwright, servidor en el puerto 8765). Requiere PostgreSQL 16, Node y Python con Playwright.

## Pagos del equipo (Diablos)
- El jugador, en **Finanzas > Mi cuenta**, toca **Ya pagué**, pone la cantidad y la foto del comprobante. Queda en revisión; al aprobar se actualizan su cuenta, la caja y lo que falta.
- En el **Panel de administrador** se registran pagos en efectivo, uniformes y lo que se paga a la liga. Los comprobantes son privados.
