# Reportes, Dashboards e Indicadores — PMP Suite V2.0

**Versión:** V2.0
**Actualización:** 09-10-2026

## 1. Principios

Los reportes V2.0 deben distinguir claramente:

- **parque de activos**;
- **órdenes de servicio**;
- **custodia física**;
- **estado técnico**;
- **disponibilidad para instalación**;
- **tránsito**;
- **error de consulta**;
- **sin datos**.

Un KPI no debe sumar dos veces el mismo activo ni interpretar un error de API como cero.

## 2. Dashboard Ejecutivo

**Roles:** Admin, Gerente.

### KPI

- Total parque.
- Validadores.
- Consolas.
- Equipos disponibles.
- Equipos en operación.
- Equipos en Bodega.
- Equipos en Laboratorio.
- Equipos en QA.
- Equipos en tránsito.
- OS activas.
- Casos/requerimientos activos.
- Equipos con reincidencia/prioridad analítica.

### Reglas

1. El parque se cuenta por activo único `tipo + serie`.
2. Una OS no aumenta el total del parque.
3. Un activo en tránsito no debe aparecer simultáneamente en origen y destino.
4. Stock inicial y stock reparado se proyectan bajo la misma semántica de disponibilidad, aunque su evidencia de origen sea distinta.

## 3. Dashboard de Bodega

**Rol operacional:** Logística.
**Consulta:** Admin/Gerente.

### Indicadores

- total parque visible;
- stock físico en Bodega;
- disponibles para instalación;
- no disponibles;
- recepciones pendientes;
- despachos a Laboratorio;
- despachos a QA;
- equipos en ruta Terreno;
- solicitudes de repuesto pendientes;
- repuestos bajo stock crítico.

### Definiciones

**Stock físico:** activo cuya custodia vigente es Bodega.

**Disponible para instalación:** activo físicamente en Bodega con evidencia de elegibilidad y sin intervención incompatible.

**En ruta:** despacho físico vigente a Terreno con evidencia válida de `SALIDA_BODEGA_TERRENO`, estado 1 y ubicación sin asignar, según `terrainDispatchSql()`. Una instalación exitosa (`INSTALACION_COMPLETADA`, estado 13) o fallida (`INSTALACION_FALLIDA`, estado 11) deja de cumplir este indicador. La falla mantiene pendiente el retorno y la recepción física en Bodega; no equivale a stock disponible.

**Asignado a técnico:** técnico definido, pero sin despacho físico confirmado.

## 4. Inventario de Equipos

Filtros esperados:

- tipo;
- serie;
- modelo;
- marca;
- ubicación/custodia;
- disponibilidad;
- bus;
- OS;
- origen de stock.

Campos de presentación:

- tipo;
- serie;
- modelo;
- marca;
- estado actual derivado;
- ubicación;
- última OS;
- bus cuando corresponda;
- elegibilidad;
- origen stock inicial/reparado.

## 5. Dashboard Laboratorio

**Rol operacional:** Jefe Laboratorio.

### KPI

- En camino.
- Recibidos.
- Recibidos sin asignar.
- En diagnóstico.
- En reparación.
- Espera de repuesto.
- Listos para salida.
- Incidencias.
- Reingresos.
- SLA próximos a vencer.
- SLA vencidos.
- Carga por técnico.

### SLA

El cronómetro se inicia con la recepción física confirmada del ciclo vigente. La salida de Bodega no inicia SLA.

### Carga por técnico

Debe considerar únicamente OS realmente recibidas y asignadas. Un equipo En camino no forma parte de la carga técnica.

## 6. Reporte de Validadores / Consolas

Campos mínimos:

- serie;
- modelo/marca;
- OS;
- falla reportada;
- diagnóstico;
- técnico;
- estado;
- fecha recepción;
- tiempo/SLA;
- resultado técnico;
- PoD;
- repuesto pendiente;
- QA más reciente cuando corresponda.

## 7. Reporte de Repuestos

### KPI

- stock actual;
- stock crítico;
- solicitudes pendientes;
- solicitudes despachadas;
- consumo por período;
- categoría Validador/Consola/Genérico.

### Regla

El consumo válido proviene de una entrega confirmada por Bodega. No se debe inferir consumo desde texto libre de reparación.

## 8. Dashboard QA

**Rol operacional:** QA.

### Etapas

- Recepción.
- Ambiente.
- Pruebas.
- Dictamen.
- Salida.

### KPI

- entradas pendientes;
- recibidos;
- en Ambiente;
- en pruebas;
- operativos;
- rechazados;
- pendientes de salida.

Un dictamen no implica que el equipo haya salido físicamente de QA.

## 9. Trazabilidad

Búsquedas:

- serie;
- OS;
- caso;
- referencia externa.

La línea de tiempo puede incluir:

- alta de activo;
- recepción inicial;
- requerimiento;
- retiro;
- entradas/salidas;
- escaneos;
- diagnóstico;
- reparación;
- solicitud/entrega de repuesto;
- QA;
- instalación;
- referencias externas.

## 10. Historial técnico para Terreno

Proyección restringida por diseño:

- falla reportada;
- diagnóstico;
- trabajo realizado;
- resultado;
- observaciones técnicas.

Se excluyen:

- stock/costos;
- autorizadores;
- auditoría administrativa;
- IDs internos sin valor técnico;
- información sensible de otros roles.

## 11. Inteligencia Operacional

Salida del analizador:

- total de OS analizadas;
- fallas previas;
- coincidencia EMV;
- coincidencia lector/QR;
- `riesgo_score`;
- top de equipos priorizados.

El score es heurístico y no representa probabilidad calibrada.

## 12. Reportes de Auditoría

La auditoría técnica se reconstruye desde:

- `flujo_eventos`;
- `os_historial_activo`;
- `escaneos_equipos`;
- logs de autorización;
- registro de reparación;
- QA.

No se debe exponer token, contraseña ni datos secretos en reportes.

## 13. Estados de interfaz

Cada reporte debe soportar:

- cargando;
- con datos;
- vacío real;
- error;
- acceso denegado.

## 14. Reportes pendientes / limitaciones

No declarar como implementado un reporte si la ruta o consulta no existe. La documentación de cierre debe distinguir:

- implementado;
- validado;
- pendiente de validación;
- proyectado.


## 15. Fuente técnica de cada vista

| Vista / reporte | Endpoint / servicio principal | Fuente de datos |
|---|---|---|
| Dashboard ejecutivo | `GET /api/dashboard/executive`, `executiveDashboard.js` | activos + OS + eventos/custodia |
| Resumen global | `GET /api/dashboard/summary` | OS + proyecciones logísticas/Lab/QA |
| Equipos en operación | `GET /api/dashboard/equipos-operativos` | `operatingAssetsSql` |
| Dashboard Bodega | `GET /api/bodega/dashboard` | inventario + colas + estado logístico |
| Inventario | `GET /api/bodega/inventario` | `logisticsInventory.js` |
| Cola Bodega | `GET /api/bodega/queue` | `warehouseQueue.js` |
| Repuestos | `GET /api/bodega/repuestos` | repuestos + solicitudes |
| Dashboard Lab | `GET /api/lab/supervision` | `labSupervision.js` |
| Recepción Lab | `GET /api/lab/reception` | `labReceptionRead.js` |
| Colas Validadores/Consolas | `GET /api/lab/queue/:type` | OS + ciclo Lab |
| Completados Lab | `GET /api/lab/completed` | reparación/cierre |
| Dashboard QA | `GET /api/qa/dashboard` | `qaCustody.js` + `qaWork.js` |
| Entradas QA | `GET /api/qa/incoming` | etapa RECEPCION |
| Trazabilidad/Bridge | `/api/bridge/buscar`, historial por activo | OS + eventos + referencias + reparación |
| Búsqueda global | `GET /api/dashboard/global-search` | proyección de búsqueda autorizada |
| Inteligencia | `GET /api/ai/predictive-report` | Python + históricos OS |
| Badges Sidebar | `GET /api/dashboard/badges` | mismas reglas de cola/proyección |

## 16. Definiciones que deben mantenerse idénticas entre KPI y tabla

Un dashboard no puede usar una definición y la tabla otra. Deben compartir el mismo criterio para:

- **En camino Lab:** salida Bodega→Lab confirmada y recepción Lab aún no confirmada.
- **Recibido Lab:** recepción física del ciclo actual confirmada.
- **Carga técnica:** recibido + asignado; excluye tránsito.
- **Disponible para instalación:** origen de stock válido + custodia Bodega + sin conflicto.
- **En ruta Terreno:** despacho físico vigente, estado 1 y ubicación sin asignar; excluye instalación exitosa (estado 13) y fallida (estado 11).
- **Pendiente retiro:** requerimiento/OS asignable cuyo retiro físico todavía no se confirmó.
- **QA recibido:** recepción QA del ciclo actual confirmada.
- **QA operativo/rechazado:** dictamen; no implica salida.
- **Stock físico Bodega:** custodia Bodega, no simplemente estado histórico.

## 17. Semántica de cero, vacío y error

| Situación | Presentación |
|---|---|
| consulta exitosa con 0 | KPI 0 / estado vacío real |
| lista sin coincidencias por filtro | “Sin resultados” |
| endpoint 401/403 | sesión/acceso denegado |
| endpoint 409/422 | conflicto/regla de negocio |
| endpoint 500/red | error visible + opción de reintento |
| métrica no implementada | “Sin medición” / null, nunca número inventado |

Ejemplo vigente: `tiempoPromedio` del resumen global se devuelve como `null` cuando no existe agregación implementada.

## 18. KPI Lab — definiciones de cálculo

### En camino
OS con salida Bodega→Laboratorio posterior a cualquier recepción Lab del ciclo.

### Recibidos
OS con recepción Lab válida del ciclo vigente.

### Sin asignar
Recibido y elegible para trabajo, pero sin `tecnico_laboratorio_id`.

### Espera de repuesto
Trabajo Lab con solicitud pendiente/despacho aún no resuelto según eventos/solicitudes.

### Listos para salida
Cierre técnico válido y custodia aún Laboratorio.

### SLA
```text
ahora - fecha_recepcion_laboratorio_del_ciclo
```
No se usa fecha de salida Bodega como sustituto.

## 19. KPI Bodega — definiciones de cálculo

### Disponible
```text
(stock inicial habilitado OR reparación+QA aprobada)
AND custodia Bodega
AND origen no consumido
AND sin intervención incompatible
```

### Asignado a técnico
Técnico/destino de instalación seleccionados sin salida física confirmada.

### En ruta
Despacho físico vigente con evidencia válida de `SALIDA_BODEGA_TERRENO`, estado 1 y ubicación sin asignar. La ausencia de `INSTALACION_COMPLETADA` no basta: `INSTALACION_FALLIDA` cambia a estado 11 y también excluye el equipo del indicador. Fuentes: `03_Backend/pmp-api/src/services/logisticsPresentation.js` (`terrainDispatchSql`) y `03_Backend/pmp-api/src/routes/os.routes.js` (`completar-instalacion`).

### Repuesto crítico
`stock <= stock_critico` identifica la alerta. Stock cero significa **Sin stock** (rojo); existencias positivas bajo el umbral significan atención (ámbar). Un contador cero de recepciones o despachos pendientes no equivale a una rotura de stock. Ningún color provoca ajustes automáticos.

## 20. KPI QA — definiciones de cálculo

Las etapas se derivan por ciclo QA:

1. RECEPCION;
2. AMBIENTE;
3. PRUEBAS;
4. DICTAMEN;
5. DESPACHO.

El contador “rechazados” es resultado de dictamen; para “pendientes de salida” se exige además que no exista salida QA confirmada del ciclo.

## 21. Reportabilidad y auditoría

Para una auditoría por serie deben poder relacionarse:

```text
Activo
→ caso
→ OS
→ eventos físicos
→ asignaciones
→ diagnóstico/reparación
→ repuesto
→ QA
→ stock
→ instalación
→ referencia externa
```

La tabla `flujo_eventos` no sustituye las tablas de dominio; funciona como hilo temporal para reconstruir la operación.

## 22. Limitaciones documentadas

- No existe una métrica agregada de tiempo promedio global implementada en todos los módulos.
- La heurística IA no es un modelo probabilístico calibrado.
- La validación de cámara/lector sigue requiriendo evidencia física de dispositivo.
- Los reportes que no tengan endpoint/consulta vigente deben rotularse como proyectados, no implementados.
