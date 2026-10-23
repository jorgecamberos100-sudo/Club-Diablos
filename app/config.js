// Conexión a la base de datos (Supabase). Mientras esté vacío, la app funciona como antes, sin cuentas.
//   url: "https://xxxx.supabase.co"   key: la clave pública "anon" (es segura aquí; NUNCA la "service_role")
//   url: "demo"  -> modo de prueba: cuentas y votos se guardan solo en este navegador.
export const CLOUD = { url: "", key: "" };

// Lectura automática de actas (opcional). Déjalo vacío para capturar a mano o leer en el celular.
//   server: dirección de tu servicio de lectura (ver docs/ACTAS.md). No es un secreto: la autenticación va con la sesión de cada usuario.
export const OCR = { server: "" };
