# Modelo de Datos y Diccionario — PMP Suite V2.0

**Versión:** V2.0
**Motor:** PostgreSQL
**Esquema:** `pmp`
**Actualización:** 09-10-2026

## 1. Objetivo

Documentar el modelo físico vigente de PMP Suite, incluyendo tablas base, extensiones agregadas por migraciones, relaciones, restricciones, secuencias, vistas, triggers y decisiones de integridad.

La fuente de esta documentación es la combinación de:

1. estructura base respaldada del esquema PMP;
2. migraciones versionadas;
3. servicios Backend vigentes;
4. verificaciones de estructura usadas por las suites E2E.

## 2. Inventario de tablas vigente

La herramienta de verificación clasifica las tablas del esquema en:

### Configuración / maestros

- `estados`
- `ubicaciones`
- `usuarios`
- `terminales`
- `pst`
- `terminal_pst`
- `buses`
- `config_estado_ubicacion`
- `repuestos`

### Operacionales / históricas

- `bridge_mantenimiento`
- `bridge_referencias`
- `bridges`
- `casos_operacionales`
- `consolas`
- `escaneos_equipos`
- `flujo_eventos`
- `guia_detalle`
- `guias`
- `instalaciones_equipos`
- `ordenes_servicio`
- `os_historial_activo`
- `qa_inspecciones`
- `registro_reparaciones`
- `solicitud_items`
- `solicitudes_repuestos`
- `validadores`

Total clasificado: **26 tablas**.

## 3. Enumeraciones base

### `categoria_equipo`

- VALIDADOR
- CONSOLA
- GENERICO

### `estado_guia`

- EMITIDA
- RECIBIDA

### `estado_solicitud`

- PENDIENTE
- APROBADA
- RECHAZADA
- DESPACHADA

### `motivo_stock`

- CONSUMO_OS
- AJUSTE
- RECEPCION_GUIA
- AJUSTE_AUTO
- UPDATE_MANUAL

### `tipo_equipo_os`

- VALIDADOR
- CONSOLA

### `tipo_evento_os`

- CAMBIO_ESTADO
- COMENTARIO
- ALERTA_IA

### `tipo_ubicacion_enum`

- BODEGA
- LABORATORIO
- QA

# 4. Maestros

## 4.1 `usuarios`

| Campo | Tipo | Regla |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| nombre | varchar(100) | NOT NULL |
| apellido | varchar(100) | NOT NULL |
| correo | varchar(150) | NOT NULL, UNIQUE |
| rol | varchar(50) | NOT NULL |
| activo | boolean | default true |
| firebase_uid | varchar(128) | vínculo Firebase |

El rol efectivo se obtiene de esta tabla. El backend reconoce siete valores oficiales.

## 4.2 `validadores`

| Campo | Tipo | Regla |
|---|---|---|
| serie | varchar(50) | PK |
| modelo | varchar(50) | actualmente admite NULL para históricos |
| marca | varchar(50) | default Mikroelektronika |
| amid | varchar(32) | único cuando existe; formato 12 dígitos |
| origen_registro | varchar(80) | metadata de alta |
| fecha_ingreso | timestamptz | metadata de alta |
| observacion_registro | text | metadata de alta |
| registrado_por | uuid | FK usuarios |

Regla de identidad V2.0: 72→CVB35; 74/75→CVB45.

## 4.3 `consolas`

| Campo | Tipo | Regla |
|---|---|---|
| serie | varchar(50) | PK |
| modelo | varchar(50) | admite NULL en históricos |
| marca | varchar(50) | default Waysion |
| origen_registro | varchar(80) | metadata de alta |
| fecha_ingreso | timestamptz | metadata de alta |
| observacion_registro | text | metadata de alta |
| registrado_por | uuid | FK usuarios |

Regla V2.0: modelo N9715 / Waysion.

## 4.4 `buses`

| Campo | Tipo |
|---|---|
| ppu | varchar(10), PK |

## 4.5 `terminales`

| Campo | Tipo | Regla |
|---|---|---|
| id | integer | PK |
| nombre | varchar(100) | NOT NULL, UNIQUE |

## 4.6 `pst`

| Campo | Tipo |
|---|---|
| codigo | varchar(20), PK |
| nombre | varchar(120), NOT NULL |

## 4.7 `terminal_pst`

| Campo | Tipo | Relación |
|---|---|---|
| terminal_id | integer | PK compuesta, FK terminales |
| pst_codigo | varchar(20) | PK compuesta, FK pst |

La relación se revalida en Backend antes de crear requerimientos/OS.

## 4.8 `estados`

| Campo | Tipo |
|---|---|
| id | integer, PK |
| nombre | varchar(50), UNIQUE |

Los IDs históricos continúan utilizándose; la presentación actual puede derivar estados más específicos mediante eventos.

## 4.9 `ubicaciones`

| Campo | Tipo |
|---|---|
| id | integer, PK |
| nombre | varchar(100) |
| tipo | tipo_ubicacion_enum |

## 4.10 `config_estado_ubicacion`

PK compuesta `estado_id + tipo_ubicacion`. Define combinaciones de estado/ubicación permitidas para lógica histórica de validación.

## 4.11 `repuestos`

| Campo | Tipo | Regla |
|---|---|---|
| id | integer | PK |
| nombre | varchar(150) | NOT NULL |
| categoria | categoria_equipo | NOT NULL |
| stock | integer | >=0 |
| stock_critico | integer | default 5 |

# 5. Núcleo operacional

## 5.1 `ordenes_servicio`

Tabla central de intervenciones.

### Campos base

| Campo | Tipo | Uso |
|---|---|---|
| codigo_os | varchar(50) | PK |
| fecha | timestamp | creación |
| tipo_equipo | varchar(20) | VALIDADOR/CONSOLA |
| es_pod | boolean | clasificación PoD |
| validador_serie | varchar(50) | FK validadores |
| consola_serie | varchar(50) | FK consolas |
| falla | text | falla reportada |
| estado_id | integer | FK estados |
| bus_ppu | varchar(10) | FK buses |
| terminal_id | integer | FK terminales |
| pst_codigo | varchar(20) | FK pst |
| ubicacion_id | integer | FK ubicaciones |
| tecnico_terreno_id | uuid | FK usuarios |
| tecnico_laboratorio_id | uuid | FK usuarios |
| actualizado_en | timestamp | última actualización |

### Campos vigentes agregados/evidenciados por el código actual

| Campo | Uso |
|---|---|
| es_instalacion | distingue OS IN |
| es_aprobado_qa | evidencia de resultado QA compatible con stock |
| ticket_aranda | compatibilidad histórica de referencia |
| qa_usuario_id | compatibilidad / contexto QA |
| qa_asignado_por | compatibilidad histórica |
| qa_asignado_en | compatibilidad histórica |
| caso_id | FK casos_operacionales |
| os_origen | FK ordenes_servicio |
| stock_origen_os | OS reparada consumida por una IN |
| instalacion_numero | columna legacy conservada |
| stock_origen_evento | FK flujo_eventos para stock inicial |

### Restricciones relevantes

- exactamente una serie según tipo;
- identidad tipo/serie inmutable;
- código generado en BD/backend;
- caso/origen/stock origen inmutables;
- `stock_origen_evento` solo para instalación;
- un evento de stock inicial se consume una sola vez.

## 5.2 `casos_operacionales`

| Campo | Tipo | Uso |
|---|---|---|
| id | bigserial | PK |
| codigo_caso | varchar(64) | UNIQUE |
| origen | varchar(32) | ARANDA / INTERNO |
| referencia_externa | varchar(120) | AR-… cuando aplica |
| componente | varchar(32) | componente de correlación |
| tipo_equipo | varchar(20) | tipo origen |
| serie_origen | varchar(50) | activo que originó el caso |
| bus_ppu | varchar(20) | bus |
| terminal_id | integer | terminal |
| pst_codigo | varchar(30) | operador |
| falla_reportada | text | falla |
| observacion | text | contexto |
| fecha_requerimiento | timestamptz | fecha negocio |
| creado_por | uuid | FK usuarios |
| creado_en | timestamptz | auditoría |
| siguiente_instalacion | integer | compatibilidad de secuencia histórica |

La identidad del caso es inmutable salvo contador legacy.

## 5.3 `flujo_eventos`

Historial transversal append-only.

| Campo | Tipo |
|---|---|
| id | bigserial PK |
| bridge_codigo | varchar(32), nullable |
| codigo_os | varchar(50), nullable |
| tipo | varchar(64) |
| usuario_id | uuid |
| rol | varchar(50) |
| fecha | timestamptz |
| comentario | text |
| metadata | jsonb |
| tipo_equipo | varchar(20), nullable |
| serie | varchar(50), nullable |

Permite eventos asociados directamente a activo aun sin OS, por ejemplo recepción inicial.

Índices:

- por Bridge/fecha/id;
- por OS/fecha/id;
- por tipo_equipo/serie/fecha;
- único parcial para HABILITADO_INSTALACION inicial.

Trigger: validación de que el activo exista y bloqueo append-only.

## 5.4 `escaneos_equipos`

| Campo | Tipo | Regla |
|---|---|---|
| id | bigserial | PK |
| codigo_leido | varchar(64) | lectura |
| tipo_codigo | varchar(16) | SERIE/AMID |
| estacion | varchar(20) | BODEGA/LABORATORIO/QA |
| tipo_equipo | varchar(20) | resuelto |
| serie | varchar(50) | resuelta |
| amid | varchar(32) | opcional |
| codigo_os | varchar(50) | FK OS, nullable para recepción inicial |
| ubicacion_id | integer | FK ubicaciones |
| usuario_id | uuid | actor |
| rol | varchar(50) | rol al capturar |
| resultado | varchar(16) | VALIDADO/RECHAZADO |
| motivo | varchar(64) | requerido si rechazo |
| fecha | timestamptz | auditoría |
| metadata | jsonb | propósito/ciclo/contexto |

La tabla es append-only.

## 5.5 `os_historial_activo`

| Campo | Tipo |
|---|---|
| id | bigserial PK |
| codigo_os | varchar(50) |
| tipo_equipo | varchar(20) |
| serie | varchar(50) |
| fecha | timestamptz |
| evento | varchar(32) |
| anterior | jsonb |
| actual | jsonb |

Trigger sobre `ordenes_servicio` registra INSERT/UPDATE e impide cambio de identidad.

# 6. Laboratorio

## 6.1 `registro_reparaciones`

| Campo | Tipo |
|---|---|
| id | uuid PK |
| codigo_os | varchar(50), FK OS |
| tecnico_id | uuid, FK usuarios |
| falla_detectada | text |
| accion_realizada | text |
| repuestos_usados | text legacy |
| comentario | text |
| fecha_registro | timestamp |
| prueba_realizada | text |
| resultado_prueba | text |

En V2.0 `repuestos_usados` no gobierna stock; el inventario se gestiona en Bodega.

## 6.2 `solicitudes_repuestos`

Campos base:

- id PK;
- codigo_os FK;
- solicitado_por FK usuario;
- estado;
- fecha_solicitud;
- fecha_despacho.

Campos utilizados por V2.0:

- `repuesto_solicitado`: descripción de necesidad;
- `comentario`: motivo técnico.

El técnico no selecciona inventario.

## 6.3 `solicitud_items`

| Campo | Tipo |
|---|---|
| id | integer PK |
| solicitud_id | FK solicitudes_repuestos |
| repuesto_id | FK repuestos |
| cantidad | integer > 0 |

Existe unicidad solicitud+repuesto.

# 7. QA

## 7.1 `qa_inspecciones`

Estructura histórica compatible:

| Campo | Tipo |
|---|---|
| id | uuid PK |
| codigo_os | varchar(50) |
| qa_usuario_id | uuid |
| resultado | APROBADO/RECHAZADO |
| comentario | text |
| certificacion | text |
| fecha | timestamptz |

El flujo QA V2.0 usa además snapshots/eventos en `flujo_eventos` para representar Ambiente, pruebas, dictamen y ciclos sin crear otra tabla por etapa.

# 8. Bridge y referencias

## 8.1 `bridge_referencias`

| Campo | Tipo |
|---|---|
| id | bigserial PK |
| tipo_equipo | varchar(20) |
| serie | varchar(50) |
| codigo_os | varchar(50), FK OS |
| sistema_externo | varchar(50) |
| referencia_externa | varchar(120) |
| comentario | text |
| creado_por | uuid |
| creado_en | timestamptz |

Índice único: tipo+serie+OS+sistema+referencia.

Trigger valida que la OS corresponda exactamente al activo. Es append-only.

## 8.2 `bridges`

Tabla histórica del flujo Bridge anterior. Se conserva para compatibilidad y trazabilidad; V2.0 no la usa como motor operacional.

Campos principales:

- codigo_bridge PK;
- estado;
- origen/sistema/referencia;
- tipo_equipo;
- equipo preparado/retirado/instalado;
- bus/terminal/PST esperados y confirmados;
- técnico Terreno;
- usuarios/fechas de creación/asignación/cierre;
- motivo/observaciones/evidencia.

Los registros cerrados son inmutables.

## 8.3 `bridge_mantenimiento`

Relación histórica 1:1 Bridge ↔ OS de mantenimiento.

## 8.4 `instalaciones_equipos`

Registro histórico de intervención Bridge:

- id;
- bridge_codigo;
- tipo;
- retirado;
- instalado;
- bus;
- terminal;
- PST;
- técnico;
- fecha;
- observación/evidencia.

Append-only.

# 9. Guías

## 9.1 `guias`

- numero PK;
- fecha;
- origen_id;
- destino_id;
- creado_por.

## 9.2 `guia_detalle`

- id PK;
- guia_numero;
- tipo_equipo;
- validador_serie / consola_serie;
- bus_ppu;
- codigo_os;
- nota.

Mantiene compatibilidad de documentación logística; el flujo Physical First no depende exclusivamente de una guía para probar custodia.

# 10. Vistas vigentes

## `v_referencias_activo`

Une:

- bridge_referencias actuales;
- `ticket_aranda` histórico de OS;
- Bridge legacy.

Permite búsqueda unificada de referencias.

## `v_ubicacion_fisica_equipos`

Proyecta el último escaneo VALIDADO por tipo+serie.

La aplicación V2.0 complementa esta vista con eventos de custodia y reglas por ciclo.

# 11. Secuencias

Principales:

- `seq_mv`
- `seq_mc`
- `seq_pdv`
- `seq_pdc`
- `seq_in`
- `seq_caso_interno`
- `seq_bridge`
- secuencias estándar de IDs serial/bigserial.

## Generación OS

```text
es_instalacion → IN
Validador + PoD → PDV
Validador normal → MV
Consola + PoD → PDC
Consola normal → MC
```

La secuencia IN es independiente.

# 12. Triggers / funciones críticas

| Componente | Función |
|---|---|
| bloquear_historico_append_only | impide UPDATE/DELETE en historiales |
| validar_correlacion_activo | OS debe coincidir tipo+serie |
| registrar_historial_activo | snapshot de cambios de OS |
| proteger_identidad_caso | caso inmutable |
| validar_relaciones_caso | consistencia caso/origen/stock |
| generar_id_os | genera nomenclatura |
| validar_evento_activo | evidencia solo sobre activo existente |
| validar_stock_evento | stock inicial compatible/inmutable |
| bloqueo Bridge cerrada | preserva registros legacy cerrados |

# 13. Relaciones principales

```mermaid
erDiagram
 USUARIOS |o--o{ ORDENES_SERVICIO : asigna
 USUARIOS ||--o{ FLUJO_EVENTOS : ejecuta
 VALIDADORES |o--o{ ORDENES_SERVICIO : identifica
 CONSOLAS |o--o{ ORDENES_SERVICIO : identifica
 CASOS_OPERACIONALES |o--o{ ORDENES_SERVICIO : agrupa
 ORDENES_SERVICIO |o--o{ FLUJO_EVENTOS : genera
 ORDENES_SERVICIO |o--o{ ESCANEOS_EQUIPOS : evidencia
 ORDENES_SERVICIO ||--o{ REGISTRO_REPARACIONES : registra
 ORDENES_SERVICIO ||--o{ SOLICITUDES_REPUESTOS : solicita
 SOLICITUDES_REPUESTOS ||--o{ SOLICITUD_ITEMS : contiene
 REPUESTOS ||--o{ SOLICITUD_ITEMS : item
 ORDENES_SERVICIO ||--o{ BRIDGE_REFERENCIAS : correlaciona
 ORDENES_SERVICIO ||--o{ OS_HISTORIAL_ACTIVO : audita
 TERMINALES ||--o{ TERMINAL_PST : permite
 PST ||--o{ TERMINAL_PST : opera
 GUIAS ||--o{ GUIA_DETALLE : contiene
```

# 14. Origen de stock

## Inicial

`flujo_eventos.id` de tipo HABILITADO_INSTALACION → `ordenes_servicio.stock_origen_evento`.

## Reparado

OS reparada/QA/recibida → `ordenes_servicio.stock_origen_os`.

No se permite usar ambos orígenes simultáneamente.

# 15. Modelo de custodia

La custodia no se interpreta solo mediante `estado_id`.

Se deriva de:

- estado;
- ubicación;
- último evento de salida/recepción;
- evidencia física;
- ciclo Lab/QA;
- stock origen.

Por eso la arquitectura usa funciones de proyección como `logisticsStateSql`, `labTransitSql` y `qaStateSql`.

# 16. Integridad y concurrencia

Las operaciones críticas usan:

- transacciones;
- `FOR UPDATE`;
- advisory locks por activo/evidencia;
- índices únicos;
- checks;
- FKs;
- eventos append-only;
- firmas/fingerprints de payload para reintentos.

# 17. Consideraciones de mantenimiento

Este diccionario debe actualizarse cuando una migración agregue/elimine tabla, campo, índice, trigger o vista.

La fuente de verdad física definitiva continúa siendo PostgreSQL + migraciones; ningún diagrama reemplaza la comprobación de esquema.


# 18. Procedencia de la evolución del esquema

La V2.0 no considera el esquema como un archivo estático: su estructura actual resulta de la base histórica más migraciones aditivas. La siguiente cronología permite explicar qué problema técnico introdujo cada cambio.

| Migración | Objetivo principal | Estructuras relevantes |
|---|---|---|
| bridge/001 | flujo histórico Bridge y evidencia transversal inicial | bridges, bridge_mantenimiento, instalaciones_equipos, qa_inspecciones, flujo_eventos |
| escaneo/001 | identificación física y ubicación confirmada | amid, escaneos_equipos, v_ubicacion_fisica_equipos |
| bridge/002 | convertir Bridge vigente en correlación/historial | bridge_referencias, v_referencias_activo, os_historial_activo |
| requerimientos/003 | casos operacionales y relaciones explícitas | casos_operacionales, caso_id, os_origen, stock_origen_os |
| requerimientos/004 | IN independiente y atributos técnicos no inventados | generar_id_os actualizado, modelo nullable histórico |
| requerimientos/005 | maestro de activos administrable | origen_registro, fecha_ingreso, observacion_registro, registrado_por |
| requerimientos/006 | recepción inicial sin OS y origen de stock por evento | tipo_equipo/serie en flujo_eventos, stock_origen_evento, validación de activo |

## 18.1 Migración Bridge 001

Introdujo estructuras hoy conservadas principalmente por compatibilidad histórica:

- `seq_bridge`;
- `bridges`;
- `bridge_mantenimiento`;
- `instalaciones_equipos`;
- campos QA legacy en OS;
- `qa_inspecciones`;
- `flujo_eventos`;
- triggers append-only.

**Estado V2.0:** Bridge operacional ya no gobierna movimientos. Las tablas históricas se preservan porque contienen trazabilidad previa.

## 18.2 Migración de identificación física

Agregó:

- `validadores.amid`;
- check de 12 dígitos;
- índice único parcial de AMID;
- `escaneos_equipos`;
- índices por activo/OS/estación;
- `v_ubicacion_fisica_equipos`;
- append-only del registro de escaneo.

Esto habilitó separar “registro de estado” de “evidencia de identificación física”.

## 18.3 Migración Bridge correlación

Agregó la línea vigente de correlación:

- `bridge_referencias`;
- validación trigger tipo+serie+OS;
- unicidad de sistema/referencia;
- vista `v_referencias_activo`;
- `os_historial_activo`;
- trigger de identidad OS inmutable.

## 18.4 Casos operacionales

`003_casos_operacionales.sql` agregó:

- `seq_caso_interno`;
- `casos_operacionales`;
- `caso_id`;
- `os_origen`;
- `stock_origen_os`;
- `instalacion_numero` legacy;
- índices/unicidades de caso;
- protección de identidad del caso;
- validación de relaciones de una OS.

La migración inicial también contenía una forma de IN asociada a caso. La migración siguiente la sustituyó hacia **IN independiente**, que es la regla vigente.

## 18.5 OS independientes / IN

`004_os_independientes_alta_activos.sql`:

- permite `modelo NULL` para históricos sin inventar modelo;
- sincroniza `seq_in` con códigos históricos;
- actualiza `generar_id_os()`;
- hace que nuevas IN utilicen correlativo PMP independiente;
- conserva columnas legacy por compatibilidad.

## 18.6 Gestión de activos

`005_gestion_activos.sql` agrega metadata de registro a validadores/consolas:

- origen;
- fecha;
- observación;
- usuario que registró.

Dar de alta el maestro **no** equivale a recibir stock.

## 18.7 Recepción inicial sin OS

`006_recepcion_inicial_sin_os.sql` consolida la regla vigente:

- `flujo_eventos` puede referenciar directamente tipo+serie sin OS;
- `HABILITADO_INSTALACION` es único para el origen inicial;
- recepción inicial puede registrar evidencia de activo nuevo;
- trigger verifica que el activo exista;
- `stock_origen_evento` enlaza una IN al evento de stock inicial;
- índice único impide consumir dos veces el mismo origen;
- trigger hace inmutable el origen físico.

# 19. Matriz tabla → responsabilidad → escritura

| Tabla | Escritura principal | Lectores principales |
|---|---|---|
| usuarios | Admin/API administración | Auth, supervisión |
| validadores/consolas | Logística alta; migraciones históricas | todos según proyección |
| ordenes_servicio | servicios de negocio | múltiples módulos |
| casos_operacionales | Logística/requerimientos | supervisión/operación |
| flujo_eventos | servicios de dominio | trazabilidad/KPI |
| escaneos_equipos | captura/validación autorizada | custodia/trazabilidad |
| registro_reparaciones | Técnico Lab al cierre | Lab/QA/historial |
| solicitudes_repuestos | Técnico Lab inicia; Logística resuelve | Lab/Bodega |
| solicitud_items | Logística entrega | Bodega/auditoría |
| repuestos | logística/migración/política autorizada | Bodega |
| qa_inspecciones | compatibilidad histórica QA | trazabilidad |
| bridge_referencias | Logística | búsqueda/trazabilidad |
| os_historial_activo | trigger automático | historial |
| guias/guia_detalle | logística histórica | auditoría/contexto |

# 20. Claves de integridad que deben preservarse

## Identidad

- un Validador usa `validadores.serie`;
- una Consola usa `consolas.serie`;
- una OS referencia exactamente uno de ambos;
- actualización no puede cambiar tipo/serie de la OS.

## Caso

- caso no se reescribe, excepto compatibilidad de contador legacy;
- OS ligada al caso debe corresponder al tipo/activo esperado;
- referencia externa no se duplica por origen.

## Evidencia

- validado: tipo+serie resueltos y contexto compatible;
- rechazado: motivo obligatorio;
- evidencia queda append-only;
- ubicación/estación se enlaza al momento de captura.

## Stock

- origen evento y origen OS son alternativos;
- el origen debe corresponder al mismo tipo+serie;
- un origen no se consume dos veces.

## Historial

- eventos, escaneos, referencias, instalaciones históricas y snapshots no deben editarse para “corregir” retrospectivamente un flujo.

# 21. Read models / proyecciones

La base mantiene datos normalizados y evidencia; la interfaz necesita proyecciones.

| Proyección | Objetivo |
|---|---|
| `v_referencias_activo` | unificar referencias actuales/históricas |
| `v_ubicacion_fisica_equipos` | último escaneo validado |
| `operatingAssetsSql` | activos actualmente operativos |
| `installationReadySql` | activos elegibles para instalación |
| `warehouseQueueSql` | cola Bodega coherente con badges |
| `labTransitSql` | tránsito real hacia Lab |
| `labAvailableSql` | carga disponible Lab |
| `qaStageSql` | etapa del ciclo QA |
| `qaReceivedSql` | recepción QA vigente |

Estas proyecciones son importantes porque **estado_id por sí solo no expresa toda la realidad física**.

# 22. Diagrama lógico ampliado

```mermaid
erDiagram
 USUARIOS |o--o{ ORDENES_SERVICIO : "asignación"
 USUARIOS ||--o{ FLUJO_EVENTOS : "actor"
 USUARIOS ||--o{ ESCANEOS_EQUIPOS : "captura"
 VALIDADORES |o--o{ ORDENES_SERVICIO : "serie"
 CONSOLAS |o--o{ ORDENES_SERVICIO : "serie"
 CASOS_OPERACIONALES |o--o{ ORDENES_SERVICIO : "caso"
 ORDENES_SERVICIO |o--o{ ORDENES_SERVICIO : "os_origen/stock_origen_os"
 ORDENES_SERVICIO |o--o{ FLUJO_EVENTOS : "eventos"
 ORDENES_SERVICIO |o--o{ ESCANEOS_EQUIPOS : "evidencia"
 ORDENES_SERVICIO ||--o{ OS_HISTORIAL_ACTIVO : "snapshot"
 ORDENES_SERVICIO ||--o{ REGISTRO_REPARACIONES : "reparación"
 ORDENES_SERVICIO ||--o{ QA_INSPECCIONES : "QA histórico"
 ORDENES_SERVICIO ||--o{ BRIDGE_REFERENCIAS : "referencias"
 ORDENES_SERVICIO ||--o{ SOLICITUDES_REPUESTOS : "necesidad"
 SOLICITUDES_REPUESTOS ||--o{ SOLICITUD_ITEMS : "despacho"
 REPUESTOS ||--o{ SOLICITUD_ITEMS : "repuesto"
 TERMINALES ||--o{ TERMINAL_PST : "relación"
 PST ||--o{ TERMINAL_PST : "relación"
 BUSES ||--o{ ORDENES_SERVICIO : "bus"
 UBICACIONES ||--o{ ORDENES_SERVICIO : "ubicación"
 ESTADOS ||--o{ ORDENES_SERVICIO : "estado"
 GUIAS ||--o{ GUIA_DETALLE : "detalle"
```

# 23. Regla de actualización del diccionario

Al agregar una migración nueva se debe actualizar:

1. inventario de tablas;
2. campos afectados;
3. PK/FK/check/index;
4. secuencias/vistas/triggers;
5. read models;
6. ERD;
7. ERS si cambia negocio;
8. pruebas de integridad.

## Lectura de cardinalidades (revisión 11-10-2026)

`|o` indica padre opcional y `o{` múltiples registros dependientes. Una OS referencia exactamente un validador **o** una consola (XOR); las dos relaciones individuales son opcionales. Caso, técnico y OS de origen pueden faltar. Los eventos de alta/recepción inicial pueden existir por **tipo + serie sin OS**. No se representa una tabla adicional de activos. Los diagramas son proyecciones parciales; no sustituyen los checks/FK de las migraciones.
