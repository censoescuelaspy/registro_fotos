# CIALPA Fotos

Aplicacion web instalable para registrar fotografias del relevamiento de infraestructura escolar y mantenerlas vinculadas con la ficha manual. Cada imagen queda asociada a escuela, censista, formulario, hoja, bloque, piso, espacio, elemento y secuencia.

## Flujo de campo

1. El censista ingresa con su cedula y PIN; el administrador usa su nombre de usuario reservado.
2. Abre una escuela asignada desde el mapa o la lista.
3. Repite los numeros de la ficha en papel.
4. Selecciona el tipo y numero de elemento y abre la camara.
5. La app reduce la imagen y agrega un pie sin tapar la fotografia.
6. El registro y las fotos se sincronizan; sin internet quedan en IndexedDB hasta recuperar conexion.
7. Desde **Mi trabajo** puede reabrir un registro sincronizado y continuar la secuencia de fotos sin perder los codigos anteriores.

Ejemplo de identificador:

```text
11007-B01-P00-E001-H01-PT01-FT01
```

El mismo codigo se usa en la imagen, el nombre del archivo, Google Drive y Google Sheets. Las fotos binarias se conservan en una carpeta privada de Drive; la hoja contiene datos estructurados, vinculos y huellas SHA-256.

## Componentes

- `index.html`, `assets/`, `sw.js`: PWA estatica para GitHub Pages.
- `assets/data/pilot-schools.json`: catalogo vigente de 86 escuelas piloto de Capital y Central.
- `gas/`: backend de Google Apps Script vinculado a la hoja de control.
- `assets/js/api.js`: transporte POST por iframe y `postMessage` para comunicar GitHub Pages con GAS sin exponer datos en la URL.
- `docs/`: ficha de contingencia imprimible y manual del censista.
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

La demostracion local se habilita en `http://127.0.0.1:4173/?demo=1` con cedula `1234567` y PIN `1234`. El modo demo solo usa datos del navegador.

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
