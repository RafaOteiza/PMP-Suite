# Decisiones Arquitectónicas — PMP Suite V2.0

**Versión:** V2.0  
**Actualización:** 09-10-2026

## 1. Propósito

Registrar decisiones que explican **por qué** PMP Suite está construido como está. No reemplaza la Arquitectura Integral; complementa el diseño con contexto, alternativas y consecuencias.

## ADR-01 — PostgreSQL como autoridad del rol efectivo

**Problema:** Firebase autentica, pero un claim puede quedar desactualizado después de un cambio administrativo.

**Decisión:** Firebase prueba identidad; `pmp.usuarios` determina cuenta activa y rol efectivo en cada solicitud.

**Alternativas descartadas:** confiar solo en Custom Claims; mantener roles duplicados como fuentes equivalentes.

**Consecuencias:** cambio PostgreSQL toma efecto inmediato; UID/correo deben mantenerse consistentes; el Backend consulta usuario en cada request protegido.

## ADR-02 — Autorización por acción, sin wildcard Admin

**Problema:** “Admin puede hacer todo” mezcla administración de sistema con operación física.

**Decisión:** `authorization.js` define capacidades explícitas: `users.manage`, `warehouse.move`, `lab.custody`, etc.

**Consecuencias:** mínimo privilegio; pruebas RBAC más claras; nuevas acciones deben agregarse deliberadamente.

## ADR-03 — Jefe Laboratorio como rol separado

**Problema:** recepción, asignación y despacho Lab no corresponden al Técnico Lab ni al Admin.

**Decisión:** `jefe_laboratorio` controla custodia/asignación/supervisión Lab. Técnico ejecuta trabajo técnico.

**Consecuencias:** segregación; SLA y carga tienen dueño; Admin conserva supervisión.

## ADR-04 — Physical First

**Problema:** un cambio de estado digital puede afirmar que un equipo llegó/salió sin prueba del movimiento físico.

**Decisión:** separar validación de identidad y confirmación de movimiento.

**Alternativa descartada:** scan único con efecto automático.

**Consecuencias:** más pasos explícitos, pero mejor integridad y auditoría. Cada propósito/ciclo necesita evidencia nueva.

## ADR-05 — Eventos append-only

**Problema:** sobrescribir filas de estado elimina contexto histórico.

**Decisión:** `flujo_eventos`, escaneos, referencias e historial crítico se registran append-only.

**Consecuencias:** auditoría y reconstrucción; los read models deben interpretar secuencia temporal.

## ADR-06 — Caso, OS, activo y referencia externa son independientes

**Problema:** reutilizar el mismo identificador para necesidad, intervención y activo mezcla historias.

**Decisión:** modelar explícitamente `casos_operacionales`, `ordenes_servicio`, maestros de activos y `bridge_referencias`.

**Consecuencias:** una necesidad puede involucrar varias intervenciones sin alterar identidad física.

## ADR-07 — Bridge correlation-only

**Problema:** el Bridge histórico llegó a ejecutar creación/asignación/mantenimiento, formando un segundo motor operacional.

**Decisión:** Bridge V2.0 solo busca/correlaciona referencia externa ↔ OS/activo. URLs operacionales antiguas se retiran con 410.

**Consecuencias:** un solo workflow: OS PMP.

## ADR-08 — IN creada al despacho físico

**Problema:** crear instalación al seleccionar activo/técnico afirma un movimiento que aún no ocurrió.

**Decisión:** la IN nace atómicamente con confirmación de `SALIDA_BODEGA_TERRENO`.

**Consecuencias:** “Asignado” y “En ruta” son conceptos distintos; selección/scan no consumen stock.

## ADR-09 — Stock inicial sin OS ficticia

**Problema:** un activo nuevo en Bodega no ha recibido mantenimiento.

**Decisión:** alta + recepción inicial + evento `HABILITADO_INSTALACION`; la primera OS puede ser una IN real.

**Consecuencias:** historial semánticamente correcto y origen de stock auditable.

## ADR-10 — Dos orígenes de stock

**Decisión:** instalación consume exactamente uno de:

- `stock_origen_evento`: stock inicial;
- `stock_origen_os`: stock reparado.

Índices/constraints evitan doble consumo.

## ADR-11 — Técnico Lab no administra inventario

**Problema:** registrar una reparación no equivale a entregar físicamente un repuesto.

**Decisión:** Técnico describe necesidad. Logística selecciona pieza/cantidad y confirma entrega; ahí baja stock.

**Consecuencias:** inventario y trabajo técnico conservan responsabilidades distintas.

## ADR-12 — QA autónomo y dictamen separado de salida

**Problema:** asignación Admin y aprobación que despacha automáticamente mezclan responsabilidades.

**Decisión:** QA toma su trabajo por etapas; dictamen conserva custodia; salida se confirma con evidencia física.

## ADR-13 — Estado proyectado además de estado_id

**Problema:** catálogo histórico de estados no representa conceptos como En camino Lab, etapa QA o stock elegible.

**Decisión:** conservar `estado_id` y derivar presentación con eventos/custodia/read models.

**Consecuencias:** compatibilidad histórica sin sacrificar semántica V2.0.

## ADR-14 — Regla de identidad compartida

**Problema:** Web/Mobile/Backend podrían inferir modelos distintos.

**Decisión:** centralizar reglas base en `shared/assetIdentity.js` y revalidar Backend.

**Consecuencias:** autofill coherente; prefijo desconocido bloqueado.

## ADR-15 — Proyección técnica para Terreno

**Problema:** historial global contiene stock, auditoría y datos internos innecesarios para Técnico Terreno.

**Decisión:** Backend entrega un DTO allowlist con falla, diagnóstico, trabajo, resultado y observación técnica.

## ADR-16 — PostgreSQL efímero para E2E destructivo

**Problema:** pruebas de flujo/estrés pueden contaminar la base habitual.

**Decisión:** suites con escrituras críticas usan clúster/DB desechable y verificaciones de aislamiento.

## ADR-17 — IA como apoyo de lectura

**Problema:** una PoC no debe ejecutar decisiones sobre activos.

**Decisión:** Python consulta históricos y devuelve score heurístico; no escribe ni crea OS.

## ADR-18 — Procesos operacionales en página

**Problema:** modales encadenados ocultan contexto y dificultan navegación/foco.

**Decisión:** procesos de negocio se ejecutan en páginas/paneles inline. Permisos nativos del sistema son excepción.

## 2. Regla de evolución

Una ADR se modifica solo cuando cambia la decisión. Si aparece una decisión nueva, se agrega otra entrada en lugar de reescribir retrospectivamente el motivo histórico.
