# Actas desde foto

Estado: **implementado y probado** en modo demo (navegador) y en las funciones SQL (PostgreSQL local). **No probado** contra un proyecto real de Supabase ni con el OCR real.

## Cómo funciona
1. En el calendario del torneo, el administrador con permiso de **resultados** toca **Acta** en un partido pendiente y sube la foto.
2. La foto original se guarda en el bucket privado `actas` (ruta `<liga>/<partido>/<id>.jpg`). **No hay forma de borrarla ni reemplazarla desde la app**: las políticas de storage solo permiten subir y leer. Descartar un acta solo cambia su estado; la imagen se conserva.
3. Se obtiene un borrador de tres maneras (todas devuelven texto o captura):
   - **A mano**: se escribe el marcador y los eventos mirando la foto. Siempre disponible.
   - **Pegar o escribir el texto del acta** y tocar «Interpretar texto». El intérprete (`app/ocr/parse.js`) entiende líneas como `Marcador: 2 - 1`, `Gol: Pepe (Rayos)`, `Amarilla: Tito - Lobos`, y avisa de todo lo dudoso.
   - **Leer con el celular (OCR)**: Tesseract.js dentro del navegador. La foto no sale del teléfono; la primera vez descarga el motor y el idioma desde jsDelivr. *No se probó en el entorno de pruebas (sin red); la letra a mano se lee mal.*
   - **Leer con el servicio**: opcional, ver abajo.
4. El borrador se guarda (`save_acta_draft`) y **no cambia nada oficial**. Solo **Confirmar y registrar** (`confirm_acta`) llama a `record_result`, la misma función de la captura manual: mismas reglas (goles de jugadores ≤ marcador, torneo no terminado, permiso de resultados), y el cambio queda en la bitácora.
5. Si el partido ya tiene resultado, confirmar otra acta se rechaza; para corregir se usa «Corregir» en el calendario.

## Privacidad
- El acta puede traer nombres, números y observaciones. El bucket es privado y solo lo leen administradores con permiso de resultados, con enlaces firmados temporales.
- Si usas el **servicio de lectura**, la foto sale hacia ese servicio: elígelo y avisa a tus jugadores en tu aviso de privacidad. Con el OCR del celular no sale.
- Hasta 5 actas pendientes por partido (freno contra abuso).

## Servicio de lectura propio (opcional, no desplegado)
En `app/config.js` pon la dirección en `OCR.server`. Contrato:
- `POST <url>` con el cuerpo = imagen (JPEG), cabecera `Authorization: Bearer <token de sesión del usuario>`.
- Responde `200` con JSON `{"text": "…texto leído…"}`. Cualquier otra cosa se muestra como error.
- El servicio **debe validar el token** (que sea un administrador de la liga) y poner su propio tope de uso. Las claves del proveedor de OCR viven solo en el servicio, nunca en este repositorio.
- Puede implementarse como función de Supabase (Edge Function) que llame al proveedor que elijas. Cambiar de proveedor no toca la app: solo el servicio.

## Pendiente
- Probar el OCR real con actas reales y ajustar el intérprete a su formato.
- Prueba contra Supabase real (subida al bucket, políticas, URLs firmadas).
- Archivos huérfanos: si la subida funciona pero el registro falla, queda una imagen sin acta; no estorba, pero no hay limpieza automática.
- Quien sube un archivo al bucket no pasa por el plan hasta registrar el acta (`create_acta` sí lo valida).
