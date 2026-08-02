# Diccionario de datos

## Hojas

| Hoja | Funcion | Clave principal |
|---|---|---|
| `CONFIG` | Version, esquema y carpeta privada | `clave` |
| `USUARIOS` | Identidad, rol, hash salado del PIN y estado | `codigo_censista` |
| `SESIONES` | Tokens hash y vencimiento | `token_hash` |
| `ESCUELAS` | Catalogo piloto, coordenadas, codigo RUE y sede fisica | `codigo` |
| `ASIGNACIONES` | Escuela autorizada por censista | `assignment_id` |
| `REGISTROS` | Una ficha por escuela, B/P/E/H y censista | `record_key` |
| `FOTOS` | Metadatos y vinculo privado de cada imagen | `foto_id` |
| `SOLICITUDES` | Altas pendientes de aprobacion | `solicitud_id` |
| `AUDITORIA` | Acciones relevantes del sistema | `event_id` |

## Identificadores

- `record_id`: `ESCUELA-B##-P##-E###-H##`.
- `record_key`: `codigo_censista:record_id`; evita mezclar fichas de usuarios distintos.
- `codigo_rue`: codigo oficial normalizado a siete digitos, sin sustituir `codigo` ni `codigo_escuela`.
- `sitio_id`: unidad fisica de visita `CIALPA-S###`; puede agrupar mas de un codigo RUE.
- `rue_seccion`: seccion equivalente del modulo de infraestructura de RUE.
- `rue_clave_espacio`: `RUE:CODIGO:SECCION:B##:PLANTA:E###`; permite conciliar el mismo espacio entre sistemas.
- `codigo_elemento`: codigo de dos letras y numero, por ejemplo `PT01` o `DF02`.
- `codigo_foto`: `record_id-codigo_elemento-FT##`.
- `idempotency_key`: evita duplicados al reintentar una sincronizacion.
- `sha256`: comprueba que el archivo recibido coincide con la imagen preparada en el celular.

Los campos `drive_file_id`, `drive_url` y `thumbnail_url` relacionan Sheets con el archivo privado de Drive. La hoja no contiene la imagen binaria.

## Regla de almacenamiento de codigos

| Campo | Uso | Formato canonico |
|---|---|---|
| `codigo` / `codigo_escuela` | Llave historica de la app, asignaciones, registros, fotos y carpetas | Codigo interno del catalogo, sin ceros RUE agregados |
| `codigo_rue` | Intercambio y conciliacion con MEC-RUE | Exactamente siete digitos |
| `sitio_id` | Construccion o sede fisica que se visita | `CIALPA-S###` |

Las entradas pueden contener el codigo interno o el codigo RUE. Antes de guardar, el backend resuelve el establecimiento en `ESCUELAS` y conserva simultaneamente el codigo interno canonico, `codigo_rue` y `sitio_id`. Esta regla se aplica a `REGISTROS` y `FOTOS`; evita que `11007` y `0011007` creen escuelas o fichas duplicadas.
