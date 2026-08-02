# CIALPA Fotos

Aplicacion web instalable para registrar fotografias del relevamiento de infraestructura escolar y mantenerlas vinculadas con la ficha manual. Cada imagen queda asociada a escuela, censista, formulario, hoja, bloque, piso, espacio, elemento y secuencia.

## Flujo de campo

1. El censista ingresa con el codigo operativo asignado o su cedula y el PIN que registra mediante una solicitud aprobada; el administrador usa su nombre de usuario reservado.
2. Abre una escuela asignada desde el mapa o la lista.
3. Repite los numeros de la ficha en papel.
4. Selecciona el tipo y numero de elemento y abre la camara.
5. La app reduce la imagen y agrega un pie sin tapar la fotografia.
6. El registro y las fotos se sincronizan; sin internet quedan en IndexedDB hasta recuperar conexion.
7. Desde **Mi jornada** puede pulsar **Editar** en un registro sincronizado propio y continuar la secuencia de fotos sin perder los codigos anteriores. Los registros creados por otro integrante del equipo se identifican como **Solo lectura**.

## Operacion y supervision

- Los campos, encabezados, indicadores y acciones principales incorporan ayuda emergente **(i)** basada en el manual operativo, accesible con teclado y adaptada a celular.
- **Mi jornada** muestra avance personal, siguiente escuela, borradores, cola local, registros sincronizados, tiempos por ficha y KPI propios y del equipo.
- **Control** consolida escuelas atendidas, registros, fotos, solicitudes, disponibilidad, rendimiento por censista y proyeccion de plazo. El supervisor recibe solo los datos de su equipo; el administrador conserva la vista general.
- **Encuestadores** muestra al supervisor su propia lista de integrantes asignados. El administrador puede ver los 16 integrantes de los 8 equipos, crear, editar, activar y desactivar usuarios, mientras la cuenta administrativa principal permanece protegida.
- **Logistica** administra la distribucion por equipo, filtra por territorio y estado, compara cargas, prepara rutas y guarda asignaciones por lote. Para el supervisor, catalogo, personas y cambios quedan limitados a su equipo.
- **Solicitudes** mantiene una bandeja separada por estado para aprobar o rechazar accesos.
- **Guia de campo** integra las cuatro reglas de control, la secuencia fotografica, la recuperacion sin conexion, los errores criticos y una plantilla copiable para incidencias.
- El cierre evita marcar **Finalizado** sin GPS y exige explicar en **Observaciones** cualquier registro **Con pendientes**.
- El CSV logistico conserva escuela, ubicacion, estado, equipo e integrantes para coordinacion externa.
- **Control > Conciliar con RUE** genera un manifiesto CSV de registros y evidencias con codigo RUE de siete digitos, sede fisica, bloque, planta, espacio y resultado de compatibilidad.

## Compatibilidad con RUE

- La app acepta indistintamente el codigo RUE de siete digitos o el codigo interno historico en busquedas, asignaciones y solicitudes al backend. Por ejemplo, `0011007`, `001-1007` y `11007` resuelven la misma escuela.
- Los identificadores de registros, carpetas y asignaciones se conservan con el codigo interno canonico para no romper el historial; cada registro y fotografia guarda ademas `codigoRue` con siete digitos y `sitioId`.
- Los 86 codigos se agrupan en 85 sedes mediante `sitioId`; `1108034` y `1108042` comparten `CIALPA-S051`.
- Los tipos de espacio se traducen a las secciones RUE de bloques y plantas, aulas, dependencias, laboratorio/taller, sanitarios y areas de recreacion.
- El manifiesto es una herramienta de conciliacion. No escribe dentro de RUE hasta que el MEC habilite una API o plantilla oficial de importacion.

La matriz completa se documenta en `docs/COMPATIBILIDAD_RUE_CIALPA.md`.

## Tiempos, KPI y contingencias

- El tiempo de una ficha se mide desde que se abre el registro hasta que se pulsa **Finalizar y guardar en cola**. Incluye pausas y desplazamientos ocurridos durante ese intervalo.
- El censista ve fichas realizadas, porcentaje completado, fotografias, promedio y mediana por ficha, horas acumuladas y demora media de sincronizacion.
- El equipo ve integrantes disponibles, escuelas asignadas, atendidas y pendientes, registros, fotografias, promedio, mediana y ultima actividad.
- Una ausencia se registra como **indisponibilidad de campo** sin desactivar la cuenta. El supervisor indica el motivo y puede restablecer la disponibilidad.
- La proyeccion usa 45 minutos por escuela y 6 horas efectivas por jornada. La capacidad es `integrantes disponibles / integrantes del equipo`: si falta una persona de un equipo de dos, la capacidad estimada baja al 50 % y el plazo pendiente se duplica; si no queda ninguna, el equipo figura bloqueado.
- Las fichas históricas que no poseen marcas de inicio y cierre se conservan y muestran **Sin datos** en los indicadores temporales.

La matriz de funcionamiento, respuesta online/offline y contingencias se conserva en `docs/PRUEBAS_CONTINGENCIA_CIALPA_FOTOS_2026-07-25.md`.

Los cambios realizados en **Logistica** son un borrador hasta pulsar **Guardar cambios**. Al confirmar, queda una sola asignacion activa por escuela a nombre del representante operativo del equipo; los dos integrantes del mismo equipo reciben acceso a las mismas escuelas. Las asignaciones anteriores permanecen inactivas como historial.

Ejemplo de identificador:

```text
11007-B01-P00-E001-H01-PT01-FT01
```

El mismo codigo se usa en la imagen, el nombre del archivo, Google Drive y Google Sheets. Las fotos binarias se conservan en una carpeta privada de Drive; la hoja contiene datos estructurados, vinculos y huellas SHA-256.

## Componentes

- `index.html`, `assets/`, `sw.js`: PWA estatica para GitHub Pages.
- `assets/data/pilot-schools.json`: catalogo vigente de 86 escuelas piloto de Capital y Central.
- `tools/build_team_roster.py`: reconstruccion verificable de 16 censistas, 8 equipos, 85 ubicaciones fisicas y 86 codigos escolares desde los documentos operativos.
- `gas/`: backend de Google Apps Script vinculado a la hoja de control.
- `assets/js/api.js`: transporte POST por iframe y `postMessage` para comunicar GitHub Pages con GAS sin exponer datos en la URL.
- `assets/js/operations.js`: filtros, metricas, balanceo, rutas y exportacion de la operacion territorial.
- `assets/js/rue.js`: normalizacion de claves, correspondencia de secciones y manifiesto de conciliacion RUE–CIALPA.
- `docs/`: ficha de contingencia imprimible y manual del censista.
- `docs/MANUAL_CAPACITACION_CIALPA_FOTOS_2026-07-25.pdf`: material completo de capacitacion para censistas, supervisores y facilitadores.
- `.github/workflows/pages.yml`: publicacion automatica de la PWA en GitHub Pages.
- `tests/`: pruebas de humo Playwright en escritorio y celular.
- `tools/generate_contingency_presentation.py`: fuente reproducible del PPTX editable de dos paginas.

## Desarrollo y pruebas

```powershell
npm ci
npm test
py -3 tools/generate_contingency_presentation.py
```

En carpetas sincronizadas de Google Drive conviene ejecutar `npm ci` en una copia local temporal y no versionar `node_modules`.

La demostracion local se habilita en `http://127.0.0.1:4173/?demo=1` con codigo `1234567` y PIN `1234`. El modo demo solo usa datos del navegador.

## Backend y primer administrador

La instalacion operativa ya tiene una cuenta administrativa provisionada en la hoja privada. Su contrasena se administra fuera del repositorio y nunca debe incorporarse al frontend, la documentacion o los commits.

1. Ejecutar `clasp push -f` desde la raiz para subir el codigo.
2. Abrir el proyecto vinculado desde la hoja con la cuenta propietaria.
3. Seleccionar `setupSystem` y pulsar **Ejecutar**. Autorizar Sheets y Drive en el dialogo oficial de Apps Script.
4. Ejecutar `secureStorage` con la cuenta propietaria para retirar el acceso abierto por enlace.
5. Crear o editar la aplicacion web para que ejecute el propietario y permita acceso a cualquier usuario.
6. Verificar que la URL `/exec` devuelva JSON con `"ok": true` y colocarla en `assets/js/config.js`.
7. Abrir la pestaña `CONFIG` de la hoja y leer `bootstrap_key`.
8. En la app, desplegar **Crear primer administrador**, ingresar cedula, nombre, apellido, PIN y esa clave.

La clave inicial se borra automaticamente al crear el primer administrador. No debe copiarse en el repositorio, chats ni capturas.

## Privacidad

- La hoja y la carpeta de fotos deben permanecer privadas.
- No habilitar permisos de edicion para cualquiera con el enlace.
- GitHub Pages publica solamente la interfaz, el manual y el catalogo no personal de escuelas.
- PIN, sesiones, auditoria y fotos permanecen en los servicios privados de Google.

Aplicacion prevista: <https://censoescuelaspy.github.io/registro_fotos/>

Backend configurado: <https://script.google.com/macros/s/AKfycbz8RmR-TqSb3FzaLSgMO2NlTTOfRPWuYjSC5ZyXw1Vr5iL-PBYeDIerNvCVj--hNjYk/exec>

Ficha editable en Google Slides: <https://docs.google.com/presentation/d/1JrEKh1W2ns9FQy5rp37MnfQI6LEChMbET0rZEYdlVl4/edit>
