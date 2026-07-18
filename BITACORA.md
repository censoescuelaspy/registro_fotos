# Bitacora

## 2026-07-18 - Version inicial

### Objetivo

Crear una PWA separada para capturar y organizar fotografias del piloto CIALPA, compatible con el registro manual y preparada para asociacion posterior por OCR.

### Implementado

- Catalogo de 86 escuelas piloto: 15 de Capital y 71 de Central.
- Mapa OSM/satelite, busqueda, filtros, GPS, distancia y navegacion externa.
- Acceso por cedula/PIN, solicitudes, roles, usuarios y asignaciones.
- Registro por formulario, hoja, bloque, piso, espacio, tipo de espacio y danos/fallas.
- Camara trasera, compresion, pie identificador, vista previa y foto completa de la hoja.
- Cola IndexedDB, borradores, sincronizacion idempotente y huella SHA-256.
- Recuperacion de registros sincronizados y continuidad de su numeracion fotografica desde **Mi trabajo**.
- Panel administrativo con resumen por censista, registros recientes y acceso a la carpeta privada.
- Backend GAS con nueve hojas normalizadas y jerarquia privada de Drive.
- Ficha oficio y manual v1.4 en PDF, PPTX y Google Slides editable.
- Google Slides v1.4 verificado con dos paginas editables: `1JrEKh1W2ns9FQy5rp37MnfQI6LEChMbET0rZEYdlVl4`.

### Validacion local

- Sintaxis JavaScript frontend, service worker y GAS.
- Generacion reproducible del catalogo desde el XLSX oficial.
- Playwright: 10 recorridos aprobados en Chrome de escritorio y Pixel 7, ejecutados desde disco local para evitar bloqueos de E/S de Google Drive.
- Render de las dos paginas oficio y control visual del PDF.

### Estado de publicacion

- Autorizacion de Sheets/Drive completada desde el editor oficial de Apps Script.
- Error inicial de `ensureSheet_` corregido al resolver los encabezados por nombre real de hoja.
- Codigo GAS actualizado y deployment `AKfycbz8...hNjYk` configurado en la PWA.
- Al actualizar la version con `clasp`, Google restringio temporalmente el acceso anonimo; la cuenta propietaria restauro **Cualquier usuario** y el endpoint volvio a responder `"ok": true`.
- La cuenta colaboradora amplio su token con alcance `workflow` y se activo `.github/workflows/pages.yml` para publicar la PWA automaticamente.

## 2026-07-18 - Reintento de publicacion

### Verificacion operativa

- El endpoint GAS responde `200`, `ok: true`, version `1.0.2` y esquema `2026-07-18.1`.
- La hoja en linea contiene las nueve pestanas normalizadas y conserva configuracion regional `es_PY` con zona horaria `America/Asuncion`.
- La pestana `ESCUELAS` contiene las 86 instituciones piloto de Capital y Central.
- Se activo el workflow de GitHub Pages despues de autorizar el alcance `workflow` para la cuenta colaboradora.
- `secureStorage` retiro el permiso publico de edicion de la hoja y mantuvo privada la carpeta de fotografias.
- Al cerrar el permiso por enlace, la cuenta mantenedora perdio temporalmente acceso a la hoja y el backend no pudo inicializarla. El propietario restauro el servicio compartiendo la hoja de forma privada con `dmeza.py@gmail.com` como editor, sin reabrir el acceso general.

### Correccion CORS v1.0.3

- El smoke test de la URL publica detecto que el navegador bloqueaba las respuestas `ContentService` de Apps Script por CORS, aunque el endpoint respondia correctamente por HTTP directo.
- El frontend envia ahora las solicitudes mediante un formulario POST oculto; GAS devuelve una respuesta HTML minima por `postMessage`, limitada a origenes autorizados.
- PIN, token, metadatos y fotos permanecen en el cuerpo POST y no se colocan en parametros de URL.
- Se conserva la respuesta JSON para clientes POST existentes que no usan el transporte iframe.
- Validacion local: sintaxis de 13 archivos JavaScript y 12/12 pruebas Playwright aprobadas en escritorio y Pixel 7, incluido el puente anti-CORS.
- El puente fue ampliado para reconocer los subdominios HTTPS dinamicos que usa HtmlService, manteniendo la comprobacion de origen y el identificador unico de solicitud.

### Cierre operativo v1.0.4

- Backend GAS actualizado sobre el mismo enlace de produccion, deployment `@11`; responde `200`, `ok: true`, version `1.0.4` y `bootstrapRequired: false`.
- Cuenta administrativa provisionada en la hoja privada con usuario fijo, rol `ADMIN` y credencial almacenada solo como hash salado. La contrasena no se guarda en el repositorio.
- El formulario de acceso acepta el usuario administrativo o la cedula numerica de cada censista.
- Se corrigio el conteo de filas vacias con casillas de verificacion: el panel administrativo informa un usuario real, no las 999 filas preparadas de la hoja.
- Prueba real contra produccion aprobada: salud, inicio de sesion, carga de las 86 escuelas, panel administrativo y cierre de sesion, sin errores de navegador.
- Validacion local final: sintaxis de 18 archivos JavaScript y 14/14 pruebas Playwright aprobadas en escritorio y Pixel 7.
- Frontend `1.0.4` publicado desde el commit funcional `6f02889` y verificado en `https://censoescuelaspy.github.io/registro_fotos/`: sin alerta de sincronizacion, 86 escuelas visibles y panel administrativo operativo en viewport movil.

### Seguridad

La hoja y la carpeta de fotos deben ser privadas. Debe eliminarse cualquier permiso de edicion abierto por enlace antes del uso operativo.

## 2026-07-18 - Operacion y logistica v1.1.0

### Objetivo

Recuperar para la app fotografica las capacidades operativas valiosas de la app CIALPA original, adaptadas al registro manual y sin incorporar modulos ajenos a este flujo.

### Implementado

- **Mi jornada** con avance personal, proxima escuela por orden o cercania, borradores, cola y registros sincronizados.
- **Control** con indicadores generales, avance por censista y registros recientes.
- **Encuestadores** como vista independiente con filtros, alta, edicion, activacion, desactivacion y cuenta administrativa principal protegida.
- **Logistica** con filtros territoriales, carga por censista, estimacion de tiempo, balanceo de pendientes, rutas Google Maps, borrador de cambios, deshacer y CSV.
- **Solicitudes** como bandeja separada por estado, con aprobacion o rechazo administrativo.
- Guardado GAS por lote con una asignacion activa por escuela e historial anterior conservado como inactivo.
- Navegacion administrativa completa en escritorio y pestañas desplazables dentro de **Control** en celular.
- Estados activos con cambio visible de color y filas logisticas modificadas claramente identificadas.
- Destruccion segura del mapa Leaflet al cambiar rapidamente de modulo, sin errores de animacion pendientes.

### Validacion

- Sintaxis aprobada para 14 modulos JavaScript de frontend/GAS, service worker y pruebas.
- Playwright: 22/22 recorridos aprobados en Chrome de escritorio y Pixel 7.
- La suite cubre mapa, camara, pie fotografico, reapertura, jornada, control, usuarios, logistica, CSV, solicitudes, puente GAS, navegacion completa, consola y desborde horizontal.
- Inspeccion visual de Logistica en escritorio y Encuestadores en celular sin solapamientos incoherentes.

### Backend

- GAS publicado sobre el mismo enlace estable, deployment `@13`.
- Verificacion HTTP: `ok: true`, version `1.1.0`, esquema `2026-07-18.1` y `bootstrapRequired: false`.
- No se modificaron asignaciones ni registros reales durante las pruebas automatizadas.
