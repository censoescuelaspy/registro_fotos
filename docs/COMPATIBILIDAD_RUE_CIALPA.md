# Contrato de compatibilidad RUE–CIALPA 1.0

## Objetivo

Relacionar cada registro y cada fotografia de CIALPA Fotos con la estructura usada en el modulo de Relevamiento de Infraestructura de RUE, sin duplicar el cuestionario ni modificar RUE por medios no autorizados.

RUE continua siendo la fuente oficial de las respuestas del cuestionario. CIALPA Fotos conserva las evidencias fotograficas, el trabajo offline, los tiempos y la trazabilidad de campo.

## Fuentes verificadas

- RUE demo: `https://demo.mec.gov.py/demo_rue/infraestructuras_fiscalizaciones_v2/index`.
- Capturas autenticadas del 2026-07-25 en `J:\Mi unidad\capturas_manual_encuestador_mec_2026-07-25`.
- Formulario verificado MEC–CIALPA: `PLANIF-2026-FORMULARIO VERIFICADO_MEC-CIALPA- DTIC_27-01-2026 rev IE CIALPA_VF_19-06-2026 (4).xlsx`.
- Catalogo de 86 codigos y 85 edificios: `LISTADO_ESCUELAS_CIALPA_CODIGO_AULAS_2026-07-22.xlsx`.

La pantalla publica de ingreso de RUE exige sesion y CAPTCHA. No se intento eludir esos controles ni reutilizar credenciales desde el codigo.

## Llaves comunes

| Concepto | RUE | CIALPA Fotos | Regla común |
|---|---|---|---|
| Establecimiento | Codigo Establecimiento | `codigoEscuela` | `codigoRue`: siete digitos, conservando ceros iniciales. Ejemplo: `11007` pasa a `0011007`. |
| Sede fisica | No se observa como llave independiente en la interfaz revisada | `sitioId` | `CIALPA-S001` a `CIALPA-S085`. Dos codigos pueden compartir un sitio. |
| Bloque | Bloque | `bloque` / `B##` | Numero normalizado a dos digitos. |
| Planta | Planta baja o nivel | `piso` / `P##` | `0` equivale a `PLANTA_BAJA`; los demas se expresan como `NIVEL_##`. |
| Espacio | Aula, dependencia, laboratorio/taller, sanitario u otro componente | `espacio` / `E###` y `tipoEspacio` | Se genera una clave RUE de espacio sin alterar el identificador historico de la app. |
| Evidencia | Evidencias del relevamiento | Foto y metadatos | Cada fila del manifiesto conserva `codigoFoto`, tipo, elemento, secuencia, fecha, URL privada y SHA-256. |

El nombre de la escuela no se usa como llave porque puede cambiar. La identidad se resuelve por codigo RUE y, para el operativo fisico, por `sitioId`.

## Regla de compatibilidad de codigos

- En la interfaz, las busquedas aceptan el codigo RUE, el codigo interno y variantes con separadores. `0011007`, `001-1007` y `11007` identifican el mismo establecimiento.
- En las entradas del backend, altas de registros, fotografias, filtros y asignaciones aceptan cualquiera de los dos codigos, pero primero deben existir en el catalogo vigente.
- La app convierte siempre la entrada al codigo interno canonico antes de formar `record_id`, `record_key`, nombres de archivo, carpetas y asignaciones. Esto evita duplicados por ceros iniciales y mantiene compatibles los registros historicos.
- `codigo_rue` conserva siempre siete digitos para conciliacion con MEC-RUE; `sitio_id` identifica la construccion visitada.
- La preparacion del esquema completa esos dos campos en registros y fotografias existentes cuando el codigo se puede resolver sin ambiguedad. Los identificadores historicos no se reescriben.

La regla no mezcla instituciones que comparten una construccion: cada codigo RUE sigue siendo independiente, mientras `sitioId` permite planificar una sola visita fisica.

## Correspondencia de secciones

| Tipo de espacio CIALPA | Seccion RUE normalizada |
|---|---|
| `PLANTA_GENERAL` | `BLOQUES_Y_PLANTAS` |
| `AULA` | `AULA` |
| `LABORATORIO`, `TALLER` | `LABORATORIO_TALLER` |
| `SANITARIO` | `SANITARIO` |
| `EXTERIOR` | `AREA_RECREACION` |
| Administracion, biblioteca, cocina/comedor, deposito, pasillo y otro | `DEPENDENCIA` |

La clave resultante tiene la forma:

```text
RUE:0011007:AULA:B01:PLANTA_BAJA:E001
```

## Sede compartida

Los codigos RUE `1108034` y `1108042` comparten la sede `CIALPA-S051`. Ambos establecimientos se preservan, pero el edificio se cuenta una sola vez para la visita, el ruteo y la estimacion fisica.

## Archivo de conciliacion

Los roles de administracion y supervision pueden abrir **Control** y pulsar **Conciliar con RUE**. La app descarga un CSV UTF-8 separado por punto y coma, con una fila por evidencia. Los registros sin fotos tambien generan una fila para no desaparecer de la conciliacion.

El archivo incluye:

- codigo RUE y codigo historico de la app;
- sede fisica y codigos que la comparten;
- seccion, bloque, planta y espacio equivalentes;
- identificadores del registro y de la foto;
- estado, observaciones, GPS y fechas;
- enlace privado y huella SHA-256 de la evidencia;
- resultado `COMPATIBLE` o las causas concretas que requieren revision.

Si dos registros diferentes producen la misma clave RUE de establecimiento, seccion, bloque, planta y espacio, ambos quedan marcados como `ESPACIO_RUE_DUPLICADO` para evitar una carga doble.

Los valores se protegen contra interpretacion accidental como formulas al abrir el CSV en una hoja de calculo.

## Limites actuales

- El CSV prepara la conciliacion; no carga ni modifica datos en RUE.
- El numero de formulario y el numero de hoja pertenecen a la ficha y a CIALPA Fotos; no se encontro una equivalencia visible directa en RUE.
- El estado `FINALIZADO` de la app no debe interpretarse automaticamente como aprobado o cerrado en RUE.
- Las cuentas de RUE y los codigos operativos de CIALPA Fotos siguen siendo identidades independientes.

## Siguiente etapa para integracion directa

El MEC debe confirmar uno de estos mecanismos:

1. una API documentada y autorizada del modulo de infraestructura;
2. una plantilla oficial de importacion masiva;
3. un identificador estable del relevamiento o fiscalizacion creado en RUE;
4. un procedimiento de conciliacion en gabinete con responsables y reglas de aprobacion.

Con esa definicion, el contrato 1.0 puede convertirse en una sincronizacion idempotente, con bitacora, reintentos, deteccion de duplicados y estados separados de enviado, aceptado y rechazado.
