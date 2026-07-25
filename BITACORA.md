# Bitacora

## 2026-07-25 - Tiempos, KPI y contingencias v1.4.0

### Objetivo

Probar la respuesta online y offline, medir el rendimiento sin perder trazabilidad y permitir que censistas y supervisores conozcan a tiempo el efecto de ausencias y demoras.

### Implementado

- Marcas `started_at`, `completed_at` y `duration_seconds` en cada registro nuevo.
- KPI individual: fichas, finalizadas, porcentaje de finalizacion, fotos, promedio, mediana, horas acumuladas, demora de sincronizacion y ultima actividad.
- KPI por equipo: integrantes disponibles, escuelas asignadas, atendidas y pendientes, registros, fotos, promedio, mediana y ultima actividad.
- Disponibilidad de campo separada del estado de la cuenta, con motivo, fecha de actualizacion y auditoria.
- Proyeccion de plazo basada en 45 minutos por escuela, 6 horas efectivas por dia y capacidad disponible.
- Alerta de contingencia al bajar la capacidad y estado bloqueado cuando ningun integrante esta disponible.
- Persistencia de borradores, cola offline, reintento al reconectar y control de timeout.
- Matriz de pruebas y procedimiento operativo en `docs/PRUEBAS_CONTINGENCIA_CIALPA_FOTOS_2026-07-25.md`.

### Compatibilidad y resguardo

- Los registros anteriores se mantienen intactos; al no tener marcas temporales no alteran los promedios.
- Respaldos ocultos previos a la migracion: `backup_usuarios_pre_kpis_20260725` y `backup_registros_pre_kpis_20260725`.
- La estimacion es inicial y debe recalibrarse con la mediana y los traslados observados durante el piloto.

### Validacion

- Sintaxis JavaScript aprobada para frontend, service worker y los nueve archivos GAS.
- Playwright: `38/38` recorridos aprobados en Chrome de escritorio y movil.
- Casos incluidos: operacion online, cierre offline, reconexion y sincronizacion, borrador tras recarga, timeout, GPS, ausencia parcial, ausencia total y recorrido responsive.
- Auditoria de dependencias de produccion: `0` vulnerabilidades.
- Conciliacion operativa preservada: 8 equipos, 16 censistas, 85 construcciones y 86 codigos escolares.
- Backend GAS desplegado como version `15`; endpoint saludable con app `1.4.0` y esquema `2026-07-25.2`.
- Hoja privada verificada con los nuevos encabezados, validacion de casillas y los 17 usuarios activos —administrador y 16 censistas— inicialmente disponibles.
- Commits funcionales: `43a4251` y correccion de arranque offline `65f6d28`.
- GitHub Pages: flujos `30168223279` y `30168394524` completados correctamente.
- URL publica verificada con HTTP `200`, frontend `1.4.0`, modulo de KPI y cache PWA `v1.4.0-r2`.
- Smoke test publico movil aprobado: KPI individual y de equipo visibles, sin errores de pagina.
- Arranque publico sin conexion aprobado en `83 ms`, con la PWA controlada por service worker y sin intentar esperar al backend.

## 2026-07-25 - Equipos y asignaciones definitivas v1.3.0

### Objetivo

Incorporar a la appweb la nomina operativa y la distribucion de escuelas definida en el plan piloto, respetando que la unidad de trabajo es la construccion y que ambos integrantes de cada equipo deben acceder a la misma carga.

### Implementado

- Matriz reproducible de 16 censistas, 8 equipos, 85 ubicaciones fisicas y 86 codigos escolares.
- Codigos operativos no personales para el alta inicial; no se publican cedulas, PIN ni credenciales en GitHub Pages.
- Campo `equipo` incorporado al esquema de usuarios, a la administracion y al tablero.
- Acceso compartido por equipo a escuelas, avance y registros, manteniendo autoria individual de cada carga.
- Logistica y exportacion CSV presentadas por equipo e integrantes.
- El local compartido por dos codigos escolares queda como una sola visita fisica y bajo el mismo equipo.
- Flujo seguro de activacion: cada censista solicita acceso con su codigo operativo y elige su propio PIN; la aprobacion administrativa conserva su equipo y asignaciones.

### Fuentes operativas

- `R04_PLAN OPERATIVO PLAN PILOTO_EQUIPOS Y CRONOGRAMA (1).xlsx`.
- `LISTADO_ESCUELAS_CIALPA_CODIGO_AULAS_2026-07-22.xlsx`, hoja `Edificios_85`.
- `R02_LISTADO DE PERSONAL.pdf`, usado solamente para verificar nombres; no se incorporaron datos personales adicionales.

### Validacion y publicacion

- Conciliacion reproducible aprobada: 8 equipos, 16 usuarios, 85 sitios y 86 codigos.
- Hoja privada verificada con 16 usuarios activos, 8 equipos y 86 asignaciones activas unicas.
- Respaldos ocultos creados antes de la carga: `backup_usuarios_pre_equipos_20260725` y `backup_asignaciones_pre_equipos_20260725`.
- Sintaxis JavaScript aprobada para frontend y backend.
- Playwright: `26/26` recorridos aprobados en Chrome de escritorio y movil.
- Auditoria de dependencias de produccion: `0` vulnerabilidades.
- Backend GAS desplegado como version `14`; endpoint saludable con app `1.3.0` y esquema `2026-07-25.1`.
- Commit funcional: `88a7af2`.
- GitHub Pages: flujo `30166659567` completado correctamente.
- URL publica verificada con HTTP `200`, frontend `1.3.0`, logistica por equipo y nueva etiqueta de acceso.
- Smoke test publico movil aprobado, sin desborde horizontal ni errores de consola.

## 2026-07-25 - Guia operativa y cierre controlado v1.2.0

### Objetivo

Alinear la appweb con el manual ampliado de capacitacion y evitar cierres que no permitan al supervisor comprender o recuperar el trabajo de campo.

### Implementado

- Nueva **Guia de campo** integrada y adaptada al rol del usuario.
- Cuatro reglas visibles: escuela correcta, codigo unico, foto util y cola en cero.
- Secuencia fotografica visible: contexto, posicion, detalle y hoja.
- Procedimiento offline, errores criticos y plantilla copiable para reportar incidencias sin PIN.
- Manual de capacitacion de 35 diapositivas incorporado como PDF descargable y disponible offline.
- Control de cierre: **Finalizado** requiere GPS.
- Control de pendientes: **Con pendientes** requiere una observacion que describa que falta y la accion esperada.
- Version de frontend y cache PWA actualizada a `1.2.0`.

### Validacion local

- Sintaxis JavaScript aprobada para la aplicacion, la configuracion y el service worker.
- Playwright: `26/26` recorridos aprobados en Chrome de escritorio y movil.
- Revision visual aprobada en `1440 x 1000` y `390 x 844`, sin desborde horizontal ni errores de consola.
- Auditoria de dependencias de produccion: `0` vulnerabilidades.

### Alcance tecnico

- No se modificaron datos, asignaciones, cuentas, fotos ni estructura del backend.
- El endpoint GAS estable se conserva sin redeploy porque los cambios son exclusivamente de frontend y documentacion.

### Estado de publicacion

- Commit funcional: `0ffb2ce`.
- GitHub Pages: flujo `30155366204` completado correctamente.
- URL verificada: `https://censoescuelaspy.github.io/registro_fotos/`.
- La interfaz publica muestra `v1.2.0`, abre la guia y entrega el manual de capacitacion con HTTP `200`.
- Smoke test publico aprobado sin errores de consola.
- Backend GAS verificado en estado saludable, version `1.1.0` y esquema `2026-07-18.1`.

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

### Publicacion publica

- Commit funcional `1002c20` publicado en `main`; workflow GitHub Pages `29661359216` finalizado correctamente.
- Smoke test en `https://censoescuelaspy.github.io/registro_fotos/`: version `1.1.0`, backend en linea, sin advertencias ni errores de consola.
- Vista movil publica verificada con 86 escuelas, 86 filas logisticas, pestañas administrativas operativas y sin desborde horizontal.
