# Activar cuentas con Google y pagos (una sola vez)

Mientras `app/config.js` esté vacío, la app funciona como siempre, sin cuentas. Para activarlas:

## 1. Supabase (la base de datos, plan gratis)
1. Entra a https://supabase.com y crea un proyecto nuevo (región West US). Guarda la contraseña de la base de datos.
2. **SQL Editor > New query**: pega todo `supabase/schema.sql` y toca **Run**. Se puede volver a correr sin problema cada vez que el archivo cambie.
3. **Authentication > URL Configuration**:
   - Site URL: `https://jorgecamberos100-sudo.github.io/Club-Diablos/`
   - Redirect URLs: agrega `https://jorgecamberos100-sudo.github.io/Club-Diablos/**`
4. **Authentication > Sign In / Providers > Email**: apaga **Confirm email** (para quien entre con correo en vez de Google).

## 2. Google (para entrar con un toque)
1. Entra a https://console.cloud.google.com con tu cuenta de Google y crea un proyecto ("Club Diablos").
2. **APIs y servicios > Pantalla de consentimiento de OAuth**: tipo **Externo**, nombre "Club Diablos", tu correo. Publica la app (botón **Publicar app**) para que cualquiera pueda entrar.
3. **APIs y servicios > Credenciales > Crear credenciales > ID de cliente de OAuth**: tipo **Aplicación web**. En **URI de redireccionamiento autorizados** pega la que te da Supabase en **Authentication > Sign In / Providers > Google** (termina en `/auth/v1/callback`).
4. Copia el **ID de cliente** y el **Secreto**, pégalos en Supabase en **Authentication > Sign In / Providers > Google**, actívalo y guarda.

## 3. Conectar la app
En Supabase, **Project Settings > API**: copia **Project URL** y la clave **anon public** y ponlas en `app/config.js`.
La clave anon es pública y es segura ahí. Nunca uses ni compartas la clave **service_role**.

## 4. Primer uso
- Entra tú primero con Google y elige tu nombre: la primera cuenta queda como administrador.
- Después manda el enlace al grupo. Cada jugador toca **Continuar con Google**, elige su nombre y tú lo apruebas con un toque.

## Pagos
- El jugador, en **Finanzas > Mi cuenta**, toca **Ya pagué**, pone la cantidad y la foto del comprobante. Queda en revisión.
- En **Inicio** te aparece el aviso de pagos por revisar. Al aprobar, su cuenta, la caja y lo que falta se actualizan solos.
- En el **Panel de administrador** registras pagos en efectivo, uniformes y lo que pagas a la liga.
- Los comprobantes son privados: solo los ven quien lo subió y el administrador.
- Las cifras de los archivos del equipo siguen siendo la base; los pagos de la app se suman encima. Ya no hace falta editar `aportado` a mano.

## Probar sin servidor
Agrega `?demo` antes del `#` del enlace (por ejemplo `.../Club-Diablos/?demo#/diablos/domingos/inicio`). Todo se guarda solo en ese navegador.

## Cuentas, planes y ligas
- Si ya corriste `schema.sql` antes, vuelve a correrlo completo: agrega las tablas nuevas sin borrar nada.
- Mi cuenta: `#/cuenta`. Ahí cada cuenta elige si organiza equipos, ligas o ambos, y crea su liga.
- Panel de liga: `#/liga/<liga>/inicio`. Quien crea la liga queda como superadministrador.
- Planes: tabla `plans`. Funciones (`features`) y límites (`limits`) se cambian ahí, sin tocar la app. Los precios quedan vacíos hasta decidirlos.
- Dar Pro a un equipo a mano: agrega una fila en `subscriptions` con `subject_type` = team, `subject_id` = club/equipo (ej. `diablos/domingos`) y `plan_id` = team-pro. Nadie puede darse Pro desde la app.
