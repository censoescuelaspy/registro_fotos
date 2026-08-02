# Bitacora

## 2026-08-02 - Galeria autenticada por escuela y registro v1.7.0

### Objetivo

Permitir que administrador, supervisores y encuestadores consulten desde la app todas las fotografias sincronizadas de cualquier registro perteneciente a una escuela autorizada.

### Implementado

- Nueva vista **Fotos**, accesible desde el menu lateral, la barra superior, la escuela seleccionada y cada registro sincronizado.
- Selectores encadenados de escuela y registro, tarjetas responsive con metadatos y visor ampliado.
- Nueva accion backend `getPhotoContent`, que valida sesion, escuela, estado, formato y tamano antes de leer el archivo privado de Drive.
- El administrador carga todos los registros; supervisor y encuestador conservan el alcance por asignaciones y equipo.
- Las imagenes se solicitan en lotes de cuatro, se mantienen solo en memoria y la interfaz permite reintentar errores individuales.
- Version de frontend, backend y cache PWA incrementada a `1.7.0`; el esquema permanece en `2026-08-01.2` porque no se agregaron columnas.

### Validacion

- Sintaxis de `assets/js/app.js` y `assets/js/api.js` aprobada; `git diff --check` sin errores.
- Prueba backend de autorizacion: un supervisor obtiene la foto de su equipo y recibe rechazo al solicitar la de otro equipo.
- Suite Playwright completa en copia temporal local: `58/58` pruebas aprobadas en Chrome de escritorio y Pixel 7, incluida carga y ampliacion de una foto real en modo demostracion.
- La ejecucion desde la unidad sincronizada sigue impedida por archivos vacios preexistentes de `node_modules`; no afecta el codigo ni la publicacion estatica.

### Publicacion

- Identidad `clasp` confirmada: `dmeza.py@gmail.com`.
- Backend subido con `clasp push -f`, version inmutable `18` y deployment productivo actualizado a `@18`, conservando la misma URL `/exec`.
- `GET` y `POST health` productivos respondieron HTTP `200`, version `1.7.0`, esquema `2026-08-01.2` y `bootstrapRequired: false`.
- Una solicitud anonima a `getPhotoContent` fue rechazada con `AUTH_REQUIRED`, confirmando que la nueva lectura binaria no queda abierta sin sesion.
- Frontend funcional publicado desde el commit `632a009` mediante los workflows **Publicar GitHub Pages** `30740966888` y **pages-build-deployment** `30740966603`, ambos concluidos correctamente.
- La URL `https://censoescuelaspy.github.io/registro_fotos/` respondio HTTP `200` y sirvio version `1.7.0`, build `2026-08-02`, cache `cialpa-fotos-v1.7.0`, la vista **Fotografias por escuela** y la llamada `getPhotoContent`.
- La comprobacion autenticada con fotos reales se deja al smoke test del usuario operativo para no solicitar ni utilizar PIN de campo durante el despliegue.

## 2026-08-02 - Backend Apps Script v1.6.0 desplegado en produccion

### Objetivo

Activar en el endpoint productivo existente los controles de compatibilidad RUE, ayuda operativa y alcance seguro del supervisor que ya estaban publicados en el frontend 1.6.0.

### Despliegue

- Verificacion previa: la URL productiva respondia backend `1.4.0` y esquema `2026-07-25.2`.
- Identidad `clasp` confirmada: `dmeza.py@gmail.com`, con acceso al proyecto vinculado por `.clasp.json`.
- `clasp push -f` subio los nueve archivos del backend Apps Script.
- Se creo la version inmutable `17` con la descripcion `CIALPA Fotos v1.6.0 - ayudas contextuales, RUE y supervision por equipo`.
- El deployment `AKfycbz8RmR-TqSb3FzaLSgMO2NlTTOfRPWuYjSC5ZyXw1Vr5iL-PBYeDIerNvCVj--hNjYk` se actualizo de `@16` a `@17`, conservando exactamente la misma URL `/exec` configurada en el frontend.

### Verificacion productiva

- `GET` y `POST health` sobre la URL exacta respondieron HTTP `200`, servicio `CIALPA Fotos`, version `1.6.0`, esquema `2026-08-01.2` y `bootstrapRequired: false`.
- La inicializacion automatica `ensureSystem_()` finalizo correctamente antes de responder y aplico la actualizacion idempotente del esquema y del catalogo.
- Una solicitud anonima a `adminDashboard` fue rechazada con `AUTH_REQUIRED`, confirmando que el modulo operativo sigue protegido por sesion.
- Desde `https://censoescuelaspy.github.io/registro_fotos/`, el transporte real por iframe y `postMessage` consulto el endpoint productivo y recibio `1.6.0 / 2026-08-01.2` sin errores de pagina.
- La misma fuente desplegada aprobo previamente `54/54` pruebas Playwright en escritorio y movil, incluidas ayuda contextual, aislamiento de escuelas, integrantes, registros y fotografias del supervisor por equipo.

### Limite de la prueba

- No se utilizo el PIN de ningun usuario de campo para una prueba autenticada en produccion. El alcance del supervisor fue validado con pruebas automatizadas de frontend y backend, mientras que en produccion se comprobaron version, migracion, transporte y rechazo de acceso anonimo.

## 2026-08-01 - Ayuda contextual y alcance seguro del supervisor v1.6.0

### Objetivo

Permitir que censistas y supervisores consulten instrucciones del manual dentro de cada pantalla, y asegurar que el perfil supervisor vea y gestione solamente las escuelas y personas de su equipo.

### Implementado

- Nuevo modulo `assets/js/help.js` con ayuda emergente **(i)** para acceso, escuelas, codigos, formulario, fotografias, GPS, cierre, trabajo offline, KPI, RUE, usuarios, disponibilidad y logistica.
- Componente accesible con dialogo no modal, cierre por boton, clic exterior o tecla Escape, foco recuperable y presentacion inferior adaptada a celulares.
- Los campos conservan nombres accesibles propios y la ayuda no altera la operacion ni el contenido ya escrito.
- El supervisor recibe en **Escuelas** el conjunto de ubicaciones asignadas a todos los integrantes de su equipo.
- **Control**, **Encuestadores**, **Logistica**, registros, fotografias, KPI, solicitudes y exportaciones se filtran por equipo en frontend y backend.
- Los KPI de capacidad cuentan solamente perfiles censistas; el supervisor permanece visible como integrante de coordinacion sin inflar la capacidad de levantamiento.
- Las acciones de disponibilidad y reasignacion del supervisor validan en el servidor que la persona y la escuela pertenezcan a su equipo.
- La administracion mantiene el alcance general y el acceso a la carpeta raiz de fotografias; dicho enlace se oculta al supervisor para evitar exposicion transversal.
- El modo demostracion incorpora un perfil supervisor de Equipo 1 (`5678901`, PIN de demostracion `1234`) y datos de otro equipo para comprobar aislamiento.
- Version de frontend, backend y cache PWA incrementada a `1.6.0`; el esquema de hojas permanece en `2026-08-01.2` porque no se agregaron columnas.

### Validacion

- Pruebas nuevas de ayuda contextual y alcance del supervisor en escuelas, tablero, lista de integrantes y logistica.
- Prueba del backend para acceso a escuela, bootstrap, registros y fotografias limitada al equipo.
- Suite Playwright completa: 54 pruebas aprobadas en Chrome de escritorio y movil; regresion final de ayuda y captura fotografica: 6 pruebas aprobadas.
- Sintaxis aprobada en los 18 archivos JavaScript del frontend y backend; `git diff --check` sin errores.
- La suite se ejecuta en una copia temporal local porque la unidad sincronizada materializa archivos vacios dentro de `node_modules`.
- El commit y push fueron solicitados para esta intervencion. El despliegue del backend Apps Script no forma parte del alcance autorizado y debe realizarse por separado para activar sus controles del lado servidor.

### Publicacion verificada

- Codigo funcional publicado en `main` mediante el commit `91932c6` (`feat: integrar RUE, ayuda contextual y supervision por equipo`).
- Los workflows **Publicar GitHub Pages** `30729005401` y **pages-build-deployment** `30729005215` concluyeron correctamente.
- La URL publica `https://censoescuelaspy.github.io/registro_fotos/` respondio HTTP 200 para pagina, configuracion, aplicacion, ayuda y service worker; todos sirven version/cache `1.6.0`.
- Smoke test sobre la URL publica en vista movil: ayuda visible; perfil supervisor de demostracion con una escuela del Equipo 1; Ana Lopez visible y Bruno Diaz, del Equipo 2, ausente.
- GitHub Actions emitio una advertencia no bloqueante por la futura retirada de Node.js 20 en acciones oficiales; la publicacion finalizo con exito, pero el workflow debera actualizar sus versiones cuando GitHub publique reemplazos estables.

## 2026-08-01 - Compatibilidad bidireccional de codigos v1.5.1

### Objetivo

Permitir que la appweb reciba el codigo interno de CIALPA o el codigo de establecimiento RUE sin duplicar escuelas, asignaciones, registros, fotografias ni indicadores.

### Implementado

- Busqueda y seleccion por codigo interno, codigo RUE de siete digitos o variantes con separadores.
- Normalizacion de asignaciones, progreso, registros remotos, borradores e identificadores al codigo interno canonico de la app.
- Validacion del backend por cualquiera de los dos codigos antes de guardar registros, fotografias o asignaciones.
- Incorporacion de `codigo_rue` y `sitio_id` en `FOTOS`, ademas de los campos ya previstos en `ESCUELAS` y `REGISTROS`.
- Migracion idempotente para completar codigos compatibles en registros y fotografias existentes, y eliminacion de filas duplicadas del catalogo que solo difieran por ceros iniciales.
- KPI y progreso por escuela consolidados para que un alias RUE no se cuente como una escuela adicional.
- La interfaz muestra juntas las referencias **RUE** e **Interno** en escuelas, registro, siguiente visita y logistica.
- Version local de frontend, backend, esquema y cache PWA incrementada a `1.5.1` / `2026-08-01.2`.

### Estado

- Cambios preparados localmente; no se realizo publicacion ni despliegue del backend en esta intervencion.
- Sintaxis aprobada en 18 archivos JavaScript; catalogo y archivos JSON validos; `git diff --check` sin errores.
- Catalogo conciliado: 86 codigos internos, 86 codigos RUE unicos, 85 sitios fisicos, cero codigos RUE invalidos y cero colisiones de alias.
- Suite Playwright completa: 48 pruebas aprobadas en Chrome de escritorio y movil. Incluye busqueda por ambos codigos, normalizador del backend, manifiesto RUE, edicion, mapa, offline, KPI, logistica y puente GAS.

## 2026-08-01 - Contrato de compatibilidad RUE–CIALPA v1.5.0

### Objetivo

Estandarizar la relacion entre los registros fotograficos de la app y el modulo de Relevamiento de Infraestructura de RUE, sin duplicar el cuestionario ni automatizar accesos o escrituras no autorizadas.

### Diagnostico

- RUE presenta el codigo del establecimiento con siete digitos; la app conservaba algunos codigos de Capital sin ceros iniciales.
- El operativo contiene 86 codigos institucionales en 85 sedes fisicas. Los codigos `1108034` y `1108042` corresponden a la misma construccion.
- RUE organiza la ficha en General, Bloques y Plantas, Areas de Recreacion, Aula, Dependencias, Laboratorio/Taller y Sanitarios; la app usa tipos de espacio y claves `B/P/E/H`.
- La pantalla publica de ingreso de RUE exige sesion y CAPTCHA. No existe en el proyecto una API documentada ni una plantilla oficial de importacion autorizada.

### Implementado

- El catalogo version 2 agrega `codigoRue`, `sitioId`, codigos que comparten sede y conteo de 85 sitios fisicos.
- La app muestra y permite buscar los codigos RUE de siete digitos sin modificar las claves historicas de los registros.
- Los nuevos registros guardan codigo RUE, sitio fisico, seccion RUE y clave equivalente de bloque, planta y espacio.
- **Control > Conciliar con RUE** genera un manifiesto CSV UTF-8 con una fila por evidencia y conserva tambien registros sin fotografias.
- La exportacion incluye metadatos, GPS, fechas, URL privada, SHA-256 y un estado explicito de compatibilidad.
- La conciliacion detecta dos registros diferentes que apunten al mismo espacio RUE y los marca como `ESPACIO_RUE_DUPLICADO`.
- El backend agrega columnas de interoperabilidad de forma migrable al final de `ESCUELAS` y `REGISTROS`.
- Se documentaron la matriz, sus limites y los nuevos campos en `docs/COMPATIBILIDAD_RUE_CIALPA.md` y `docs/DICCIONARIO_DATOS.md`.
- Version de frontend, backend y cache PWA incrementadas a `1.5.0`; esquema de hojas a `2026-08-01.1`.

### Estado de validacion

- Sintaxis JavaScript, Python, JSON y revision de whitespace aprobadas.
- Suite Playwright completa: 46 pruebas aprobadas en Chrome de escritorio y movil.
- Regresion especifica posterior para manifiesto, claves RUE y deteccion de duplicados: 4 pruebas aprobadas.
- Auditoria de dependencias de produccion: 0 vulnerabilidades. `npm ci` informa dos vulnerabilidades altas solamente en dependencias de desarrollo.
- No se realizo escritura, carga, despliegue ni modificacion dentro de RUE.
- La publicacion de la app y la actualizacion del backend permanecen pendientes de autorizacion. Al cierre, GitHub Pages responde HTTP 200 con frontend/cache `1.4.1` y el backend publicado responde correctamente con version `1.4.0`, esquema `2026-07-25.2`.

## 2026-08-01 - Edicion visible de registros guardados v1.4.2

### Objetivo

Restituir una accion visible y comprensible para editar registros propios ya sincronizados desde **Mi jornada**, incluyendo compatibilidad con registros antiguos.

### Implementado

- El boton de los registros propios se denomina **Editar** y abre el formulario con el encabezado **Editar registro**.
- La comparacion del codigo de censista normaliza numeros, texto y espacios para evitar que el boton desaparezca por diferencias de formato.
- Si un registro antiguo no posee `recordKey`, la app reconstruye la clave con el codigo normalizado del censista y el identificador del registro.
- Las fotografias sincronizadas se recuperan con la misma clave reconstruida y la proxima evidencia conserva la secuencia siguiente.
- Los registros visibles del otro integrante del equipo muestran **Solo lectura** en lugar de una ausencia ambigua de acciones.
- Version de frontend y cache PWA incrementadas a `1.4.2`.

### Validacion local

- Sintaxis JavaScript y archivos JSON aprobados.
- Pruebas de regresion en Chrome de escritorio y movil: edicion de registro sincronizado y recuperacion de registro antiguo con codigo numerico y sin `recordKey`.
- La publicacion permanece pendiente de autorizacion; la URL publica continua en `1.4.1` hasta realizar commit, push y verificar GitHub Pages.

## 2026-07-30 - Centrado estable de escuelas v1.4.1

### Objetivo

Corregir el desplazamiento del mapa observado al seleccionar una escuela desde la lista de la vista **Escuelas**, manteniendo sin cambios las coordenadas y el catalogo escolar.

### Implementado

- El enfoque usa la ubicacion exacta del marcador seleccionado como fuente de verdad.
- Leaflet recalcula primero el tamaño visible del mapa y luego fija el centro y el nivel de acercamiento.
- Se repite una vez el enfoque al finalizar el ajuste visual para evitar que un redimensionado tardio desplace el punto.
- La invalidacion de tamaño se ejecuta con `pan: false`, por lo que no introduce un movimiento adicional.
- Nueva prueba de regresion que selecciona el codigo `11007` desde la lista y comprueba que su marcador permanece en el centro del mapa.
- Version de frontend y cache PWA incrementadas a `1.4.1` para que una futura publicacion invalide los archivos almacenados de la version anterior.

### Validacion

- La version publica consultada antes del cambio seguia sirviendo frontend `1.4.0` y cache PWA `v1.4.0-r2`.
- Playwright se ejecuta desde una copia temporal local porque Google Drive genera archivos vacios al instalar dependencias dentro de `J:\Mi unidad`.
- Prueba de regresion especifica: falla con la secuencia anterior y aprueba en Chrome de escritorio y movil con la correccion.
- Suite completa Playwright: `40/40` recorridos aprobados.
- Sintaxis JavaScript y archivos JSON aprobados; auditoria de dependencias de produccion: `0` vulnerabilidades.
- Commit funcional `bd46d08` enviado a `main`.
- GitHub Pages: flujo `30587389723` completado correctamente.
- URL publica verificada con HTTP `200`, frontend `1.4.1`, build `2026-07-30` y cache PWA `cialpa-fotos-v1.4.1`.
- Smoke test publico del codigo `11007`: marcador a `4,28 px` del centro, ultima operacion `setView` en `-25.2844425, -57.6359119`, detalle visible y cero errores de pagina.

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
