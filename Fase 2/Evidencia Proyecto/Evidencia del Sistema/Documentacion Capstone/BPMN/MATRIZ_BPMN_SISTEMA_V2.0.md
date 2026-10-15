# Matriz BPMN → Sistema — PMP Suite V2.0

Esta copia conserva documentación vigente y pruebas reutilizables. Los informes de ejecución, capturas y resultados históricos citados permanecen únicamente en el archivo original Tesis; no se incluyen ni acreditan una nueva ejecución en PMP_Suite_V2.0. Las comprobaciones de esta copia y sus pendientes se describen en el README principal.


**Versión:** V2.0  
**Actualización:** 09-10-2026

## 1. Objetivo

Relacionar los pasos del proceso TO-BE con actor, capacidad, endpoint/servicio, efecto de datos y evidencia. Esta matriz permite defender que el BPMN no es un diagrama decorativo: corresponde al diseño implementado.

## 2. Flujo principal

| Paso BPMN | Actor | Capacidad | API/servicio principal | Persistencia / evento | Control clave |
|---|---|---|---|---|---|
| Reportar falla | Técnico Terreno | terrain.work | POST /api/os/crear | caso/OS/evento | activo operativo |
| Crear caso/OS | Sistema | servicio | requirements/os services | casos_operacionales + ordenes_servicio | transacción |
| Validar retiro | Técnico Terreno | terrain.work | /os/validar-identidad-retiro | evidencia contexto | tipo+serie |
| Confirmar retiro | Técnico Terreno | terrain.work | /os/confirmar-retiro | RETIRO_TERRENO_CONFIRMADO | OS propia |
| Recepción Bodega | Logística | warehouse.move | /bodega/recepcion-terreno/validar + /receive | custodia Bodega | evidencia vigente |
| Salida a Lab | Logística | warehouse.move | /bodega/dispatch-lab/validar + /dispatch-lab | SALIDA_BODEGA_LABORATORIO | nuevo propósito |
| Recepción Lab | Jefe Lab | lab.custody | /lab/custody/:code/RECEPCION/* | RECEPCION_LABORATORIO_CONFIRMADA | ciclo Lab |
| Iniciar SLA | Sistema | read model | labArrival/labSupervision | fecha recepción | no salida Bodega |
| Asignar técnico | Jefe Lab | lab.assign | PUT /lab/assign | tecnico_laboratorio_id | recibido vigente |
| Diagnóstico | Técnico Lab | lab.work | PUT /lab/work/:codigoOs | eventos/snapshot | carga propia |
| Solicitar repuesto | Técnico Lab | lab.work | POST /lab/request-part | solicitud + evento | necesidad PoD |
| Entregar repuesto | Logística | warehouse.move | PUT /bodega/solicitudes/:id/entregar | solicitud_items + stock + evento | transacción |
| Reparación | Técnico Lab | lab.work | PUT /lab/work/:codigoOs | avance | revisión |
| Manual/Test MK | Técnico Lab | lab.work | PUT /lab/work/:codigoOs | pruebas en snapshot | catálogo fijo |
| Cierre técnico | Técnico Lab | lab.work | POST /lab/finish | registro_reparaciones + eventos | pruebas OK |
| Salida Lab | Jefe Lab | lab.custody | /lab/custody/:code/SALIDA/* | SALIDA_LABORATORIO_BODEGA | evidencia nueva |
| Recepción Bodega | Logística | warehouse.move | PUT /bodega/receive | custodia Bodega | recepción independiente |
| Salida QA | Logística | warehouse.move | /bodega/dispatch-qa/validar + /dispatch-qa | ciclo QA | evidencia |
| Recepción QA | QA | qa.work | /qa/:code/:purpose/validar + action | RECEPCION_QA/ciclo | QA |
| Ambiente | QA | qa.work | /qa/:code/actions/:action | snapshot/evento QA | procedimiento técnico no inventado |
| Pruebas QA | QA | qa.work | /qa/:code/actions/:action | snapshot pruebas | revisión |
| Dictamen | QA | qa.work | /qa/:code/actions/:action | OPERATIVO/RECHAZADO | no mueve custodia |
| Salida QA | QA | qa.work | validar + action salida | SALIDA_QA_BODEGA | evidencia propia |
| Recepción Bodega | Logística | warehouse.move | PUT /bodega/receive | custodia Bodega | posterior a salida |
| Evaluar elegibilidad | Sistema | warehouse.read | logisticsInventory/warehouseDispatch | read model | origen válido |
| Despacho Terreno | Logística | warehouse.move | /bodega/despacho/validar + /confirmar | IN + SALIDA_BODEGA_TERRENO | atómico |
| Instalar | Técnico Terreno | terrain.work | /os/completar-instalacion | INSTALACION_COMPLETADA | OS propia |
| Operación | Sistema | read model | operatingAssetsSql | proyección | sin intervención incompatible |

## 3. Gateway — Repuesto

### No requiere

Diagnóstico/intervención continúa directamente a reparación/pruebas.

### Sí requiere

1. técnico registra necesidad;
2. sistema crea solicitud;
3. OS queda en espera;
4. Logística selecciona pieza/cantidad;
5. se bloquea/revalida stock;
6. entrega física;
7. stock disminuye;
8. trabajo puede continuar.

El técnico no recibe permiso de inventario.

## 4. Gateway — Pruebas Lab

### Aprobadas

Permite cierre técnico si no existen otras precondiciones pendientes.

### Rechazadas

Vuelve a intervención/reparación. No se debe cerrar la OS técnica.

## 5. Gateway — Dictamen QA

### Operativo

QA sigue conservando custodia hasta confirmar salida. Después Bodega debe confirmar recepción.

### Rechazado

1. QA registra motivo;
2. QA confirma salida;
3. Bodega confirma recepción;
4. Logística despacha nuevamente a Lab;
5. Jefe Lab confirma nueva recepción;
6. se abre nuevo ciclo técnico;
7. antecedentes de rechazo quedan visibles.

No se reutiliza evidencia del ciclo anterior.

## 6. Relación con AS-IS

| Punto AS-IS | Control TO-BE |
|---|---|
| guía/correo/tarjetón a conciliar | identidad de activo + caso/OS + evidencia |
| planilla Lab | bandeja/carga/historial |
| estado no sincronizado | eventos + read model |
| repuesto fuera del trabajo | solicitud enlazada a OS |
| PoD paralelo | clasificación/eventos/evidencia |
| QA separado sin trazabilidad transversal | ciclo QA unido a OS/activo |
| consulta por correo | búsquedas/reportes |
| despacho por lote sin custodia central | salida/recepción Physical First |

## 7. Artefactos relacionados

- BPMN AS-IS: `BPMN_AS_IS_V2.0.bpmn`.
- BPMN TO-BE: `BPMN_TO_BE_V2.0.bpmn`.
- ERS: `../../01_Requerimientos/ERS_PMP_Suite_V2.0.md`.
- API: `../../02_Arquitectura/CATALOGO_API_V2.0.md`.
- Estados/eventos: `../../02_Arquitectura/MODELO_ESTADOS_EVENTOS_V2.0.md`.
- Trazabilidad: `../../08_Pruebas/MATRIZ_TRAZABILIDAD_V2.0.md`.
