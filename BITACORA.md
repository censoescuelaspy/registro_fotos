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
- Al actualizar la version con `clasp`, Google restringio nuevamente el acceso anonimo del deployment. Debe guardarse otra vez como **Cualquier usuario** desde la cuenta propietaria y comprobar `"ok": true`.
- El workflow de GitHub Pages queda preparado en `docs/PAGES_WORKFLOW_TEMPLATE.yml`. La cuenta colaboradora puede hacer push del proyecto, pero GitHub exige ampliar su token con alcance `workflow` antes de activarlo en `.github/workflows/pages.yml`.

### Seguridad

La hoja y la carpeta de fotos deben ser privadas. Debe eliminarse cualquier permiso de edicion abierto por enlace antes del uso operativo.
