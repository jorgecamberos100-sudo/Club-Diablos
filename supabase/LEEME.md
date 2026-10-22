# Activar cuentas y votos (4 pasos, una sola vez)

1. Entra a https://supabase.com con tu cuenta y crea un proyecto nuevo (plan gratis). Elige región cercana (por ejemplo, West US) y guarda la contraseña de la base de datos.
2. En el proyecto: **SQL Editor > New query**, pega todo `supabase/schema.sql` y toca **Run**. Se puede correr varias veces sin problema.
3. **Authentication > Sign In / Providers > Email**: apaga **Confirm email** y guarda. (Así los jugadores entran sin esperar un correo.)
4. **Project Settings > API**: copia **Project URL** y la clave **anon public**. Esos dos datos se ponen en `app/config.js`.
   Nunca uses ni compartas la clave **service_role**.

## Cómo funciona
- La primera cuenta que pide entrar a un equipo sin administrador queda como administrador. Regístrate tú primero, antes de mandar el enlace al grupo.
- Los jugadores crean cuenta, eligen su nombre en la lista y quedan pendientes hasta que el administrador los aprueba.
- Solo el administrador anota resultados y aprueba entradas. Cada jugador edita solo lo suyo. Los votos son anónimos y nadie vota por sí mismo.

## Probar sin servidor
Agrega `?demo` antes del `#` del enlace (por ejemplo `.../club-diablos/?demo#/diablos/domingos/inicio`). Todo se guarda solo en ese navegador.
