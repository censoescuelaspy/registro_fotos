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
- `secureStorage` retiro el permiso publico de edicion de la hoja y mantuvo privada la carpeta de fotografias. El backend del propietario continuo respondiendo despues del cambio.
- La cuenta colaboradora perdio el acceso indirecto que provenia del enlace publico. Para futuras subidas con `clasp`, el propietario debe compartir explicitamente el proyecto Apps Script con el mantenedor, sin reabrir la hoja a cualquiera con el enlace.

### Seguridad

La hoja y la carpeta de fotos deben ser privadas. Debe eliminarse cualquier permiso de edicion abierto por enlace antes del uso operativo.
