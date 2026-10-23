# Asistente de preguntas de la liga

Estado: **implementado y probado** el motor local por reglas (pruebas unitarias y de navegador) y el control de cupo diario (pruebas de base de datos). El **servicio con modelo de lenguaje no está desplegado**: solo existe el adaptador y el contrato.

## Qué ve el asistente
Únicamente lo que ya es público en la página de la liga (`public_tournament`): tabla, calendario, resultados y goleo si la liga lo publica. No tiene acceso a jugadores, documentos, finanzas, sanciones, notas ni cuentas. Es la misma información que cualquiera ve sin entrar.

## Motores (`app/chatbot.js`)
- **Local (por defecto)**: reglas sobre los datos públicos. Sin costo, sin servidor. Contesta posiciones, puntos de un equipo, próximos partidos, últimos resultados, goleo y puntos por victoria/empate. Si no sabe, lo dice; no inventa.
- **Servicio (opcional)**: pon su dirección en `CHAT.server` de `app/config.js`. Contrato:
  - `POST <url>` JSON `{"league": "<id>", "question": "<≤300 caracteres>", "context": "<JSON público, ≤6000 caracteres>"}`.
  - Responde `200 {"answer": "…"}`; `429` si se agotó el tope diario.
  - Si el servicio falla, la app responde con el motor local.
  - Cambiar de proveedor de modelo = cambiar el servicio; la app no cambia.

## Control de costo
- La liga fija en Ajustes el **tope diario** de preguntas al servicio (0 a 5000) y puede apagar el asistente.
- El tope se aplica en la base de datos con `chat_take(liga)`: cuenta por día, no pasa del límite, devuelve `{ok, remaining}` o `{ok:false, error:"limit"|"off"}`. Es llamable sin cuenta, y nadie puede leer ni escribir el contador directamente.
- **El servicio debe llamar a `chat_take` antes de cada llamada al modelo** (`POST <SUPABASE_URL>/rest/v1/rpc/chat_take` con la clave pública y `{"l":"<liga>"}`) y no responder si `ok` es falso. Un tope solo en el navegador se salta fácilmente, por eso el punto de control está en el servicio.
- Además: pregunta ≤300 caracteres, contexto ≤6000, 30 preguntas por visita y 1.5 s entre preguntas en la página.
- Las respuestas locales no consumen tope.
- El servicio debería fijar un máximo de tokens de salida y un presupuesto mensual en el panel del proveedor.

## Instrucciones recomendadas para el modelo del servicio
Responder solo con el contexto recibido; si falta el dato, decir que no lo tiene; no dar opiniones ni datos personales; contestar en español, breve.

## Pendiente
- Desplegar y probar un servicio real (y medir su costo con tráfico real).
- Contar cuántas preguntas locales hubo (hoy solo se cuentan las del servicio).
- Mejorar las reglas con las preguntas reales de los usuarios.
