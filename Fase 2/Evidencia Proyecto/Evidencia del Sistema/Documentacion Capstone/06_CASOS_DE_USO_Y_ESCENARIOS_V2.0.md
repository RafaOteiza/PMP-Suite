# Casos de Uso y Escenarios Operacionales — PMP Suite V2.0

Esta copia conserva documentación vigente y pruebas reutilizables. Los informes de ejecución, capturas y resultados históricos citados permanecen únicamente en el archivo original Tesis; no se incluyen ni acreditan una nueva ejecución en PMP_Suite_V2.0. Las comprobaciones de esta copia y sus pendientes se describen en [ESTADO_Y_PENDIENTES.md](ESTADO_Y_PENDIENTES.md).


**Versión:** V2.0  
**Actualización:** 14-10-2026

## UC-01 — Alta de activo

**Actor principal:** Logística  
**Precondiciones:** usuario activo con permiso `assets.register`; serie no registrada.  
**Flujo principal:**
1. Usuario selecciona tipo de equipo.
2. Ingresa serie, origen, fecha y observación opcional.
3. Sistema deriva modelo/marca.
4. Backend valida identidad.
5. Se inserta maestro.
6. Se registra `ALTA_ACTIVO`.
7. Activo queda REGISTRADO, aún no disponible.

**Alternativas:** serie duplicada → 409; prefijo desconocido → 422.

## UC-02 — Recepción inicial sin OS

**Actor:** Logística  
**Precondición:** activo REGISTRADO sin circuito operacional.  
**Flujo:**
1. Seleccionar activo.
2. Capturar por SCANNER o MANUAL_AUTORIZADO.
3. Validar identidad/presencia.
4. Confirmar conformidad inicial.
5. Registrar RECEPCION_INICIAL.
6. Registrar HABILITADO_INSTALACION.
7. Activo queda DISPONIBLE_INSTALACION.

**Regla:** no se crea OS.

## UC-03 — Ingreso de requerimiento

**Actor:** Logística  
**Precondición:** activo en operación.  
**Flujo:**
1. Elegir origen ARANDA/INTERNO.
2. Seleccionar bus/activo.
3. Sistema autocompleta contexto conocido.
4. Informar falla y clasificación.
5. Backend revalida activo–bus–terminal–operador.
6. Crear caso.
7. Crear OS MV/MC/PDV/PDC.
8. Correlacionar referencia externa si aplica.
9. Registrar REQUERIMIENTO_INGRESADO.

## UC-04 — Asignar retiro de Terreno

**Actor:** Logística  
**Precondición:** OS pendiente de retiro.  
**Flujo:** listar pendientes → seleccionar técnico activo → asignar → técnico ve OS propia.

## UC-05 — Retiro físico

**Actor:** Técnico Terreno  
**Flujo:**
1. Abrir OS asignada.
2. Leer/validar equipo.
3. Si identidad no coincide, registrar discrepancia.
4. Confirmar retiro.
5. Adjuntar evidencia PoD si corresponde.
6. Registrar RETIRO_TERRENO_CONFIRMADO.
7. Equipo queda en tránsito a Bodega.

## UC-06 — Recepción Bodega desde Terreno

**Actor:** Logística  
**Flujo:** validar evidencia BODEGA → revalidar OS/ciclo → confirmar recepción → actualizar custodia → registrar evento.

## UC-07 — Despacho Bodega a Laboratorio

**Actor:** Logística  
**Flujo:** abrir cola → validar equipo físico → confirmar salida → registrar SALIDA_BODEGA_LABORATORIO → equipo queda En camino.

## UC-08 — Recepción Laboratorio

**Actor:** Jefe Laboratorio  
**Flujo:**
1. Bandeja En camino.
2. Abrir OS.
3. Validar evidencia de recepción Lab.
4. Confirmar.
5. Estado/ubicación pasan al dominio Lab.
6. Inicia SLA del ciclo.
7. OS pasa a Recibidos / pendiente de asignar.

**Alternativa:** discrepancia → Incidencias.

## UC-09 — Asignación de carga Lab

**Actor:** Jefe Laboratorio  
**Flujo:** seleccionar OS recibida → seleccionar técnico activo → confirmar → OS aparece en Mi carga del técnico.

**Regla:** asignar no mueve custodia.

## UC-10 — Diagnóstico y reparación

**Actor:** Técnico Laboratorio  
**Precondición:** OS asignada y físicamente disponible.  
**Flujo:**
1. Abrir Mi carga.
2. Iniciar trabajo.
3. Registrar diagnóstico.
4. Registrar falla real/observación.
5. Registrar intervenciones.
6. Registrar pruebas Manual/Test MK.
7. Guardar avances cuando sea necesario.
8. Finalizar cuando pruebas estén aprobadas.

## UC-11 — Solicitud de repuesto PoD

**Actor principal:** Técnico Lab  
**Actor secundario:** Logística  
**Flujo:**
1. Técnico documenta PoD.
2. Describe necesidad y motivo.
3. OS pasa a espera.
4. Logística revisa solicitud.
5. Selecciona repuesto/cantidad.
6. Backend bloquea inventario.
7. Entrega física.
8. Stock disminuye.
9. OS vuelve a reparación si no quedan solicitudes pendientes.

## UC-12 — Cierre técnico Lab

**Actor:** Técnico Lab  
**Flujo:** revalidar revisión → verificar sin solicitudes pendientes → validar pruebas → registrar reparación → eventos técnicos → estado final de taller.

**Regla:** no cambia custodia.

## UC-13 — Salida Laboratorio

**Actor:** Jefe Laboratorio  
**Flujo:** OS lista → validar evidencia SALIDA → confirmar → equipo entra en tránsito hacia Bodega.

## UC-14 — Recepción Bodega desde Lab

**Actor:** Logística  
**Resultado:** custodia Bodega; equipo puede prepararse para QA.

## UC-15 — Despacho Bodega a QA

**Actor:** Logística  
**Flujo:** validar evidencia → confirmar salida → nuevo ciclo QA.

## UC-16 — Recepción QA

**Actor:** QA  
**Flujo:** validar identidad → confirmar recepción → habilitar trabajo QA.

## UC-17 — Instalación Ambiente QA

**Actor:** QA  
**Resultado:** registrar hito/estado Ambiente. El procedimiento técnico detallado no se inventa si no está definido.

## UC-18 — Pruebas QA

**Actor:** QA  
**Flujo:** registrar pruebas/observaciones → guardar avance → mantener revisión/ciclo.

## UC-19 — Dictamen QA Operativo

**Actor:** QA  
**Flujo:** confirmar pruebas → dictamen OPERATIVO → conservar custodia QA hasta salida.

## UC-20 — Dictamen QA Rechazado

**Actor:** QA  
**Flujo:** registrar RECHAZADO + motivo → salida QA → recepción Bodega → nuevo despacho Lab → Jefe Laboratorio confirma la recepción física en Lab, que inicia el SLA del nuevo ciclo → asignación de técnico → inicio del trabajo técnico con antecedentes visibles. El despacho por sí solo no habilita asignación ni inicia el SLA; se requiere evidencia de recepción del ciclo correspondiente.

## UC-21 — Salida QA y recepción Bodega

**Actores:** QA, Logística  
**Regla:** son dos movimientos diferentes con evidencias diferentes.

## UC-22 — Nueva instalación desde stock inicial

**Actor:** Logística  
**Precondición:** HABILITADO_INSTALACION no consumido.  
**Flujo:** definir destino/técnico → capturar activo → validar → confirmar → crear IN con `stock_origen_evento` → registrar SALIDA_BODEGA_TERRENO.

## UC-23 — Nueva instalación desde stock reparado

**Actor:** Logística  
**Precondición:** reparación aprobada QA y físicamente recibida Bodega.  
**Flujo:** igual UC-22, pero IN referencia `stock_origen_os`.

## UC-24 — Completar instalación

**Actor:** Técnico Terreno  
**Precondiciones:** IN asignada al técnico, despacho físico vigente y bus coincidente con el destino confirmado por Logística.  
**Flujo:** confirmar el resultado mediante `POST /api/os/completar-instalacion`, indicando `operativo` como booleano.  
**Resultados:** `operativo=true` registra `INSTALACION_COMPLETADA` y estado 13, con el activo instalado/operativo en el bus/contexto confirmado. `operativo=false` registra `INSTALACION_FALLIDA` y estado 11; el equipo queda en retorno a Bodega, pendiente de la recepción física correspondiente. Ambos resultados dejan de cumplir la condición «En ruta» del despacho a Terreno. Registrar la falla no confirma recepción ni disponibilidad en Bodega.

## UC-25 — Trazabilidad por serie

**Actor:** rol autorizado  
**Flujo:** buscar tipo+serie → combinar OS, eventos, referencias, escaneos y reparación → presentar historial.

## UC-26 — Consulta técnica en Mobile

**Actor:** Técnico Terreno  
**Resultado:** mostrar solo falla, diagnóstico, trabajo, resultado y observaciones técnicas; no mostrar stock, costos, auditoría o autorizadores.

## UC-27 — Crear usuario

**Actor:** Admin  
**Flujo:** datos básicos + rol → crear Firebase → crear vínculo PostgreSQL → claims administrativos necesarios → usuario activo.

## UC-28 — Cambiar rol de otra cuenta

**Actor:** Admin  
**Reglas:** no autoedición; proteger último Admin; PostgreSQL toma efecto inmediato.

## UC-29 — Recuperación/cambio de contraseña

**Actor:** usuario/Admin según endpoint  
**Regla:** contraseña pertenece a Firebase; nunca persistir en DB.

## UC-30 — Bridge / correlación externa

**Actor:** Logística  
**Flujo:** seleccionar OS/activo existente → informar sistema/referencia → validar correspondencia → insertar correlación append-only.

## UC-31 — Dashboard ejecutivo

**Actor:** Admin/Gerente  
**Resultado:** KPI global sin doble conteo, OS separadas de parque, distribución de activos, supervisión.

## UC-32 — Dashboard Laboratorio

**Actor:** Jefe Lab/Admin/Gerente según proyección  
**Resultado:** camino, recibidos, sin asignar, diagnóstico, reparación, espera repuesto, listos, SLA/carga.

## UC-33 — Dashboard Bodega

**Actor:** Logística; consulta Admin/Gerente  
**Resultado:** parque, ubicación, disponibilidad, recepciones/despachos, stock.

## UC-34 — Dashboard QA

**Actor:** QA; consulta Admin/Gerente  
**Resultado:** entradas, Ambiente, Pruebas, Dictamen, Salida.

## UC-35 — Analítica de reincidencia

**Actores:** Admin, Gerente, Jefe Laboratorio y Logística, autorizados mediante `ai.read`.  
**Flujo:** API ejecuta Python → lectura históricos → score heurístico → top riesgo.  
**Regla:** no crea acciones automáticas.

# Casos negativos transversales

| Caso | Resultado esperado |
|---|---|
| evidencia de otra estación | 409/422 |
| evidencia antigua | rechazo por stale evidence |
| técnico intenta OS ajena | 403 |
| Admin intenta custodia Lab | 403 |
| Gerente intenta escritura | 403 |
| QA intenta asignación legacy | 410 |
| despacho sin evidencia | 409 |
| stock ya consumido | 409 |
| activo desconocido | 422/404 según contexto |
| tipo/serie incompatibles | 409/422 |
| reintento con contexto distinto | 409 |
| solicitud repuesto sin PoD | 422/409 |
| cierre Lab con prueba rechazada | 422 |
| último Admin desactivado | 409/403 |


# Matriz de trazabilidad de casos de uso

| UC | Actor principal | RF relacionados | Interfaz/API principal | Postcondición verificable |
|---|---|---|---|---|
| UC-01 | Logística | RF-ACT | POST /api/activos | maestro + ALTA_ACTIVO, sin OS |
| UC-02 | Logística | RF-ACT / RF-INV | /activos/recepcion/* | HABILITADO_INSTALACION |
| UC-03 | Logística | RF-REQ / RF-OS | POST /api/requerimientos | caso + OS + referencia opcional |
| UC-04 | Logística | RF-TER | POST /api/os/asignar-retiro | técnico Terreno asignado |
| UC-05 | Técnico Terreno | RF-TER | validar/discrepancia/confirmar-retiro | tránsito a Bodega |
| UC-06 | Logística | RF-BOD | recepción-terreno/validar + receive | custodia Bodega |
| UC-07 | Logística | RF-BOD / RF-LAB | dispatch-lab | tránsito Lab/ciclo |
| UC-08 | Jefe Lab | RF-LAB | custody RECEPCION | recepción + SLA |
| UC-09 | Jefe Lab | RF-LAB | PUT /lab/assign | carga técnica |
| UC-10 | Técnico Lab | RF-LTW | /lab/work/:codigoOs | diagnóstico/avance |
| UC-11 | Técnico Lab + Logística | RF-REP | /lab/request-part + /bodega/solicitudes | solicitud/entrega |
| UC-12 | Técnico Lab | RF-LTW | POST /lab/finish | cierre técnico, custodia Lab |
| UC-13 | Jefe Lab | RF-LAB | custody SALIDA | tránsito a Bodega |
| UC-14 | Logística | RF-BOD | PUT /bodega/receive | custodia Bodega |
| UC-15 | Logística | RF-BOD / RF-QA | dispatch-qa | tránsito QA |
| UC-16 | QA | RF-QA | QA validar/action | recepción QA |
| UC-17 | QA | RF-QA | QA action | hito Ambiente |
| UC-18 | QA | RF-QA | QA action | pruebas guardadas |
| UC-19 | QA | RF-QA | QA action | dictamen Operativo |
| UC-20 | QA; continuidad con Logística, Jefe Laboratorio y Técnico Lab | RF-QA | QA action; movimientos Bodega/Lab y recepción Lab | Rechazado + motivo; nuevo despacho y recepción física Lab antes de asignar/iniciar; SLA desde recepción |
| UC-21 | QA + Logística | RF-QA / RF-BOD | salida QA + receive | custodia Bodega |
| UC-22 | Logística | RF-INV | despacho validar/confirmar | IN con stock_origen_evento |
| UC-23 | Logística | RF-INV | despacho validar/confirmar | IN con stock_origen_os |
| UC-24 | Técnico Terreno | RF-TER / RF-INV | completar-instalacion | éxito: INSTALACION_COMPLETADA / estado 13; falla: INSTALACION_FALLIDA / estado 11, retorno pendiente de recepción Bodega |
| UC-25 | Rol autorizado | RF-TRZ | bridge buscar/historial | línea de tiempo |
| UC-26 | Técnico Terreno | RF-MOB / RF-TRZ | historial técnico | DTO técnico restringido |
| UC-27 | Admin | RF-USR | POST /admin/users | Firebase + PostgreSQL |
| UC-28 | Admin | RF-USR | PUT/PATCH users | rol efectivo actualizado |
| UC-29 | Usuario/Admin | RF-AUT / RF-USR | auth/password/reset | credencial Firebase |
| UC-30 | Logística | RF-BRG | POST /api/bridge | correlación append-only |
| UC-31 | Admin/Gerente | RF-DASH | /dashboard/executive | KPI global |
| UC-32 | Jefe Lab | RF-DASH / RF-LAB | /lab/supervision | KPI/carga/SLA |
| UC-33 | Logística | RF-DASH / RF-BOD | /bodega/dashboard | KPI logísticos |
| UC-34 | QA | RF-DASH / RF-QA | /qa/dashboard | etapas QA |
| UC-35 | Admin, Gerente, Jefe Laboratorio y Logística | RF-IA | /ai/predictive-report; ai.read | score heurístico |

# Precondiciones transversales

1. Usuario autenticado y activo.
2. Rol/capacidad autorizados.
3. Identidad de activo coherente.
4. OS/caso existente cuando el UC lo requiere.
5. Evidencia física vigente para movimientos.
6. Ciclo correcto de Lab/QA.
7. Recurso asignado al técnico cuando aplica.

# Postcondiciones transversales

Una mutación válida debe dejar:

- estado/custodia coherentes;
- evento/auditoría correspondiente;
- relaciones de identidad inalteradas;
- reintento seguro;
- ningún efecto parcial si la transacción falla.

# Escenarios de excepción comunes

| Excepción | Respuesta del sistema |
|---|---|
| usuario sin permiso | 403 |
| recurso inexistente | 404 |
| evidencia faltante/stale | 409 |
| tipo/serie incompatible | 409/422 |
| transición no permitida | 409 |
| flujo retirado | 410 |
| dato de negocio inválido | 422 |
| conflicto de duplicidad | 409 |

# Evidencia relacionada

La correspondencia requisito→implementación→prueba se detalla en `08_Pruebas/MATRIZ_TRAZABILIDAD_V2.0.md`. La correspondencia proceso→sistema se detalla en `BPMN/MATRIZ_BPMN_SISTEMA_V2.0.md`.
