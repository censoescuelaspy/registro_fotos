# Pruebas de funcionamiento y contingencia — CIALPA Fotos

Fecha de corte: 2026-07-25  
Version evaluada: 1.4.0

## Criterios de respuesta

La app no debe perder una ficha ni una fotografia cuando cambia la conectividad. Toda carga se guarda primero en el dispositivo; la cola intenta enviarla al servidor cuando vuelve internet. El censista puede consultar la cola, los borradores, los registros sincronizados y sus propios indicadores.

Los tiempos se calculan por ficha desde la apertura hasta el cierre. Los KPI históricos solo incluyen fichas que contienen ambas marcas temporales.

## Matriz de pruebas

| Situacion | Respuesta esperada | Verificacion |
|---|---|---|
| Operacion online | Guardar registro y fotos, vaciar la cola y mostrar el registro sincronizado | Automatizada |
| Internet ausente al cerrar | Guardar registro y fotos en IndexedDB, mostrar los elementos pendientes y mantener la app utilizable | Automatizada |
| Recuperacion de internet | Sincronizar automaticamente y dejar la cola en cero | Automatizada |
| Servidor demora demasiado | Informar `TIMEOUT`, retirar el formulario/iframe temporal y permitir reintento sin duplicar interfaz | Automatizada |
| Recarga o cierre accidental | Recuperar el borrador local con sus campos y fotos | Automatizada |
| GPS denegado o ausente | Impedir cierre como Finalizado; permitir Con pendientes con explicacion suficiente | Automatizada |
| Una ausencia en equipo de dos | Mostrar 50 % de capacidad y duplicar el plazo restante estimado | Automatizada |
| Ausencia de todo el equipo | Marcar el equipo como bloqueado y sin plazo calculable | Automatizada |
| Registro repetido por reintento | Mantener la misma clave de idempotencia para evitar duplicacion en el backend | Revision de codigo y smoke de cola |
| Fichas historicas sin tiempos | Preservarlas y excluirlas de promedios temporales | Revision funcional |
| Bateria baja o dispositivo averiado | Guardar borrador, cerrar camara, trasladar el equipo solo despues de confirmar que la cola esta en cero o continuar en el mismo dispositivo cuando siga offline | Procedimiento de campo |
| Ausencia imprevista durante la jornada | Supervisor registra indisponibilidad, revisa nuevo plazo y reasigna escuelas desde Logistica si el retraso no es aceptable | Prueba funcional y procedimiento |

## Regla de estimacion

Parametros iniciales del piloto:

- 45 minutos base por escuela pendiente.
- 6 horas efectivas por jornada.
- Capacidad = integrantes disponibles / integrantes activos del equipo.
- Dias base = minutos pendientes / minutos efectivos diarios.
- Dias ajustados = dias base / capacidad.

Ejemplo: 12 escuelas pendientes requieren 9 horas. Con dos de dos integrantes disponibles son 1,5 jornadas; con uno de dos, 3 jornadas; con ninguno, el equipo queda bloqueado.

Estos valores son operativos, no una medicion definitiva. Deben recalibrarse con el informe final del piloto usando la mediana observada, los tiempos de traslado y las condiciones territoriales.

## Controles antes de salir de una escuela

1. Confirmar que la ficha correcta esta cerrada y que el estado refleja la realidad.
2. Verificar que las fotos sean legibles y correspondan al edificio relevado.
3. Revisar **Mi jornada**: si hay internet, la cola debe quedar en cero.
4. Si no hay internet, comprobar que registro y fotos figuren en la cola local; no borrar datos del navegador ni desinstalar la PWA.
5. Registrar cualquier ausencia y revisar el plazo recalculado antes de redistribuir escuelas.
