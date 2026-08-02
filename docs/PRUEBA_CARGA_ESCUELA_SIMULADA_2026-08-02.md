# Prueba de carga de una escuela simulada

Fecha: 2026-08-02  
Version: 1.7.2  
Escenario: `?demo=1&loadtest=1`

## Objetivo

Comprobar de forma reproducible que la interfaz puede incorporar una escuela, recibir sus metadatos, recorrer todos sus registros y mostrar todas sus fotografias sin escribir datos ficticios en el libro o Drive productivos.

## Dataset

- Escuela: `9999001`, **ESCUELA FICTICIA DE PRUEBA DE CARGA - NO OPERATIVA**.
- 75 registros finalizados distribuidos en tres bloques.
- 4 fotografias por registro; 300 fotografias en total.
- 16.333.800 bytes de archivos fuente simulados.
- Recursos reutilizados: `icon-512.png`, `logo.png`, `icon-192.png` y `favicon.png`.
- Usuario sintetico: `9980001`, disponible solo en modo de prueba.

## Recorrido automatizado

1. Abrir la aplicacion con `demo=1&loadtest=1`.
2. Iniciar sesion como administrador de demostracion.
3. Confirmar 87 escuelas visibles: 86 reales del catalogo y una ficticia.
4. Verificar que la escuela `9999001` expone 75 registros.
5. Seleccionar consecutivamente los 75 registros.
6. Esperar la decodificacion de las cuatro imagenes de cada registro.
7. Confirmar 300 imagenes abiertas, cero tarjetas con error y registrar tiempos y memoria.

## Resultados

| Entorno | Metadatos disponibles | Recorrido de 300 fotos | Tiempo total | localStorage | Heap JS usado |
|---|---:|---:|---:|---:|---:|
| Chrome escritorio | 997 ms | 33.550 ms | 34.847 ms | 1.120.758 bytes | 10.600.000 bytes |
| Pixel 7 simulado | 998 ms | 32.940 ms | 34.132 ms | 1.120.758 bytes | 11.200.000 bytes |

Resultado funcional: `300/300` imagenes cargadas en ambos entornos, sin errores.

## Limites de interpretacion

- Esta prueba valida una escuela y el comportamiento del navegador; no representa 5.000 escuelas ni usuarios concurrentes.
- Las imagenes del repositorio suman aproximadamente 15,6 MiB. Trescientas fotografias reales al promedio observado de 0,92 MiB ocuparian cerca de 276 MiB, por lo que la duracion real de red seria muy superior.
- El modo demo evita Apps Script, Google Sheets y Drive. Por ello no mide sus cuotas, bloqueos, lecturas completas ni tiempos de escritura.
- El resultado no modifica el dictamen de capacidad: la arquitectura productiva actual requiere paginacion y migracion de almacenamiento antes de escalar a 5.000 escuelas.

## Reproduccion

```powershell
npm run test:load
```

En una unidad sincronizada, ejecutar desde una copia temporal local con dependencias materializadas.
