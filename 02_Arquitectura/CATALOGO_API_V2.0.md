# Catálogo API — PMP Suite V2.0

Esta copia conserva documentación vigente y pruebas reutilizables. Los informes de ejecución, capturas y resultados históricos citados permanecen únicamente en el archivo original Tesis; no se incluyen ni acreditan una nueva ejecución en PMP_Suite_V2.0. Las comprobaciones de esta copia y sus pendientes se describen en el README principal.


**Versión:** V2.0
**Revisión documental:** 11-10-2026
**Base habitual de desarrollo:** `http://localhost:4000/api`

## 1. Propósito

Documentar las rutas HTTP realmente montadas por `src/app.js`, su dominio, autorización y estado contractual. Este catálogo no sustituye el código; sirve como inventario verificable para arquitectura, requisitos, pruebas y defensa Capstone.

## 2. Cadena de seguridad

En rutas protegidas, la secuencia general es:

```text
Bearer Firebase
→ firebaseAuth
→ ensureUser
→ enforceReadOnlyRole
→ authorize(action) / requireAnyRole / requireSelfOrAdmin
→ handler
→ service de dominio
→ PostgreSQL
```

El rol efectivo se obtiene desde `pmp.usuarios`. Los claims o campos enviados por el cliente no otorgan permisos.

## 3. Convenciones

| Estado | Significado |
|---|---|
| Activa | forma parte del contrato V2.0 |
| Consulta | lectura/supervisión, sin mutación operacional |
| Self-service | operación sobre la propia identidad |
| Bloqueada | ruta existente que devuelve error controlado por política |
| Retirada | compatibilidad explícita; devuelve 410 |

## 4. Autenticación y seguridad personal

| Método | Ruta | Guard | Estado | Propósito |
|---|---|---|---|---|
| GET | `/auth/me` | usuario autenticado/activo | Self-service | identidad PostgreSQL + contexto Firebase |
| POST | `/auth/reset-password-link` | usuario autenticado/activo | Self-service | generar enlace para propia cuenta |
| POST | `/auth/my/reset-password-link` | usuario autenticado/activo | Self-service | variante explícita self-service |
| POST | `/auth/password` | usuario autenticado/activo | Self-service | cambiar contraseña propia en Firebase |

Los POST de `/auth/*` también pasan por `enforceReadOnlyRole`: **Gerente recibe 403**, aun siendo autoservicio. El cambio de contraseña de Mobile usa el SDK Firebase con reautenticación; no confundir ambos contratos.

## 5. Administración de usuarios

| Método | Ruta | Guard | Estado | Propósito |
|---|---|---|---|---|
| GET | `/users` | `users.manage` | Activa | listar/filtrar usuarios |
| GET | `/users/:id` | self o Admin | Activa | consultar una cuenta autorizada |
| PATCH | `/users/:id` | `users.manage` | Activa | editar cuenta con protección administrativa |
| POST | `/users/:id/password` | `users.manage` | Activa | operación administrativa de contraseña |
| POST | `/admin/users` | `users.manage` | Activa | crear Firebase + PostgreSQL |
| PUT | `/admin/users/:id` | `users.manage` | Activa | editar usuario |
| PATCH | `/admin/users/:id/activar` | `users.manage` | Activa | activar cuenta |
| PATCH | `/admin/users/:id/desactivar` | `users.manage` | Activa | desactivar cuenta |
| POST | `/admin/users/:id/reset-password-link` | `users.manage` | Activa | generar recuperación |
| POST | `/admin/users/:id/set-password` | `users.manage` | Activa | establecer contraseña Firebase |

Protecciones: último Admin, autoedición de privilegios/estado y rol oficial.

## 6. Activos y recepción inicial

El router aplica `assets.read` a GET y `assets.register` a mutaciones.

| Método | Ruta | Estado | Propósito |
|---|---|---|---|
| GET | `/activos` | Activa | buscar activos registrados y estado derivado |
| POST | `/activos` | Activa | registrar maestro; no crea OS |
| POST | `/activos/recepcion/validar` | Activa | validar identidad/presencia inicial |
| POST | `/activos/recepcion` | Activa | confirmar recepción inicial sin OS |

## 7. Requerimientos y casos

| Método | Ruta | Acción | Propósito |
|---|---|---|---|
| GET | `/requerimientos/operativos` | `requirements.catalog` | buscar/explorar activos operativos por tipo, serie o PPU |
| GET | `/requerimientos/buses` | `requirements.catalog` | autocomplete de buses con activos operativos |
| GET | `/requerimientos/intervenciones-activas` | `requirements.catalog` | comprobar duplicidad por tipo + serie |
| GET | `/requerimientos` | `requirements.read` | listar casos |
| GET | `/requerimientos/:id` | `requirements.read` | detalle de caso |
| POST | `/requerimientos` | `requirements.create` | crear caso + OS |
| POST | `/requerimientos/:id/pod` | `requirements.create` | registrar/actualizar clasificación PoD autorizada |

El servicio valida activo registrado, operación en bus, terminal/PST, intervención activa y referencia externa.

## 8. OS y Terreno

| Método | Ruta | Acción | Propósito |
|---|---|---|---|
| GET | `/os/activos-operativos` | `terrain.work` | activos operativos autorizados |
| GET | `/os/pendientes-retiro` | `terrain.assign.read` | retiros pendientes |
| POST | `/os/asignar-retiro` | `terrain.assign` | asignar técnico Terreno |
| POST | `/os/validar-identidad-retiro` | `terrain.work` | validar identidad física |
| POST | `/os/discrepancia-retiro` | `terrain.work` | registrar discrepancia |
| POST | `/os/confirmar-retiro` | `terrain.work` | confirmar retiro físico |
| GET | `/os` | `supervision.read` | consulta global autorizada |
| POST | `/os/crear` | `terrain.work` | reporte de falla desde Terreno |
| POST | `/os/completar-instalacion` | `terrain.work` | completar instalación asignada |
| GET | `/os/mis-ordenes` | `orders.read` + scope | órdenes del actor |
| GET | `/os/:id` | `orders.read` + scope | detalle autorizado |

## 9. Bodega / Logística

| Método | Ruta | Acción | Estado | Propósito |
|---|---|---|---|---|
| GET | `/bodega/inventario` | `warehouse.read` | Activa | parque/stock/disponibilidad |
| GET | `/bodega/despacho/destinos` | `warehouse.read` | Activa | contexto/destinos para instalación |
| POST | `/bodega/despacho/validar` | `warehouse.move` | Activa | validar identidad/elegibilidad |
| POST | `/bodega/despacho/confirmar` | `warehouse.move` | Activa | confirmar salida + crear IN |
| POST | `/bodega/recepcion-terreno/validar` | `warehouse.move` | Activa | evidencia recepción desde Terreno |
| GET | `/bodega/queue` | `warehouse.read` | Activa | cola de recepciones/despachos |
| GET | `/bodega/qa-users` | `users.manage` | Consulta | helper administrativo de cuentas QA |
| PUT | `/bodega/receive` | `warehouse.move` | Activa | confirmar recepción en Bodega |
| POST | `/bodega/dispatch-lab/validar` | `warehouse.move` | Activa | validar salida a Lab |
| PUT | `/bodega/dispatch-lab` | `warehouse.move` | Activa | confirmar salida a Lab |
| POST | `/bodega/dispatch-qa/validar` | `warehouse.move` | Activa | validar salida QA |
| PUT | `/bodega/dispatch-qa` | `warehouse.move` | Activa | confirmar salida QA |
| GET | `/bodega/stock` | `warehouse.read` | Activa | stock elegible |
| GET | `/bodega/repuestos` | `warehouse.read` | Activa | inventario de repuestos |
| PUT | `/bodega/solicitudes/:id/entregar` | `warehouse.move` | Activa | entregar repuesto y descontar stock |
| GET | `/bodega/tecnicos` | `warehouse.read` | Activa | técnicos Terreno disponibles |
| GET | `/bodega/dashboard` | `warehouse.read` | Activa | KPI logísticos |
| PUT | `/bodega/repuestos/:id/stock` | `warehouse.move` | Bloqueada 409 | sobrescritura directa de stock sin política |
| PUT | `/bodega/asignar` | `warehouse.move` | Retirada 410 | reemplazada por despacho Physical First |

## 10. Laboratorio

| Método | Ruta | Acción | Estado | Propósito |
|---|---|---|---|---|
| GET | `/lab/supervision` | `lab.supervise` | Consulta | KPI/carga/SLA |
| GET | `/lab/reception` | `lab.supervise` | Consulta | En camino/Recibidos/Incidencias/Historial |
| GET | `/lab/custody/:code` | `lab.custody` | Activa | contexto de custodia |
| POST | `/lab/custody/:code/RECEPCION/validar` | `lab.custody` | Activa | validar recepción |
| POST | `/lab/custody/:code/RECEPCION/confirmar` | `lab.custody` | Activa | confirmar recepción |
| POST | `/lab/custody/:code/SALIDA/validar` | `lab.custody` | Activa | validar salida |
| POST | `/lab/custody/:code/SALIDA/confirmar` | `lab.custody` | Activa | confirmar salida |
| GET | `/lab/technicians` | `lab.read` | Consulta | técnicos activos |
| PUT | `/lab/assign` | `lab.assign` | Activa | asignar/reasignar |
| GET | `/lab/queue/:type` | `lab.read` | Consulta | cola técnica por tipo |
| PUT | `/lab/move` | `lab.work` | Activa | transición técnica autorizada |
| GET | `/lab/work/:codigoOs` | `lab.work` + scope | Activa | cargar trabajo propio |
| PUT | `/lab/work/:codigoOs` | `lab.work` + scope | Activa | guardar avance |
| POST | `/lab/finish` | `lab.work` + scope | Activa | cierre técnico |
| POST | `/lab/request-part` | `lab.work` + scope | Activa | solicitar necesidad de repuesto |
| GET | `/lab/parts` | `warehouse.read` | Consulta | consulta logística; no habilita técnico Lab |
| GET | `/lab/completed` | `lab.read` | Consulta | completados |
| POST | `/lab/dispatch-qa` | `lab.custody` | Retirada 410 | salida directa a QA retirada; usar salida Lab→Bodega |

## 11. QA

| Método | Ruta | Acción | Estado | Propósito |
|---|---|---|---|---|
| GET | `/qa/dashboard` | `qa.read` | Activa | dashboard por etapas |
| GET | `/qa/queue` | `qa.read` | Activa | cola QA |
| GET | `/qa/incoming` | `qa.read` | Activa | entradas pendientes |
| GET | `/qa/:code/work` | `qa.read` | Activa | detalle/revisión |
| POST | `/qa/:code/:purpose/validar` | `qa.work` | Activa | validar evidencia física |
| POST | `/qa/:code/actions/:action` | `qa.work` | Activa | comando de recepción/Ambiente/pruebas/dictamen/salida |
| PUT | `/qa/assign` | `qa.work` | Retirada 410 | asignación administrativa retirada |
| POST | `/qa/start` | `qa.work` | Retirada 410 | flujo genérico retirado |
| POST | `/qa/process` | `qa.work` | Retirada 410 | flujo genérico retirado |

## 12. Bridge / historial

El router aplica autenticación + usuario PostgreSQL y permite lectura a roles autorizados. Para Técnico Terreno/Jefe Laboratorio, la consulta de historial usa una proyección técnica restringida.

| Método | Ruta | Estado | Propósito |
|---|---|---|---|
| GET | `/bridge/buscar` | Activa | buscar serie/OS/referencia |
| GET | `/bridge/activos/:tipo/:serie/historial` | Activa | historial completo o técnico según rol |
| GET | `/bridge` | Activa | listar correlaciones; requiere `bridge.read` |
| POST | `/bridge` | Activa | crear correlación; requiere `bridge.link` |

Cualquier URL operacional antigua que continúe debajo de `/bridge/*` cae en el handler final y devuelve **410 BRIDGE_CORRELATION_ONLY**.

## 13. Escaneo / resolución física

| Método | Ruta | Acción | Propósito |
|---|---|---|---|
| GET | `/equipment-scan/resolve` | `scan.read` | resolver serie/AMID/identificador |
| POST | `/equipment-scan/confirm` | `scan.validate` | confirmar captura autorizada según estación |

La ruta genérica de escaneo no sustituye los validadores de propósito específicos de Bodega/Lab/QA.

## 14. Dashboards, búsqueda y badges

| Método | Ruta | Guard | Propósito |
|---|---|---|---|
| GET | `/dashboard/executive` | `supervision.read` | dashboard ejecutivo |
| GET | `/dashboard/summary` | `supervision.read` | resumen operativo global |
| GET | `/dashboard/equipos-operativos` | `warehouse.read` | equipos en operación |
| GET | `/dashboard/global-search` | guard propio del router | búsqueda transversal |
| GET | `/dashboard/badges` | cualquier rol oficial autenticado | contadores Sidebar; Jefe Lab recibe proyección limitada |
| GET | `/admin/stats` | `supervision.read` | estadísticas de supervisión |
| GET | `/admin/dispatch-queue` | `supervision.read` | cola de consulta |
| POST | `/admin/dispatch` | `lab.custody` | **Retirada 410**; exige custodia explícita por equipo |

## 15. Maestros

| Método | Ruta | Guard | Propósito |
|---|---|---|---|
| GET | `/master/terminales` | cualquier rol oficial | terminales |
| GET | `/master/psts` | cualquier rol oficial | operadores PST |

## 16. Inteligencia operacional

| Método | Ruta | Acción | Propósito |
|---|---|---|---|
| GET | `/ai/predictive-report` | `supervision.read` | ejecutar analizador Python y retornar JSON |

El endpoint no modifica operación ni stock.

## 17. Health y documentación

- `GET /api/health` — health sin contrato de negocio.
- `/docs` — Swagger UI.

## 18. Códigos HTTP de dominio

| Código | Uso V2.0 |
|---:|---|
| 200/201 | operación/creación exitosa |
| 400 | payload malformado o validación básica |
| 401 | token/sesión inválida o ausente |
| 403 | rol/scope no autorizado |
| 404 | recurso inexistente |
| 409 | conflicto de estado, custodia, evidencia, stock o reintento |
| 410 | flujo retirado intencionalmente |
| 422 | regla de negocio/campo incompatible |
| 500 | fallo inesperado; no debe usarse para ocultar errores de dominio conocidos |
| 502 | respuesta inválida del analizador (`AI_INVALID_RESPONSE`) |
| 503 | autenticación o analizador no disponible (`AUTH_SERVICE_UNAVAILABLE` / `AI_SERVICE_UNAVAILABLE`) |
| 502 | respuesta inválida del analizador (`AI_INVALID_RESPONSE`) |
| 503 | autenticación o analizador no disponible (`AUTH_SERVICE_UNAVAILABLE` / `AI_SERVICE_UNAVAILABLE`) |

## 19. Idempotencia y concurrencia

Movimientos/entregas/cierres críticos revalidan contexto dentro de transacción. La implementación utiliza bloqueos, índices/firmas y evidencia del ciclo para distinguir:

- repetición compatible;
- duplicado ya aplicado;
- reintento con contexto distinto;
- evidencia antigua.

## 20. Trazabilidad documental

- requisitos: `01_Requerimientos/ERS_PMP_Suite_V2.0.md`;
- arquitectura: `Arquitectura_Integral_PMP_Suite_V2.0.md`;
- datos: `MODELO_DATOS_DICCIONARIO_V2.0.md`;
- pruebas: `08_Pruebas/MATRIZ_TRAZABILIDAD_V2.0.md`.
