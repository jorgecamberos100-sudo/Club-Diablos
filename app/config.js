// Conexión a la base de datos (Supabase). Mientras esté vacío, la app funciona como antes, sin cuentas.
//   url: "https://xxxx.supabase.co"   key: la clave pública "anon" (es segura aquí; NUNCA la "service_role")
//   url: "demo"  -> modo de prueba: cuentas y votos se guardan solo en este navegador.
export const CLOUD = { url: "", key: "" };
