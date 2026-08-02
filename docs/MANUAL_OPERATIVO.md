# Manual operativo del censista

## Antes de salir

- Instale CIALPA Fotos desde el navegador del celular.
- Ingrese y confirme que aparecen sus escuelas asignadas.
- Abra una escuela y descargue el mapa antes de perder conexion.
- Lleve fichas impresas, lapicera negra o azul oscura y bateria suficiente.

## Ayuda emergente `(i)`

- Los campos, indicadores, tablas y acciones principales incluyen un boton circular **i**.
- Pulse **i** para ver la explicacion operativa del item sin abandonar la pantalla ni perder lo escrito.
- El texto resume el criterio del manual: que dato usar, como codificarlo, que control realizar y que error evitar.
- Para cerrar la ayuda, pulse **X**, toque fuera del recuadro o presione **Escape**. En celular se presenta como una tarjeta en la parte inferior.
- La ayuda emergente orienta durante la tarea, pero no reemplaza la lectura de la **Guia de campo**, el manual de capacitacion ni las instrucciones del MEC.

## Registro de una escuela

1. Abra la escuela correcta desde **Escuelas**.
2. Pulse **Registrar**.
3. Copie del papel los numeros de formulario, hoja, bloque, piso y espacio.
4. Seleccione el tipo de espacio.
5. Para cada fotografia, seleccione el elemento y escriba su numero exacto.
6. Pulse **Foto del espacio**. El celular abrira la camara tras conceder permiso.
7. Para la ficha terminada, pulse **Foto de la hoja** y encuadre sus cuatro esquinas.
8. Registre danos y fallas en el campo correspondiente y use el codigo `DF` en el croquis.
9. Pulse **Finalizar y sincronizar**. Antes de retirarse, compruebe que **Pendientes** indique cero o que todo quede guardado en cola.

## Controles antes del cierre

- Para usar **Finalizado**, obtenga primero el GPS del registro.
- Si selecciona **Con pendientes**, escriba en **Observaciones** que falta y cual es la accion requerida.
- Revise la secuencia recomendada: contexto, posicion, detalle y foto de la hoja cuando corresponda.
- Abra **Guia de campo** desde el boton de ayuda para consultar la recuperacion sin conexion y copiar la plantilla de incidencias.

## Editar un registro guardado

1. Abra **Mi jornada**.
2. Busque el registro dentro de **Registros sincronizados**.
3. Pulse **Editar** para abrir sus datos y fotografias ya sincronizadas.
4. Corrija los campos necesarios o agregue nuevas evidencias; la siguiente foto conserva la secuencia existente.
5. Finalice nuevamente para guardar los cambios y sincronizar solo las fotografias nuevas.

Los registros creados por el otro integrante del equipo se muestran como **Solo lectura** para preservar la autoria. Si un registro propio antiguo no posee la clave interna completa, la app la reconstruye a partir del codigo del censista y del identificador de la ficha.

## Relacion con RUE

- Puede buscar una escuela con el codigo RUE de siete digitos o con el codigo interno. La app reconoce ambos y muestra las dos referencias juntas.
- No quite ni agregue ceros manualmente para intentar cambiar de sistema: seleccione la escuela por su nombre y confirme ambos codigos en pantalla.
- Compare siempre el codigo mostrado como **RUE**. Tiene siete digitos y puede comenzar con ceros.
- Verifique tambien el **Sitio fisico CIALPA**. Dos instituciones pueden tener codigos RUE diferentes y funcionar dentro de la misma construccion.
- Mantenga la misma numeracion de bloque, piso y espacio en RUE, el croquis y CIALPA Fotos.
- La app traduce `Piso 0` como `Planta baja` y conserva una clave equivalente para cada espacio.
- No use el nombre de la institucion como identificador, porque la denominacion puede variar.

### Conciliacion para supervisores

1. Abra **Control**.
2. Pulse **Conciliar con RUE**.
3. Guarde el CSV generado y revise la columna `estado_compatibilidad`.
4. Los registros `COMPATIBLE` tienen codigo RUE, sede fisica, seccion y clave de espacio completos.
5. Corrija antes del cierre cualquier fila que indique escuela no catalogada, sitio no definido o tipo de espacio sin equivalencia.

Este archivo no carga informacion automaticamente en RUE. Se utiliza para revision o para una futura importacion autorizada por el MEC.

## Vista del supervisor

- El perfil **SUPERVISOR** ve en **Escuelas** todas las ubicaciones asignadas a integrantes de su mismo equipo, no solamente las que figuran a su nombre.
- En **Control** observa exclusivamente el avance, los registros, las fotos, los KPI y las contingencias de ese equipo.
- En **Encuestadores** obtiene la lista de su supervisor y censistas asignados, con rol, estado, disponibilidad, escuelas, registros, fotos y ultimo acceso.
- La capacidad de campo se calcula con los perfiles **ENCUESTADOR**; el supervisor aparece en la lista del equipo, pero no aumenta artificialmente la cantidad de personal que realiza fichas.
- En **Logistica** solo aparecen las escuelas y las personas del equipo. Un supervisor puede redistribuir una escuela ya perteneciente a su equipo, pero no incorporar personas ni escuelas de otro equipo.

## Consulta de fotografias sincronizadas

1. Abra **Fotos** desde el menu o el icono de imagen de la barra superior. Tambien puede usar **Ver fotos** en una escuela o **Fotos** en un registro sincronizado.
2. Seleccione la escuela y luego el registro. La galeria muestra todas las evidencias y hojas en papel activas asociadas.
3. Pulse una imagen para ampliarla y cierre el visor con la **X** o la tecla Escape.
4. El administrador puede consultar todas las escuelas. Supervisores y encuestadores solo pueden consultar las escuelas habilitadas para su equipo.

Las imagenes permanecen privadas en Drive. La app las entrega mediante la sesion autenticada y no modifica los permisos de la carpeta.
- La administracion mantiene la vista consolidada de todo el operativo. Los controles se aplican tambien en el servidor; ocultar una fila en pantalla no se considera un control de acceso suficiente.

## Numeracion

El codigo se compone asi:

```text
ESCUELA-B##-P##-E###-H##-ELEMENTO##-FT##
```

- `B01`: primer bloque.
- `P00`: planta baja; `P01`: primer piso.
- `E001`: primer espacio del bloque y piso.
- `H01`: primera hoja del formulario.
- `PT01`: primera puerta del espacio.
- `DF01`: primer dano o falla del espacio.
- `FT01`: primera foto del registro.

La app imprime este codigo en una franja agregada al pie, sin cubrir la fotografia original. Verifique que los numeros coincidan con el papel antes de abrir la camara.

## Fotos utiles

- Primero tome una vista de contexto; despues, el detalle necesario.
- Evite dedos, reflejos, contraluz, zoom digital y fotos repetidas.
- Para danos, conserve una vista general y otra cercana con el mismo numero de elemento cuando correspondan al mismo hallazgo.
- Para el papel, use una superficie plana, luz uniforme, camara paralela y texto enfocado.

## Sin conexion

La camara, los borradores y la cola local siguen disponibles. No cierre sesion, no desinstale la app ni borre los datos del navegador. Cuando vuelva la senal, abra **Pendientes**, pulse **Sincronizar ahora** y espere hasta ver cero operaciones.

## Ficha imprimible

El PDF `FICHA_CONTINGENCIA_PLANO_MANUAL_CIALPA_v1.4.pdf` contiene la ficha oficio en la primera pagina y este manual rapido en la segunda.
