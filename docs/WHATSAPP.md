# WhatsApp oficial (WhatsApp Business Platform) — opción documentada, NO desplegada

Estado: **no implementado**. Hoy la app solo genera enlaces `wa.me` para que una persona comparta un mensaje desde su propio WhatsApp (invitaciones, códigos, enlaces). No hay envío automático ni bot.

Datos verificados el 23 de octubre de 2026 en la documentación de Meta (revísalos de nuevo antes de decidir; cambian):
- Se usa la **WhatsApp Business Platform (Cloud API)**, con cuenta de empresa en Meta. [Precios](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
- Cobro **por mensaje entregado** (desde el 1 de julio de 2025). Los mensajes de plantilla (marketing, utilidad, autenticación) se cobran; los mensajes de usuarios a la empresa no. Los mensajes de servicio dentro de la ventana de 24 h tienen un cupo gratis mensual por número (la página lo indica en 1,000 al mes, sin acumular). La tarifa depende del país del destinatario; las tarifas vigentes están en las tarjetas de tarifas de Meta. **Este repositorio no fija precios.**
- Política: desde el 15 de enero de 2026 los términos de Meta prohíben ofrecer asistentes de IA de propósito general como función principal. Un bot de atención de una empresa a sus propios clientes no está afectado según el ejemplo de Meta, pero Meta decide a su criterio. [Nota de TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform). Un asistente de liga que solo contesta sobre su propia liga encaja en lo permitido, sin garantía.

## Diseño propuesto
1. Una función de Supabase (Edge Function) recibe el webhook de WhatsApp, verifica la firma, y contesta usando `public_tournament` y el motor local de `app/chatbot.js` (sin costo de modelo). Con modelo de lenguaje, pasa antes por `chat_take` (ver `docs/ASISTENTE.md`).
2. Avisos (recordatorio de partido, cambio de horario) como plantillas aprobadas de **utilidad**; requieren consentimiento previo (opt-in) de cada persona y guardar ese consentimiento.
3. Un número de WhatsApp por liga o uno compartido de la plataforma: decisión de negocio pendiente.

## Lo que tendría que hacer el responsable (no se puede hacer desde este repositorio)
- Crear/verificar la cuenta de empresa en Meta y registrar un número dedicado.
- Aprobar plantillas y definir el texto de consentimiento.
- Guardar el token de acceso como secreto de la función, nunca en el repositorio.
- Decidir quién paga los mensajes (la liga, la plataforma) antes de activar avisos masivos. La app no cobra ni fija precios.

## Riesgos
- Costos por mensaje que crecen con el número de jugadores.
- Cambios de política de Meta sobre bots.
- Datos personales: guardar teléfonos exige aviso de privacidad y la opción de darse de baja.
- Alternativas no oficiales (librerías que simulan WhatsApp Web) pueden provocar el bloqueo del número: no se recomiendan.
