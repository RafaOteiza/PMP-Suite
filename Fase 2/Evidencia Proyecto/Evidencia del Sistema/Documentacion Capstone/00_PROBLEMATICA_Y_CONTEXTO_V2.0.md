# PMP Suite — Problemática y Contexto V2.0

**Versión:** V2.0  
**Actualización:** 09-10-2026

## 1. Contexto del problema

PMP Suite nace de un proceso real de mantenimiento de equipamiento tecnológico asociado al transporte público, principalmente **validadores** y **consolas**. El ciclo operacional involucra varias áreas con responsabilidades distintas: Terreno, Logística/Bodega, Laboratorio, Control de Calidad (QA), jefaturas, administración y supervisión.

El problema no es solamente reparar un equipo. El desafío es mantener una **trazabilidad continua y verificable** sobre:

- qué equipo físico se está tratando;
- dónde se encuentra;
- quién tiene su custodia;
- qué orden/caso originó el trabajo;
- qué falla fue reportada y qué falla se confirmó;
- qué reparación se realizó;
- qué pruebas fueron ejecutadas;
- si existió PoD;
- qué repuestos fueron requeridos/entregados;
- si QA aprobó o rechazó;
- cuándo el equipo volvió a Bodega;
- qué activo fue instalado posteriormente;
- qué antecedentes históricos deben ver los distintos roles.

## 2. Situación AS-IS observada

### 2.1 Recepción hacia Laboratorio

Los equipos llegan al Laboratorio desde Bodega/Mersan. Normalmente se reciben con guía de despacho, pero existen situaciones urgentes donde un equipo puede arribar antes que la documentación formal. Las series también pueden ser informadas por correo.

Los equipos pueden venir con tarjetón físico, pero existen casos donde:

- el tarjetón no está presente;
- la información está incompleta;
- algún dato no coincide con el equipo físico;
- la serie entregada por otro canal requiere conciliación.

El Laboratorio registra los ingresos en un control interno, revisa antecedentes y luego distribuye el trabajo técnico.

### 2.2 Trabajo técnico

El flujo real de Laboratorio comprende:

1. recepción;
2. registro;
3. verificación de antecedentes;
4. diagnóstico;
5. reparación;
6. pruebas;
7. preparación de salida;
8. despacho;
9. registro de solución.

El diagnóstico puede confirmar la falla reportada, detectar una falla distinta, determinar NFF, identificar un PoD o detectar una condición que requiera repuesto.

### 2.3 Fragmentación de información

Antes de PMP Suite, la información del mismo activo/caso puede quedar distribuida entre:

- registros de Bodega/Mersan;
- planillas del Laboratorio;
- registros de QA;
- información de analistas;
- controles de PoD;
- correos;
- guías de despacho;
- referencias externas como Aranda;
- registros independientes de técnicos.

La fragmentación obliga a realizar conciliaciones manuales. Un mismo equipo puede aparecer en varias planillas con estados o datos distintos.

### 2.4 Efectos de la fragmentación

Los principales efectos son:

- dificultad para determinar la ubicación física vigente;
- dificultad para determinar quién tiene la custodia;
- duplicidad de registros;
- estados desactualizados;
- pérdida de contexto entre áreas;
- dependencia de correos/personas para reconstruir antecedentes;
- dificultad para calcular tiempos/SLA;
- mayor riesgo de asignar o despachar un equipo no elegible;
- dificultad para distinguir stock inicial de stock reparado;
- dificultad para reconstruir reincidencias por serie;
- poca claridad entre caso, OS, activo y referencia externa;
- riesgo de mezclar la historia de un equipo retirado con un reemplazo;
- mayor esfuerzo para auditar PoD, repuestos y QA.

## 3. Problema central

> No existe una única fuente operacional que relacione identidad física, custodia, órdenes, casos, movimientos, reparación, QA, stock e historial por activo durante todo el ciclo.

Esto genera una brecha entre el **estado administrativo registrado** y el **estado físico real**.

## 4. Causas

### 4.1 Causas de información

- planillas independientes;
- registros no sincronizados;
- información duplicada;
- referencias externas no normalizadas;
- dependencia de digitación manual;
- relaciones serie/PPU/terminal/operador no siempre autocompletadas.

### 4.2 Causas de proceso

- recepción y despacho tratados históricamente como un solo cambio de estado;
- evidencia física reutilizada entre movimientos;
- funciones de jefatura/operación mezcladas;
- falta de separación entre diagnóstico técnico y custodia;
- falta de separación entre dictamen QA y despacho;
- creación histórica de OS/Bridge con responsabilidades superpuestas.

### 4.3 Causas tecnológicas

- falta de modelo único de identidad;
- ausencia de un historial append-only transversal;
- permisos demasiado amplios en etapas anteriores;
- múltiples vistas/estados calculados con criterios diferentes;
- ausencia de un contrato común para captura física.

## 5. Usuarios afectados

| Actor | Necesidad |
|---|---|
| Técnico Terreno | saber qué OS tiene asignadas, qué retirar/instalar y antecedentes técnicos útiles |
| Logística | conocer custodia, disponibilidad, stock, recepciones y despachos |
| Jefe Laboratorio | ver equipos en camino/recibidos, asignar carga, supervisar SLA y despachar |
| Técnico Laboratorio | diagnosticar/reparar su carga sin administrar inventario |
| QA | recibir, preparar ambiente, probar, dictaminar y despachar |
| Admin | administrar cuentas/roles y supervisar, sin reemplazar actores operacionales |
| Gerencia | obtener indicadores y trazabilidad de solo lectura |
| Analistas/cliente | disponer de antecedentes consistentes de cada activo/caso |

## 6. Objetivo de PMP Suite

### Objetivo general

Desarrollar e integrar una plataforma que centralice y haga trazable el ciclo físico y técnico de validadores y consolas, desde operación hasta mantenimiento, QA, retorno a stock y reinstalación.

### Objetivos específicos

1. Mantener identidad única por **tipo + serie**.
2. Diferenciar activo, caso, OS y referencia externa.
3. Controlar custodia mediante evidencia física por movimiento.
4. Separar responsabilidades por rol.
5. Mantener historial append-only.
6. Integrar Web, Mobile, Backend y PostgreSQL.
7. Gestionar stock/repuestos desde Logística.
8. Mantener QA como proceso autónomo.
9. Proporcionar indicadores y reportes coherentes.
10. Entregar analítica de reincidencia como apoyo, no automatismo.

## 7. Principios de diseño derivados del problema

### Physical First

Una lectura o selección **no mueve un equipo**. Cada cambio de custodia requiere validación y confirmación del movimiento actual.

### Identidad autoritativa

- Validador 72… → CVB35 / Mikroelektronika.
- Validador 74…/75… → CVB45 / Mikroelektronika.
- Consola → N9715 / Waysion.

### Independencia de OS

Cada OS representa una intervención concreta. Una reparación del equipo retirado no se reutiliza para representar la instalación de un reemplazo.

### Historial por activo

La serie mantiene su historia aunque cambie de bus, estado, ubicación o caso.

### Segregación de funciones

Administrar el sistema, custodiar un equipo, repararlo, certificarlo y mover stock son permisos distintos.

## 8. Alcance actual

Incluye:

- gestión de activos;
- recepción inicial;
- casos/requerimientos;
- OS MV/MC/PDV/PDC/IN;
- retiros Terreno;
- Bodega;
- Laboratorio;
- QA;
- repuestos;
- trazabilidad;
- Bridge de referencias externas;
- dashboards;
- Mobile;
- seguridad/RBAC;
- analítica de reincidencia.

No se presenta como implementada una integración automática con Aranda ni un despliegue productivo certificado.


## 9. Objetos de información del AS-IS

| Objeto | Origen típico | Problema de fragmentación |
|---|---|---|
| Serie del equipo | equipo físico, tarjetón, correo, guía | puede existir diferencia entre fuentes |
| Guía de despacho | Mersan/Bodega | puede llegar después del equipo en urgencia |
| Tarjetón | equipo/lote | puede faltar o contener información incorrecta |
| Falla reportada | Terreno/cliente/analista | no siempre coincide con diagnóstico |
| Diagnóstico | Técnico Laboratorio | queda en registro técnico separado |
| Reparación | Técnico Laboratorio | puede no quedar vinculada al historial transversal |
| PoD | informe + planilla específica | seguimiento paralelo |
| Repuesto | coordinación con Bodega | puede separarse del registro de reparación |
| QA | registro de Calidad | aprobación/rechazo fuera del control Lab |
| Estado solicitado por cliente | correo/reporte | requiere reconstrucción manual |
| Referencia Aranda | sistema externo | puede no estar normalizada con la OS PMP |

## 10. Frontera del proceso analizado

### Inicio

El proceso de mantenimiento se considera iniciado cuando existe una necesidad sobre un activo: falla reportada, requerimiento externo o necesidad de retiro.

### Fin

El ciclo termina cuando:

- el activo reparado vuelve a quedar elegible/operativo; o
- el equipo reemplazado queda instalado y la historia del retirado continúa por su propia OS.

### Procesos relacionados pero no sustituidos

- operación del sistema de transporte;
- gestión contractual/comercial;
- contabilidad/facturación;
- procedimiento técnico interno específico de Instalación Ambiente QA;
- Aranda como sistema externo.

## 11. Árbol causa → problema → efecto

```text
PLANILLAS / CORREOS / GUÍAS / TARJETONES NO SINCRONIZADOS
                  ↓
      IDENTIDAD Y ESTADO NO UNIFICADOS
                  ↓
 NO HAY UNA FUENTE ÚNICA DE CUSTODIA E HISTORIAL
                  ↓
 conciliación manual · demoras · riesgo de error
                  ↓
 menor capacidad de supervisión y decisión
```

Causas técnicas y organizacionales se refuerzan mutuamente: incluso con una base de datos, si recepción y salida no se distinguen físicamente, el sistema puede registrar un estado que no representa la realidad.

## 12. Matriz stakeholder / información / decisión

| Stakeholder | Información que necesita | Decisión/acción |
|---|---|---|
| Terreno | OS propias, activo, bus, antecedentes técnicos | retirar/instalar/reportar |
| Logística | custodia, elegibilidad, stock, destino, solicitudes | recibir/despachar/entregar |
| Jefe Lab | camino, recepción, SLA, carga, listos | recibir/asignar/supervisar/salir |
| Técnico Lab | falla, historial técnico, pruebas, necesidad de repuesto | diagnosticar/reparar/probar |
| QA | origen, ciclo, antecedentes técnicos, pruebas | recibir/probar/dictaminar/salir |
| Admin | usuarios, roles, supervisión | administrar cuentas |
| Gerencia | parque, OS, SLA, trazabilidad, tendencias | supervisar/priorizar |
| Analista/cliente | serie, OS/caso, estado, hitos | seguimiento operacional |

## 13. Brecha AS-IS → capacidad requerida

| Brecha AS-IS | Capacidad requerida | Respuesta PMP Suite |
|---|---|---|
| identidad en varias fuentes | identidad autoritativa | tipo + serie + reglas modelo/marca |
| estado administrativo ≠ físico | custodia verificable | Physical First |
| mismo dato digitado varias veces | relaciones derivadas | autocompletado y campos readonly |
| caso/OS/referencia confundidos | entidades independientes | caso + OS + Bridge |
| reparación y stock mezclados | segregación | Técnico describe; Bodega entrega |
| QA acoplado a asignación Admin | autonomía | QA toma su trabajo |
| historial disperso | trazabilidad transversal | eventos + historial por activo |
| consulta manual | read models | dashboards/búsqueda |
| reingreso ambiguo | ciclos explícitos | ciclo Lab/QA + evidencia nueva |

## 14. Criterios de éxito del proyecto

No se mide éxito solo por cantidad de pantallas. Se consideran criterios de éxito:

1. un activo mantiene identidad estable durante todas sus intervenciones;
2. ningún movimiento físico se da por realizado solo por una selección/consulta;
3. cada área opera únicamente su responsabilidad;
4. una consulta por serie permite reconstruir antecedentes relevantes;
5. la instalación de un reemplazo no altera la historia del retirado;
6. stock y repuestos tienen origen/consumo auditable;
7. QA puede rechazar sin perder el contexto técnico;
8. dashboards no duplican el parque;
9. errores de datos/servicio son visibles y no se convierten en cero;
10. la documentación permite explicar y reproducir la solución.

## 15. Indicadores de mejora esperados

La documentación no asigna porcentajes artificiales sin medición. Los indicadores que PMP Suite habilita para comparar AS-IS/TO-BE son:

- tiempo de conciliación de estado;
- porcentaje de equipos con ubicación/custodia verificable;
- tiempo desde recepción Lab hasta cierre técnico;
- OS sin asignación;
- equipos en espera de repuesto;
- reingresos/reincidencias por serie;
- rechazos QA;
- disponibilidad de stock;
- solicitudes de repuesto pendientes;
- diferencias entre evidencia física y contexto esperado.

## 16. Relación con BPMN

- `BPMN/BPMN_AS_IS_V2.0.md` modela la fragmentación y conciliación manual.
- `BPMN/BPMN_TO_BE_V2.0.md` modela la operación integrada y los controles Physical First.
- `06_CASOS_DE_USO_Y_ESCENARIOS_V2.0.md` baja el TO-BE a escenarios verificables.
