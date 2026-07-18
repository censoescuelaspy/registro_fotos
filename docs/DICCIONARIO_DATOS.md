# Diccionario de datos

## Hojas

| Hoja | Funcion | Clave principal |
|---|---|---|
| `CONFIG` | Version, esquema y carpeta privada | `clave` |
| `USUARIOS` | Identidad, rol, hash salado del PIN y estado | `codigo_censista` |
| `SESIONES` | Tokens hash y vencimiento | `token_hash` |
| `ESCUELAS` | Catalogo piloto y coordenadas | `codigo` |
| `ASIGNACIONES` | Escuela autorizada por censista | `assignment_id` |
| `REGISTROS` | Una ficha por escuela, B/P/E/H y censista | `record_key` |
| `FOTOS` | Metadatos y vinculo privado de cada imagen | `foto_id` |
| `SOLICITUDES` | Altas pendientes de aprobacion | `solicitud_id` |
| `AUDITORIA` | Acciones relevantes del sistema | `event_id` |

## Identificadores

- `record_id`: `ESCUELA-B##-P##-E###-H##`.
- `record_key`: `codigo_censista:record_id`; evita mezclar fichas de usuarios distintos.
- `codigo_elemento`: codigo de dos letras y numero, por ejemplo `PT01` o `DF02`.
- `codigo_foto`: `record_id-codigo_elemento-FT##`.
- `idempotency_key`: evita duplicados al reintentar una sincronizacion.
- `sha256`: comprueba que el archivo recibido coincide con la imagen preparada en el celular.

Los campos `drive_file_id`, `drive_url` y `thumbnail_url` relacionan Sheets con el archivo privado de Drive. La hoja no contiene la imagen binaria.
