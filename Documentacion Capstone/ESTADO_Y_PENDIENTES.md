# Estado y pendientes de PMP Suite

**Fecha:** 14 de octubre de 2026. **Versión revisada:** copia PMP Suite V2.0; paquetes `1.0.0`, sin historial Git en esta carpeta. Entrega y presentación: **23 de octubre de 2026**.

## Resultados actuales y límites

| Verificación | Resultado de esta revisión | Alcance y limitación |
|---|---|---|
| Backend, `npm.cmd test` | **125/125 aprobadas** | Unitarias y HTTP local con PostgreSQL/Firebase simulados y destinos de red inválidos. |
| Web, `npm.cmd test` | **284/284 aprobadas** | Incluye pruebas operacionales compartidas con Mobile. |
| Mobile, `npm.cmd test` | **210/210 aprobadas** | Ejecuta `operational-regression`, `settings` y `ui`; no acredita un dispositivo real. |
| Web, `npm.cmd run build` | **Correcto** | TypeScript y Vite; salida temporal y configuración ficticia de API/Firebase. |
| Expo, exportación Android e iOS | **Correcta en ambas plataformas** | Bundles generados sin red, sin `.env` y con API ficticia; no es compilación ni instalación nativa. |
| Python IA, `pip check` | **Correcto** | Consistencia de dependencias instaladas; no se ejecutó el analizador contra la BD habitual. |
| Simulación integrada | **No repetida en este cierre** | Los ciclos históricos, cargas y resultados anteriores no se presentan como vigentes. |
| Validación real | **Pendiente** | Sin login real por rol ni verificación de cámara, QR, PoD, teclado o continuidad en teléfonos. |
| Word y diagramas | **Cinco Word actualizados; 22 páginas revisadas visualmente** | Render a PDF mediante Microsoft Word, tras fallar el renderizador sin LibreOffice. Tablas, figuras, saltos y referencias comprobados. Fuentes `.puml`/`.bpmn` y SVG conservadas; se corrigieron cardinalidades, continuidad del rechazo QA y resultados de instalación. |

Las suites finalizaron sin fallos, omisiones, cancelaciones ni casos pendientes. No deben sumarse sus totales como cobertura única. Se contrastaron los mocks con `AuthContext`, `pageReports` y los componentes actuales: se repusieron `useAuth`, `usersReport` y la cabecera de `FlatList`, y se ajustaron selectores al control real. No se eliminaron pruebas ni se redujeron aserciones; Mobile importa directamente la suite operacional compartida, sin reescritura dinámica del archivo.

**210 históricas frente a 172:** antes de corregir, los tres archivos de pruebas Mobile coincidían con los de Tesis; se compararon también el inventario y el comando histórico del 11-10, que ejecutaba `ui`, `settings` y `operational-regression`. El fallo al importar `usersReport` detenía el registro de casos posteriores: la copia reproducía 171 aprobadas y una entrada fallida del archivo. Resuelto ese bloqueo, se registran 39 casos adicionales y desaparece esa entrada fallida: **210 aprobadas**. No se encontró una pérdida de archivos que explicara la diferencia. El fallo `useAuth` producía una interrupción equivalente en Web. Esta comparación no demuestra cobertura exhaustiva del producto.

README distingue BD existente e instalación independiente. SRS, ERS y matriz Markdown concilian RF-IA-004, RF-TRZ-005 y RF-DASH-009 con las aclaraciones de la matriz Excel vigente: cuatro roles para analítica, proyección técnica para Terreno/Jefe Lab y extensión de reportes separada del requisito Lab. La analítica se describe como descriptiva/heurística, sin entrenamiento predictivo ni aceptación inventada.

No se modificaron Tesis, datos, credenciales, permisos ni servicios habituales. No se ejecutaron migraciones, restauraciones o ciclos sobre la BD compartida. Documentos reemplazados respaldados fuera de la entrega en `../PMP_Suite_Respaldo_Cierre_2026-10-14`. Los PDF, imágenes y logs de comprobación permanecen temporales; los cinco Word mantienen sus nombres y una sola versión vigente.

## Pendientes priorizados y condición de cierre

| Prioridad | Pendiente | Responsable | Siguiente acción | Evidencia mínima | Condición para cerrar |
|---|---|---|---|---|---|
| **P0** | Validación real por los siete roles y dispositivos de la presentación | Por asignar | Designar responsable y acordar un entorno separado con cuentas y datos autorizados. Verificar la separación de BD/Firebase antes de programar el recorrido: la carpeta nueva sigue usando servicios compartidos. No iniciar ciclos en la BD habitual. | Identificación del entorno separado y autorización de cuentas/datos, sin secretos; registro por cada uno de los siete roles y dispositivos utilizados, resultado esperado/obtenido y evidencia localizable. | Con el prerrequisito de aislamiento cumplido, verificar acceso permitido/denegado, sesión, QR/identidad, cámara/PoD, teclado, recepción/salida, rechazo QA y nueva recepción Lab, instalación exitosa/fallida y reportes; resolver bloqueantes. Mocks, exportaciones e históricos no acreditan esta validación. |
| **P1** | Simulación integrada actual | Por asignar | Revisar ejecutores y fixtures, definir PostgreSQL descartable y Firebase simulado, e identificar los escenarios y comprobaciones de integridad/permisos antes de preparar recursos. | Identificación de recursos descartables, versión, comando, fixtures, resultados actuales y comprobaciones de integridad/permisos reproducibles. | Ejecutar el flujo en esos recursos y resolver bloqueantes, sin extrapolar resultados ni métricas históricas y sin afectar servicios compartidos. |
| **P1** | Instalación independiente y recuperación | Por asignar | Solicitar catálogos aprobados de estados/ubicaciones/correspondencias, terminales/PST/buses, repuestos e identidades iniciales; definir el destino separado y el procedimiento de instalación, respaldo y restauración. | Procedencia autorizada de catálogos/identidades; registro de instalación limpia, permisos y recuperación desde un respaldo en recursos separados, con comprobación de integridad y acceso. | Completar tanto la instalación como el ensayo de recuperación. `schema_actual.sql` sin datos no basta; este pendiente no impide arrancar con la configuración existente autorizada. |
| **P0, antes del 23-10** | Aceptación y entrega académica | Por asignar | Designar responsable, revisar pautas y alcance con el equipo, vincular evidencias reales y programar revisión de los cinco Word, demostración y carga. | Revisión del equipo con observaciones resueltas, evidencias localizables, comprobante de carga y constancia de aceptación de quien corresponda. | Confirmar la entrega cargada para el 23-10 y la aceptación correspondiente. La revisión técnica/documental no equivale a aprobación académica ni publicación. |

