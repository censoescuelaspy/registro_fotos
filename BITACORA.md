# Bitacora

## 2026-08-05 08:03 - Diagnostico de cargas ausentes y galeria optimizada v1.8.1

### Proyecto

- Nombre: CIALPA Fotos.
- Ruta operativa: copia limpia temporal de `censoescuelaspy/registro_fotos` para preservar el arbol local historico con cambios ajenos.
- Repositorio: `https://github.com/censoescuelaspy/registro_fotos.git`, rama `main`.
- URL publica: `https://censoescuelaspy.github.io/registro_fotos/`.
- Backend: deployment productivo estable de Google Apps Script.
- Version: frontend/backend `1.8.1`; esquema `2026-08-01.2` sin cambios.

### Objetivo de la intervencion

- Diagnosticar por que la galeria cargaba las fotos con mucha demora.
- Determinar si las cargas del 4 de agosto de 2026 estaban ocultas por filtros o si no habian llegado al sistema.
- Reducir el costo de visualizacion sin hacer publica la carpeta privada de Drive y hacer visible toda cola pendiente en el dispositivo.

### Diagnostico inicial

- El libro productivo contenia 7 registros y 11 fotos: 6 registros y 9 fotos del 31 de julio, y 1 registro y 2 fotos del 1 de agosto.
- Para el 4 de agosto habia 0 registros, 0 filas de fotos y 0 archivos nuevos en la carpeta privada de Drive. La auditoria mostraba un unico inicio de sesion de supervisor, sin acciones `GUARDAR_REGISTRO` ni `SUBIR_FOTO`.
- Las 11 fotos existentes estaban correctamente vinculadas: 0 huerfanas, 0 registros sin clave y 0 diferencias de conteo. La ausencia del 4 de agosto no era un filtro de galeria ni una falla de conciliacion.
- La ultima carga recibida por el servidor y el ultimo archivo creado en Drive correspondian al 1 de agosto a las 21:04 hora local.
- Cada tarjeta de la galeria reconstruia la fotografia original completa. La foto mediana exigia 5 llamadas secuenciales de 300.000 caracteres y el percentil 90 exigia 8; la accion `health` demoraba entre 2,0 y 4,6 segundos por llamada durante la medicion.

### Acciones realizadas

- El backend acepta las variantes privadas `preview` y `original` en `getPhotoContent`.
- Para `preview`, Google Apps Script obtiene `File.getThumbnail()` y conserva la fotografia original como respaldo cuando Drive no ofrece miniatura.
- La galeria carga hasta cuatro miniaturas en paralelo y solicita el archivo original solamente cuando el usuario amplia una foto.
- La respuesta valida variante, tipo MIME, indice y cantidad de fragmentos para impedir mezclas o descargas incompletas.
- Todas las vistas muestran un aviso persistente cuando IndexedDB conserva operaciones que aun no llegaron al servidor, con estado de error y accion **Sincronizar ahora**.
- Se actualizaron README, pruebas automatizadas, cache PWA y version visible a `1.8.1`.

### Archivos modificados

- `gas/Config.js`, `gas/Records.js`.
- `assets/js/api.js`, `assets/js/app.js`, `assets/js/config.js`.
- `sw.js`, `version.json`, `package.json`, `package-lock.json`, `README.md`.
- `tests/rue.spec.js`, `tests/smoke.spec.js`, `tests/update.spec.js`, `tests/remote-visibility.spec.js`.

### Comandos o scripts ejecutados

- Consultas de solo lectura a las hojas `REGISTROS`, `FOTOS`, `AUDITORIA` y `SESIONES`, mas inventario recursivo de la carpeta de Drive.
- Mediciones repetidas del endpoint `health` y calculo de fragmentos segun el tamano real de las 11 fotografias.
- `node --check`, validacion JSON y `git diff --check`.
- `npx playwright test --config=playwright.local.config.js --workers=4`, usando Chrome instalado localmente por indisponibilidad temporal de la descarga del navegador empaquetado.
- `npx clasp push -f`, `npx clasp version` y actualizacion del deployment productivo.

### Resultados verificados

- Suite completa: `76/76` pruebas aprobadas en Chrome escritorio y Pixel 7 simulado.
- Prueba intensiva: `300/300` miniaturas abiertas sin error; galeria en 17.691 ms en escritorio y 15.934 ms en movil.
- El backend productivo quedo desplegado como version inmutable `26` y `health` respondio `ok: true`, version `1.8.1`, esquema `2026-08-01.2` y `bootstrapRequired: false`.
- Frontend publicado mediante los commits `2d95d72` y `12924f6`; workflows **Publicar GitHub Pages** `31000236099` y **pages build and deployment** `31000235089` completados correctamente.
- `version.json` publico y la pantalla de acceso mostraron `1.8.1`; consola sin errores ni advertencias y sin desbordamiento horizontal en la comprobacion de escritorio.
- La validacion demo sobre la URL publica cargo cuatro fotos de una ficha simulada. Se corrigio un detalle de trazabilidad visual para conservar `data-photo-quality="preview"` despues de re-renderizar y la prueba focalizada final aprobo en escritorio y movil (`2/2`).

### Errores o incidentes

- La primera ejecucion local no encontro el navegador Playwright `1148`; su descarga se interrumpio por timeout de red despues de completar la transferencia. Las pruebas se ejecutaron con Google Chrome ya instalado mediante una configuracion temporal no versionada.
- No hay evidencia remota que permita reconstruir las supuestas cargas del 4 de agosto. Si fueron finalizadas sin sincronizar, solo pueden permanecer en IndexedDB del mismo dispositivo, navegador y perfil usados en campo.

### Pendientes y riesgos

- Revisar **Mi jornada** en el dispositivo de origen. Si aparece el aviso de cola, mantener la sesion, no borrar datos del navegador y pulsar **Sincronizar ahora** con conexion estable hasta llegar a cero.
- Si no existen borradores ni operaciones en cola en ese dispositivo, las cargas del 4 de agosto no son recuperables desde el servidor porque nunca llegaron a Sheets ni Drive y deberan repetirse.
- Queda pendiente la comprobacion autenticada de miniaturas con datos productivos por un usuario autorizado; no se solicito ni registro ningun PIN.

## 2026-08-05 07:05 - Visibilidad remota y conciliacion registro-foto v1.8.0

### Objetivo

- Evitar que una falla del backend se presente al usuario como una galeria o jornada validamente vacia.
- Mostrar registros historicos de escuelas que todavia no formen parte del catalogo piloto estatico.
- Conciliar registros y fotografias antes de calcular indicadores y dejar visibles las inconsistencias para administracion.

### Diagnostico inicial

- La carga de registros podia capturar un error remoto y continuar con listas vacias, produciendo un falso estado de exito.
- La galeria intersectaba los registros recibidos con las 86 escuelas estaticas del piloto y ocultaba escuelas historicas fuera de ese catalogo.
- El tablero y el rendimiento contaban toda fotografia activa, incluso archivos sin `record_key` valido o vinculados a un registro inexistente.
- La interfaz no diferenciaba claramente entre la cantidad declarada por el registro y la cantidad de fotografias efectivamente vinculadas.

### Acciones realizadas

- `listRecords` incorpora metadatos de las escuelas realmente presentes en los registros visibles para el usuario.
- La aplicacion conserva un estado remoto explicito y muestra alertas persistentes ante errores, cache sin confirmar o autenticacion vencida.
- La galeria deriva sus escuelas de los registros del servidor y admite una etiqueta segura para codigos historicos no catalogados.
- El backend vincula fotografias solo cuando existe un `record_key` no vacio y correspondiente a un registro visible.
- El panel **Control de integridad** informa fotografias huerfanas, registros fuera del catalogo, diferencias de conteo y acceso directo a la carpeta de Drive.
- Los indicadores administrativos y de rendimiento utilizan fotografias efectivamente vinculadas; las huerfanas quedan separadas como hallazgo de auditoria.
- Se agregaron pruebas de regresion para fallo remoto visible, escuela historica no catalogada y conciliacion de fotografias huerfanas.
- El workflow de GitHub Pages incluye explicitamente `version.json`, requerido por la comprobacion automatica y manual de actualizaciones de la PWA.
- Version de frontend, backend y cache PWA incrementada a `1.8.0`; el esquema de datos permanece en `2026-08-01.2`.

### Validacion local

- Pruebas focalizadas en Chrome escritorio y Pixel 7 simulado: `10/10` aprobadas.
- Suite Playwright final en Chrome escritorio y Pixel 7 simulado: `76/76` aprobadas.
- Sintaxis JavaScript, archivos JSON y `git diff --check`: aprobados sin errores.
- Prueba de carga con 300 fotografias: aprobada en ambos perfiles, sin regresiones funcionales.

### Publicacion

- El primer intento de `clasp push -f` con `monitorimpactosocial@gmail.com` fue rechazado por Google con `The caller does not have permission`.
- Se reautorizo `clasp` como `dmeza.py@gmail.com`, se confirmo acceso a los deployments y se subieron los nueve archivos del backend.
- Se creo la version inmutable `25` con la descripcion `CIALPA Fotos v1.8.0 - conciliacion registro-foto y visibilidad remota`.
- El deployment productivo `AKfycbz8RmR-TqSb3FzaLSgMO2NlTTOfRPWuYjSC5ZyXw1Vr5iL-PBYeDIerNvCVj--hNjYk` se actualizo a `@25`, conservando la misma URL `/exec`.
- Frontend `1.8.0` publicado en `main` mediante los commits `6ff92ef` y `a8e67b7`.
- Workflow **Publicar GitHub Pages** `30995634931`: finalizado correctamente; `version.json`, configuracion, service worker y aplicacion publica responden con `1.8.0`.
- Validacion visual en la URL publica: acceso y actualizacion demo, panel **Integridad registro–foto**, consola sin errores ni advertencias y viewport movil de 412 px sin desbordamiento horizontal.
- Backend publico verificado despues del despliegue: `ok: true`, version `1.8.0`, esquema `2026-08-01.2` y `bootstrapRequired: false`.
- Una llamada anonima a `adminDashboard` fue rechazada con `AUTH_REQUIRED`, confirmando que el panel productivo permanece protegido.

### Riesgos y pendientes

- La validacion autenticada con contenido productivo requiere una cuenta operativa; no se solicitara ni registrara ningun PIN en la bitacora.
- Las fotografias huerfanas se reportan sin borrarlas ni reasignarlas automaticamente para preservar trazabilidad y evitar cambios irreversibles.
- La publicacion integral de frontend y backend esta completada; queda pendiente solamente la comprobacion funcional autenticada con datos productivos por un usuario autorizado.

## 2026-08-02 - Actualizacion automatica y version visible v1.7.3

### Objetivo

- Mostrar claramente la version instalada antes y despues del acceso.
- Ofrecer un boton **Actualizar** visible para comprobar manualmente una publicacion nueva.
- Buscar actualizaciones en cada inicio con conexion, instalarlas, recargar una sola vez y avisar al usuario al completar el cambio.

### Implementacion

- Nuevo `version.json` consultado con `cache: no-store` y parametro unico para impedir respuestas antiguas.
- Registro del service worker con `updateViaCache: none` y comprobacion explicita mediante `registration.update()`.
- Al activar una cache nueva, el service worker elimina solamente caches anteriores de CIALPA, toma control y navega cada cliente agregando temporalmente `app_updated`.
- La app retira ese parametro de la URL y muestra durante 30 segundos el aviso **Aplicacion actualizada correctamente**.
- Antes de una comprobacion manual, cualquier ficha abierta se guarda como borrador local para que una recarga de version no pierda el trabajo capturado.
- Version y boton visibles en la pantalla de acceso, barra superior y cuenta; diseño ajustado para escritorio y celular.
- Version de frontend, backend y cache PWA incrementada a `1.7.3`; esquema de datos sin cambios.

### Validacion local

- Sintaxis JavaScript y JSON validos; `git diff --check` sin errores.
- Pruebas de actualizacion en escritorio y Pixel 7 simulado: version visible, boton manual, invalidacion de cache anterior, navegacion automatica, limpieza de URL y aviso posterior aprobados.
- Regresion funcional: `66/66` pruebas generales aprobadas; ensayo intensivo separado `2/2`, con 300/300 fotos nuevamente abiertas en ambos perfiles (`68/68` en total).

### Publicacion

- Frontend publicado desde el commit `c28e27b`; los dos workflows de GitHub Pages finalizaron correctamente.
- Backend productivo actualizado al deployment inmutable `@24`; `health` responde version `1.7.3`, esquema `2026-08-01.2` y `bootstrapRequired: false`.
- Smoke test en la URL publica aprobado en Chrome escritorio y Pixel 7 simulado: version `1.7.3`, boton **Actualizar**, `version.json` y service worker activo verificados.

## 2026-08-02 - Escuela ficticia y ensayo de 300 fotografias v1.7.2

### Alcance

- Escenario aislado `?demo=1&loadtest=1`; no escribe en el libro ni en Drive productivos.
- Escuela ficticia `9999001`, usuario sintetico `9980001`, 75 registros y 300 fotografias generadas con cuatro PNG existentes del repositorio.
- Aviso visible permanente que identifica la simulacion y confirma que no usa el libro productivo.
- Dataset reproducible en `assets/js/demo-load.js` y prueba integral en `tests/load-test-school.spec.js`.

### Resultados iniciales

- Escritorio: metadatos en 997 ms; recorrido de 300 fotos en 33.550 ms; total 34.847 ms; 300/300 sin error.
- Pixel 7 simulado: metadatos en 998 ms; recorrido de 300 fotos en 32.940 ms; total 34.132 ms; 300/300 sin error.
- Volumen de imagen simulado: 16.333.800 bytes; `localStorage` aproximado 1.120.758 bytes.
- Informe metodologico y limites en `docs/PRUEBA_CARGA_ESCUELA_SIMULADA_2026-08-02.md`.

### Validacion

- Suite Playwright completa en Chrome escritorio y Pixel 7 simulado: `60/60` pruebas aprobadas con cuatro workers.
- El modo normal `?demo=1` conserva las 86 escuelas piloto; la escuela ficticia aparece exclusivamente con `loadtest=1`.
- En la ejecucion integral concurrente, las 300/300 imagenes volvieron a abrirse sin error: 39.426 ms en escritorio y 37.439 ms en Pixel 7 simulado.
- Sintaxis JavaScript y `git diff --check` sin errores.

### Publicacion

- Frontend publicado en GitHub Pages desde el commit `6eb0bdb`; ambos workflows de Pages finalizaron correctamente.
- Backend publicado en el deployment productivo como version inmutable `22`; la accion `health` confirma `version: 1.7.2` y el esquema vigente.
- Smoke test contra la URL publica: 87 escuelas, 75 registros y 300/300 fotografias abiertas sin error; metadatos en 1.823 ms y recorrido en 33.762 ms.

## 2026-08-02 - Correccion del transporte fotografico v1.7.1

### Diagnostico

La galeria 1.7.0 recibia correctamente escuelas, registros y metadatos, pero las tres imagenes del registro seleccionado fallaban al cruzar completas como base64 por la respuesta HTML del puente de Apps Script. La evidencia visual mostro el mismo fallo desde 878 KiB hasta 1,6 MiB, consistente con un limite de respuesta y no con registros faltantes.

### Correccion

- El backend divide cada imagen privada en fragmentos base64 de 300.000 caracteres y numera la secuencia completa.
- El navegador descarga como maximo dos fotografias en paralelo, valida todos los fragmentos y reconstruye la imagen solo en memoria.
- Si un archivo falla, la tarjeta muestra ahora el mensaje real del servidor y permite reintentar individualmente.
- Se mantienen la autenticacion, el alcance por equipo y la privacidad de Drive; no se modificaron fotos, registros ni permisos.
- Version de frontend, backend y cache PWA incrementada a `1.7.1`; esquema sin cambios.

### Validacion y despliegue

- Prueba especifica con imagen base64 de mas de 300.000 caracteres: reconstruccion correcta en escritorio y Pixel 7.
- Suite Playwright completa: `58/58` pruebas aprobadas; sintaxis y `git diff --check` sin errores.
- Backend publicado como version inmutable `20` y deployment productivo actualizado a `@20`, conservando la URL `/exec`.

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

## 2026-08-05 09:15 -03 - Gestion reversible de equipos y asignaciones v1.9.0

### Proyecto

- Nombre: CIALPA Fotos - Registro de campo.
- Ruta local de trabajo: `/tmp/registro_fotos_audit.hHPCPU/repo` (clon limpio del repositorio productivo).
- Repositorio: `https://github.com/censoescuelaspy/registro_fotos.git`.
- URL publica: `https://censoescuelaspy.github.io/registro_fotos/`.
- Responsable tecnico: Codex, por solicitud del usuario.
- Version: aplicacion `1.9.0`; esquema `2026-08-05.1`.

### Objetivo de la intervencion

- Incorporar activacion e inactivacion explicita de asignaciones sin eliminar historial.
- Permitir que administradores y coordinadores creen equipos, asignen integrantes y distribuyan escuelas dentro de su ambito.
- Dejar activas unicamente las ocho asignaciones indicadas en la imagen suministrada.

### Diagnostico inicial

- La operacion dependia del campo legado `USUARIOS.equipo` y no existia una entidad normalizada para equipos y membresias.
- La pantalla logistica permitia reasignar, pero no expresaba de manera directa la activacion o inactivacion conservando el historial.
- Existian asignaciones previas y duplicadas que no debian eliminarse.
- Dahiana Ramond e Ivan Garcia figuran como coordinadores en la imagen, pero no tienen cuenta/codigo localizable en la base operativa.

### Acciones realizadas

- Se agregaron las hojas normalizadas `EQUIPOS` y `EQUIPO_MIEMBROS` y el campo `equipo_id` al final de `ASIGNACIONES` y `REGISTROS`.
- Se implemento migracion compatible con el campo legado, una membresia activa por encuestador y multiples equipos por coordinador.
- Se agregaron controles para crear y editar equipos, guardar integrantes, activar o inactivar equipos y activar o inactivar asignaciones.
- La desactivacion conserva las filas historicas; al inactivar un equipo tambien se inactivan sus asignaciones activas.
- Se generaron tres hojas ocultas de resguardo antes de modificar datos: `backup_asignaciones_pre_gestion_equipos_20260805_0852`, `backup_usuarios_pre_gestion_equipos_20260805_0852` y `backup_registros_pre_gestion_equipos_20260805_0852`.
- Se conservaron todas las asignaciones existentes como historial inactivo y quedaron exactamente ocho activas, una por cada escuela de la imagen.
- Se configuraron ocho equipos activos con dos integrantes activos por equipo.
- Licet Armoa y Belen Quinonez quedaron habilitadas con rol coordinador; los equipos de Dahiana Ramond e Ivan Garcia mantienen la referencia operativa en notas hasta que existan sus cuentas.
- Se registro la intervencion en `AUDITORIA` con el evento `CIALPA-AUD-20260805-GESTION-EQUIPOS-01`.

### Archivos modificados

- Frontend: `assets/js/app.js`, `assets/js/api.js`, `assets/css/app.css`, configuracion de version y service worker.
- Backend: `gas/Teams.js`, `gas/Admin.js`, `gas/Records.js`, `gas/Performance.js`, `gas/Sheets.js`, `gas/Config.js` y `gas/Code.js`.
- Pruebas: suites de humo, permisos, RUE, actualizacion y visibilidad remota.
- Documentacion: `README.md`, `docs/DICCIONARIO_DATOS.md`, `docs/MANUAL_OPERATIVO.md` y esta bitacora.

### Comandos o scripts ejecutados

- Validacion de sintaxis JavaScript y `git diff --check`.
- `npm test` para la regresion completa en escritorio y movil.
- `npx playwright test tests/rue.spec.js --project=desktop-chromium --project=mobile-chromium` para la logica GAS unitaria ajustada.
- `npx clasp push -f`, creacion de version Apps Script y actualizacion del deployment productivo.
- Lecturas y escrituras acotadas mediante Google Sheets API, con verificacion posterior de cada rango modificado.
- Navegacion manual con Playwright CLI en la version local.

### Resultados verificados

- Suite completa: `80/80` pruebas aprobadas.
- Verificacion en la hoja: 8 equipos activos, 16 membresias activas y 8 asignaciones activas; cada equipo tiene exactamente dos integrantes.
- Historial previo preservado como inactivo y copias de resguardo ocultas confirmadas.
- Interfaz local `1.9.0`: visibles `Crear equipo`, `Guardar integrantes`, `Activar` e `Inactivar`; sin errores de consola.
- Backend productivo: version `1.9.0`, esquema `2026-08-05.1`, `bootstrapRequired: false`, deployment actualizado a `@27` sobre la misma URL.

### Errores o incidentes

- La primera suite termino con 76 pruebas aprobadas y cuatro fallas del arnes unitario, que aun no simulaba las nuevas dependencias de bloqueo y permisos. Se completo el arnes y la regresion final termino 80/80.
- El wrapper de Playwright no tenia permiso de ejecucion directo; se ejecuto de forma explicita con `bash`.

### Soluciones aplicadas

- Modelo normalizado y auditable para evitar sobrescribir o eliminar asignaciones anteriores.
- Escrituras productivas realizadas solo despues de copias de respaldo, con conteos y claves verificados tras la actualizacion.
- Los coordinadores sin cuenta no fueron vinculados a una identidad incorrecta; sus nombres quedaron documentados como pendientes.

### Pendientes

- Crear o identificar las cuentas de Dahiana Ramond e Ivan Garcia y vincularlas como coordinadores de los equipos 1, 7 y 8.
- Confirmar con el usuario la correspondencia de Villa Elisa: la imagen dice `Colegio Nacional San Jose`; el catalogo operativo disponible corresponde a `Escuela Basica N° 3537 San Jose`, codigo interno `1115012`.
- Registrar el commit y la validacion de la URL publica en el cierre de despliegue.

### Riesgos

- Una identidad de coordinador incorrecta ampliaria acceso territorial; por eso las dos cuentas faltantes quedaron sin vincular.
- Las filas historicas inactivas deben conservarse para auditoria y no deben depurarse manualmente.

### Recomendaciones

- Crear primero la cuenta del coordinador y luego asignarla desde Gestion de equipos.
- Mantener las hojas de resguardo hasta la validacion de usuario y usar siempre activacion/inactivacion en lugar de borrar filas.
- Incorporar al repositorio maestro el patron reutilizable de equipos, membresias y asignaciones temporales con historial.

### Estado de validacion

- Codigo compilado/sintaxis: aprobado.
- Codigo probado: aprobado, 80/80.
- Backend desplegado y verificado: aprobado, version 27.
- Datos productivos actualizados y verificados: aprobado.
- Frontend publico: pendiente del cierre de publicacion.
- Validacion por usuario: pendiente.

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
