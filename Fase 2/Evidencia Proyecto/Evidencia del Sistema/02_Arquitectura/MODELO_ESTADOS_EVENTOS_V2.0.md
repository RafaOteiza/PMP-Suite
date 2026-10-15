# Modelo de Estados, Custodia y Eventos — PMP Suite V2.0

**Versión:** V2.0

## 1. Razón del modelo

PMP Suite conserva estados históricos de OS, pero V2.0 necesita representar conceptos más ricos:

- pendiente de retiro;
- tránsito;
- custodia;
- asignación;
- diagnóstico/reparación;
- espera de repuesto;
- QA por etapas;
- disponibilidad;
- en ruta;
- operación.

Por eso la aplicación no usa `estado_id` como única fuente semántica.

## 2. Tres niveles

### Estado persistido

`ordenes_servicio.estado_id`.

### Custodia/evidencia

`ubicacion_id`, eventos de salida/recepción y escaneos.

### Estado presentado

Funciones SQL/servicios derivan etiquetas específicas.

## 3. Estados derivados relevantes

- PENDIENTE_RETIRO;
- PENDIENTE_SALIDA;
- ASIGNADO_TECNICO;
- EN_RUTA;
- En tránsito hacia Laboratorio;
- DISPONIBLE_INSTALACION;
- PENDIENTE_VERIFICACION_BODEGA;
- etapas QA;
- En operación.

## 4. Ciclo Terreno→Bodega

```text
Requerimiento
→ retiro pendiente
→ retiro confirmado
→ tránsito Bodega
→ recepción Bodega
```

Eventos clave:

- REQUERIMIENTO_INGRESADO;
- RETIRO_TERRENO_CONFIRMADO;
- evidencia Bodega;
- recepción correspondiente.

## 5. Ciclo Lab

```text
Bodega
→ SALIDA_BODEGA_LABORATORIO
→ En camino
→ RECEPCION_LABORATORIO_CONFIRMADA
→ Diagnóstico
→ Reparación
→ Espera repuesto (opcional)
→ Finalizado técnico
→ Listo QA
→ SALIDA_LABORATORIO_BODEGA
```

El ID del último SALIDA_BODEGA_LABORATORIO identifica el ciclo técnico para eventos V2.0.

## 6. Ciclo QA

```text
SALIDA_BODEGA_QA
→ recepción QA
→ Ambiente
→ Pruebas
→ Dictamen
→ Salida QA
```

La salida Bodega→QA identifica `ciclo_qa`.

## 7. Disponibilidad

Un activo no está disponible solo porque una OS tenga un estado determinado.

Debe cumplir reglas de:

- custodia Bodega;
- QA/evidencia vigente cuando reparado;
- habilitación inicial cuando nuevo;
- sin intervención incompatible;
- origen no consumido;
- no existir movimiento posterior.

## 8. En operación

La proyección busca la instalación/asociación al bus más reciente y descarta activos con intervención activa incompatible.

## 9. Eventos append-only

### Activos

- ALTA_ACTIVO
- VALIDACION_BODEGA
- RECEPCION_INICIAL
- HABILITADO_INSTALACION

### Requerimientos/Terreno

- REQUERIMIENTO_INGRESADO
- RETIRO_TERRENO_CONFIRMADO

### Bodega/Lab

- SALIDA_BODEGA_LABORATORIO
- RECEPCION_LABORATORIO_CONFIRMADA
- SALIDA_LABORATORIO_BODEGA

### Trabajo Lab

- LAB_TRABAJO_INICIADO
- LAB_AVANCE_GUARDADO
- LAB_DIAGNOSTICO_CONFIRMADO
- LAB_SOLICITUD_REPUESTO
- LOGISTICA_ENTREGA_REPUESTO
- POD_DETECTADO_LABORATORIO
- LAB_REPARACION_FINALIZADA
- LAB_LISTO_QA

### QA

Eventos de recepción, trabajo, dictamen y salida con metadata `version: 3` y `ciclo_qa`.

### Instalación

- SALIDA_BODEGA_TERRENO
- INSTALACION_COMPLETADA
- eventos de falla cuando corresponda.

## 10. Reglas de transición

- no saltar recepción destino;
- no asignar Lab En camino;
- no cerrar Lab sin iniciar/pruebas;
- no cerrar con repuesto pendiente;
- no dictaminar QA sin ciclo/etapas válidas;
- no instalar stock consumido;
- no reutilizar evidencia.

## 11. Compatibilidad

Registros históricos pueden carecer de nuevos eventos. Los read models pueden contener fallbacks expresamente identificados, pero esos fallbacks no autorizan nuevas mutaciones sin evidencia V2.0.

## 12. Fuente

- `logisticsPresentation.js`
- `labArrival.js`
- `labWork.js`
- `qaCustody.js`
- `qaWork.js`
- `warehouseDispatch.js`
- `flujo_eventos`

## Fuente temporal de Laboratorio — revisión 11-10-2026

`labArrival.js` separa **identificador de ciclo** y **fecha de ingreso**:

- El último `SALIDA_BODEGA_LABORATORIO` identifica el ciclo y representa tránsito, no recepción.
- La fecha canónica es la última `RECEPCION_LABORATORIO_CONFIRMADA` posterior a esa salida y compatible con `metadata.ciclo` cuando este existe.
- Un nuevo envío sin recepción compatible excluye la OS de carga efectiva; asignación y SLA no se habilitan con la evidencia de salida.
- `legacy` se identifica solo cuando no hay salida ni recepción Lab. La presentación puede usar fecha OS rotulada como fallback; no convierte una validación preliminar en llegada física.
- Asignar un técnico no modifica la fecha de recepción. Un reingreso requiere la recepción del nuevo ciclo.

Las etiquetas y proyecciones no agregan estados a la FSM ni alteran eventos persistidos.
