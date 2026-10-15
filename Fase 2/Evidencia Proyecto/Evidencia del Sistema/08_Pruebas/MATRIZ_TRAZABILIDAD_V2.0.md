# Matriz de Trazabilidad Detallada — PMP Suite V2.0

**Versión:** V2.0  
**Actualización:** 14-10-2026  
**Fuente funcional:** `01_Requerimientos/ERS_PMP_Suite_V2.0.md`

## 1. Propósito

Relacionar **cada regla/requisito identificado en la ERS** con actor, prioridad, implementación, verificación y estado. Esta matriz evita que la trazabilidad quede solo a nivel de módulo.

## 2. Criterio de estado

- **Implementado / contrato vigente:** existe implementación o regla persistente coherente con el código actual.
- **Implementado; validación física pendiente:** existe software pero falta cerrar evidencia de hardware/dispositivo real.
- **Implementado; evidencia de rendimiento a repetir:** existe mecanismo, pero el cierre requiere una ejecución aislada reciente.
- **Implementado; hardening/verificación continua:** el control existe y debe seguir verificándose durante el cierre.

## 3. Matriz completa

### RN

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RN-01 | identidad física = `tipo_equipo + serie`. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-02 | validador 72… = CVB35 / Mikroelektronika. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-03 | validador 74…/75… = CVB45 / Mikroelektronika. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-04 | consola = N9715 / Waysion. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-05 | un prefijo de validador desconocido no se completa por inferencia. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-06 | validar/leer no cambia custodia. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-07 | recepción y salida son movimientos distintos. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-08 | una evidencia no se reutiliza entre propósitos/ciclos. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-09 | una OS conserva inmutable la identidad del activo. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-10 | Bridge no crea OS ni mueve stock. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-11 | la IN se crea al confirmar despacho Bodega→Terreno. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-12 | Admin no hereda permisos operacionales. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-13 | Gerente no realiza escrituras operacionales. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-14 | técnico trabaja únicamente recursos propios/asignados. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-15 | técnico Lab no administra inventario. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-16 | QA es autónomo respecto de Admin. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-17 | error de API no se presenta como cero/lista vacía. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-18 | relaciones conocidas serie/PPU/terminal/operador se autocompletan; ambigüedad se pregunta. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-19 | reingreso QA crea un nuevo ciclo físico; no hereda evidencia anterior. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |
| RN-20 | eventos históricos críticos son append-only. | Transversal | Crítica | Reglas compartidas + servicios de dominio | Suites Backend/E2E V2.0 | Implementado / contrato vigente |

### RF-AUT

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-AUT-001 | autenticar mediante Firebase Authentication. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |
| RF-AUT-002 | resolver identidad efectiva contra `pmp.usuarios`. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |
| RF-AUT-003 | bloquear usuario inexistente, inactivo o con conflicto UID/correo. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |
| RF-AUT-004 | ignorar claims del cliente como fuente de autorización. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |
| RF-AUT-005 | exponer `/api/auth/me` con identidad/rol efectivo. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |
| RF-AUT-006 | permitir al usuario cambiar su propia contraseña con reautenticación. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |
| RF-AUT-007 | permitir flujo de enlace de recuperación autorizado. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |
| RF-AUT-008 | invalidar contexto previo cuando cambia la identidad autenticada. | Todos | Crítica | auth.routes.js; firebaseAuth.js; ensureUser.js | auth.revocation.test.js; authorization.test.js | Implementado / contrato vigente |

### RF-USR

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-USR-001 | Admin lista usuarios. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-002 | Admin crea usuario con nombre, apellido, correo y rol oficial. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-003 | contraseña inicial es opcional; si se entrega, mínimo 8 caracteres. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-004 | crear identidad Firebase y vínculo PostgreSQL en el flujo autorizado. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-005 | Admin edita datos de otra cuenta. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-006 | Admin activa/desactiva cuentas autorizadas. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-007 | impedir desactivar el último Admin activo. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-008 | impedir que Admin cambie su propio rol desde gestión de usuarios. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-009 | impedir que Admin desactive su propia cuenta desde gestión administrativa. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-010 | generar enlace/reset o establecer contraseña mediante Firebase según endpoint. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |
| RF-USR-011 | no almacenar contraseñas en PostgreSQL. | Admin/usuario | Crítica | users.routes.js; admin.users.routes.js; userAdministration.js | authorization.test.js; roles_e2e.mjs | Implementado / contrato vigente |

### RF-MST

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-MST-001 | consultar terminales. | Roles autorizados | Alta | master.routes.js; terminal_pst; requirements.js | requirements.test.js; requirements_scenarios.mjs | Implementado / contrato vigente |
| RF-MST-002 | consultar PST/operadores. | Roles autorizados | Alta | master.routes.js; terminal_pst; requirements.js | requirements.test.js; requirements_scenarios.mjs | Implementado / contrato vigente |
| RF-MST-003 | validar relación terminal–PST. | Roles autorizados | Alta | master.routes.js; terminal_pst; requirements.js | requirements.test.js; requirements_scenarios.mjs | Implementado / contrato vigente |
| RF-MST-004 | mantener buses por PPU. | Roles autorizados | Alta | master.routes.js; terminal_pst; requirements.js | requirements.test.js; requirements_scenarios.mjs | Implementado / contrato vigente |
| RF-MST-005 | mostrar nombres de operador con formato visual sin alterar el valor persistido. | Roles autorizados | Alta | master.routes.js; terminal_pst; requirements.js | requirements.test.js; requirements_scenarios.mjs | Implementado / contrato vigente |
| RF-MST-006 | no eliminar duplicados maestros sin análisis/autorización. | Roles autorizados | Alta | master.routes.js; terminal_pst; requirements.js | requirements.test.js; requirements_scenarios.mjs | Implementado / contrato vigente |

### RF-ACT

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-ACT-001 | registrar Validador o Consola sin crear OS. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-002 | exigir serie, tipo, origen y fecha de ingreso. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-003 | derivar modelo/marca según identidad autoritativa. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-004 | registrar `ALTA_ACTIVO`. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-005 | impedir alta duplicada. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-006 | buscar activos registrados con estado derivado. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-007 | distinguir REGISTRADO, EN_OPERACION, DISPONIBLE_INSTALACION y estados logísticos. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-008 | recepción inicial requiere activo previamente registrado. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-009 | permitir evidencia SCANNER. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-010 | permitir MANUAL_AUTORIZADO solo a Logística con presencia física confirmada. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-011 | registrar `RECEPCION_INICIAL`. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-012 | registrar `HABILITADO_INSTALACION`. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-013 | recepción inicial no genera OS. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-014 | impedir recepción inicial si ya existe circuito operacional/OS. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |
| RF-ACT-015 | stock inicial solo es elegible si la evidencia sigue vigente. | Logística | Crítica | assets.routes.js; assetManagement.js; initialAssetStock.js; assetIdentity.js | equipment.scan.test.js; asset_management_scenarios.mjs | Implementado / contrato vigente |

### RF-REQ

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-REQ-001 | crear requerimiento solo sobre activo registrado. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-002 | requerimiento no crea/modifica maestro. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-003 | origen permitido ARANDA o INTERNO. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-004 | normalizar Aranda a `AR-<dígitos>`. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-005 | generar caso interno `INT-xxxxxx`. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-006 | clasificar MANTENCION o POD. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-007 | exigir bus real, terminal, operador, falla y fecha. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-008 | validar que activo esté en operación en el bus informado. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-009 | validar terminal/operador vigentes de la instalación. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-010 | impedir referencia externa duplicada. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-011 | impedir nueva intervención activa sobre mismo activo. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-012 | crear caso + OS en transacción. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-013 | correlacionar Aranda con OS PMP. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-014 | consultar caso por ID. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-015 | listar casos según permisos. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-016 | buscar activos operacionales con paginación. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-017 | buscar buses asociados a activos operacionales. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |
| RF-REQ-018 | registrar PoD asociado al caso/intervención cuando corresponda. | Logística | Crítica | requirements.routes.js; requirements.js; requirementSearch.js | requirements.test.js; requirements_flow_e2e.mjs | Implementado / contrato vigente |

### RF-OS

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-OS-001 | MV para mantenimiento de Validador. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-002 | MC para mantenimiento de Consola. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-003 | PDV para PoD Validador. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-004 | PDC para PoD Consola. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-005 | IN para instalación. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-006 | generación de código es backend/DB, no cliente. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-007 | identidad OS es inmutable. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-008 | relaciones `caso_id`, `os_origen`, `stock_origen_os/evento` son inmutables. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-009 | IN tiene correlativo independiente. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |
| RF-OS-010 | una reparación no se reutiliza para representar reemplazo. | Sistema/operación | Crítica | os.routes.js; osStateMachine.js; generar_id_os() | requirements_flow_e2e.mjs; equipment_scan_flow_e2e.mjs | Implementado / contrato vigente |

### RF-TER

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-TER-001 | listar activos operativos autorizados. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-002 | técnico reporta falla. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-003 | técnico consulta Mis OS. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-004 | Logística consulta pendientes de retiro. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-005 | Logística asigna retiro a técnico. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-006 | técnico valida identidad del equipo a retirar. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-007 | registrar discrepancia de identidad sin ocultarla. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-008 | confirmar retiro físico. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-009 | permitir evidencia fotográfica PoD según reglas. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-010 | retiro confirmado pasa a tránsito, no a Bodega recibida. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-011 | técnico completa instalación asignada. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-012 | instalación exitosa deja activo en operación. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |
| RF-TER-013 | historial Mobile expone solo proyección técnica permitida. | Logística/Técnico Terreno | Crítica | os.routes.js; terrainWithdrawal*.js; Mobile | withdrawal_camera_scenarios.mjs; terrain_warehouse_scenarios.mjs; operational-regression.test.mjs | Implementado / contrato vigente |

### RF-BOD

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-BOD-001 | mostrar cola de recepciones y despachos. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-002 | separar retiro pendiente de recepción confirmada. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-003 | validar recepción desde Terreno. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-004 | confirmar recepción física. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-005 | tránsito no se cuenta como custodia Bodega. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-006 | obtener destinos válidos de despacho. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-007 | dashboard de Bodega usa activos únicos. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-008 | badges usan la misma definición que la cola. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-009 | validar evidencia de salida Bodega→Lab. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-010 | confirmar salida Bodega→Lab. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-011 | tras salida, equipo queda En camino a Laboratorio. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-012 | equipo en tránsito no puede ser asignado en Lab. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |
| RF-BOD-013 | evidencia Bodega no sustituye recepción Lab. | Logística | Crítica | bodega.routes.js; warehouseReceipt/Dispatch/LabDispatch/Queue.js | logistics_inventory_e2e.mjs; terrain_warehouse_scenarios.mjs | Implementado / contrato vigente |

### RF-LAB

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-LAB-001 | bandeja separa En camino/Recibidos/Incidencias/Historial. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-002 | Jefe Lab valida recepción física. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-003 | Jefe Lab confirma recepción. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-004 | recepción inicia SLA del ciclo vigente. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-005 | relecturas del mismo ciclo no reinician SLA. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-006 | Jefe Lab consulta técnicos activos. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-007 | Jefe Lab asigna/reasigna. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-008 | asignación no cambia custodia. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-009 | Jefe Lab visualiza carga por técnico. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-010 | Admin/Gerente solo consultan proyección autorizada. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-011 | Jefe Lab valida salida hacia Bodega. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-012 | Jefe Lab confirma salida. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |
| RF-LAB-013 | cierre técnico no confirma salida. | Jefe Laboratorio | Crítica | lab.routes.js; labCustody.js; labArrival.js; labReceptionRead.js; labSupervision.js | admin-lab.test.js; admin_lab_e2e.mjs | Implementado / contrato vigente |

### RF-LTW

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-LTW-001 | técnico solo abre OS asignada. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-002 | trabajo requiere recepción física vigente. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-003 | iniciar trabajo cambia Diagnóstico→Reparación. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-004 | guardar avance no cambia estado ni stock. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-005 | controlar revisión para evitar sobrescritura concurrente. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-006 | diagnóstico: CONFIRMADA/DIFERENTE/NFF/POD/OTRO. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-007 | registrar falla real y observación según diagnóstico. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-008 | registrar intervenciones. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-009 | métodos de prueba autorizados: Manual y Test MK. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-010 | cada prueba registra resultado/observación. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-011 | cierre exige pruebas aprobadas. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-012 | resultado final: REPARADO/NFF/POD según reglas de cierre. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-013 | registrar `registro_reparaciones`. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-014 | registrar eventos de diagnóstico/finalización. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-015 | resultado POD exige consistencia diagnóstico/resultado. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-016 | técnico no envía ID/cantidad de stock. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-017 | solicitud de repuesto requiere condición PoD documentada. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-018 | solicitud describe necesidad y motivo. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-019 | OS pasa a espera de repuesto mientras solicitud está pendiente. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-020 | no cerrar con solicitud de Bodega pendiente. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |
| RF-LTW-021 | antecedentes de rechazo QA deben estar visibles en nuevo ciclo. | Técnico Laboratorio | Crítica | lab.routes.js; labWork.js | lab.work.test.js; lab_work_scenarios.mjs | Implementado / contrato vigente |

### RF-REP

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-REP-001 | Logística consulta repuestos/stock. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-002 | stock crítico se expone para alerta. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-003 | Logística entrega una solicitud pendiente. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-004 | validar categoría del repuesto contra tipo de equipo. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-005 | validar stock disponible. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-006 | descontar stock de forma transaccional. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-007 | entrega es idempotente para misma pieza/cantidad/usuario. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-008 | registrar `LOGISTICA_ENTREGA_REPUESTO`. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |
| RF-REP-009 | impedir sobrescritura directa de stock sin política de ajuste. | Logística/Técnico Lab | Crítica | warehouseParts.js; labWork.js; bodega.routes.js | lab.work.test.js; logistics_inventory_e2e.mjs | Implementado / contrato vigente |

### RF-QA

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-QA-001 | Bodega valida despacho a QA. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-002 | Bodega confirma salida a QA. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-003 | QA muestra dashboard/cola/incoming. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-004 | QA valida recepción. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-005 | QA confirma recepción. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-006 | QA inicia/toma su trabajo sin asignación Admin. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-007 | registrar etapa Instalación Ambiente. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-008 | registrar pruebas. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-009 | guardar avances con revisión. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-010 | dictamen OPERATIVO o RECHAZADO. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-011 | rechazo exige motivo. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-012 | dictamen no confirma salida. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-013 | QA valida salida. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-014 | QA confirma salida. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-015 | Bodega debe confirmar recepción posterior. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-016 | Operativo queda elegible después de recepción Bodega. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-017 | Rechazado vuelve a circuito de corrección con contexto. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |
| RF-QA-018 | endpoints legacy de asignación/proceso responden 410. | QA/Logística | Crítica | qa.routes.js; qaCustody.js; qaWork.js | qa.work.test.js; qa_custody_scenarios.mjs | Implementado / contrato vigente |

### RF-INV

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-INV-001 | inventario representa parque global. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-002 | distinguir stock físico de parque global. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-003 | distinguir disponible/no disponible. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-004 | stock inicial y reparado tienen orígenes distintos. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-005 | un activo con intervención activa no es elegible. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-006 | validar contexto de nueva instalación o reemplazo. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-007 | validar identidad física del activo seleccionado. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-008 | permitir MANUAL_AUTORIZADO con motivo/presencia física. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-009 | confirmar despacho en transacción. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-010 | crear IN + evento SALIDA_BODEGA_TERRENO de forma atómica. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-011 | impedir reutilizar la misma evidencia con contexto distinto. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |
| RF-INV-012 | impedir doble consumo de stock origen. | Logística | Crítica | logisticsInventory.js; warehouseDispatch.js; initialAssetStock.js | logistics_inventory_e2e.mjs; initial_installation_empty_e2e.mjs | Implementado / contrato vigente |

### RF-BRG

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-BRG-001 | buscar por referencia, serie u OS. | Logística/consulta | Alta | bridge.routes.js; assetHistory.js | bridge.flow.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-BRG-002 | crear correlación solo por Logística. | Logística/consulta | Alta | bridge.routes.js; assetHistory.js | bridge.flow.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-BRG-003 | correlación debe coincidir con tipo/serie de OS. | Logística/consulta | Alta | bridge.routes.js; assetHistory.js | bridge.flow.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-BRG-004 | correlaciones son inmutables. | Logística/consulta | Alta | bridge.routes.js; assetHistory.js | bridge.flow.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-BRG-005 | no exponer Bridge como flujo operacional. | Logística/consulta | Alta | bridge.routes.js; assetHistory.js | bridge.flow.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |

### RF-TRZ

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-TRZ-001 | historial agrupa OS por tipo+serie. | Roles autorizados | Alta | assetHistory.js; technicalAssetHistory.js; dashboard search | technical-history.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-TRZ-002 | incluir referencias externas. | Roles autorizados | Alta | assetHistory.js; technicalAssetHistory.js; dashboard search | technical-history.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-TRZ-003 | incluir eventos físicos/técnicos. | Roles autorizados | Alta | assetHistory.js; technicalAssetHistory.js; dashboard search | technical-history.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-TRZ-004 | mantener historial de cambios de OS. | Roles autorizados | Alta | assetHistory.js; technicalAssetHistory.js; dashboard search | technical-history.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-TRZ-005 | Técnico Terreno y Jefe de Laboratorio reciben proyección técnica restringida desde la API, sin auditoría administrativa ni metadatos restringidos. | Roles autorizados | Alta | assetHistory.js; technicalAssetHistory.js; dashboard search | technical-history.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |
| RF-TRZ-006 | búsquedas globales respetan RBAC. | Roles autorizados | Alta | assetHistory.js; technicalAssetHistory.js; dashboard search | technical-history.test.js; bridge_correlation_e2e.mjs | Implementado / contrato vigente |

### RF-DASH

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-DASH-001 | dashboard ejecutivo para Admin/Gerente. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-002 | parque total sin doble conteo. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-003 | distribución por etapa/custodia. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-004 | órdenes activas separadas de parque. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-005 | dashboard Bodega. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-006 | dashboard Lab: camino/recibidos/carga/SLA/listos. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-007 | dashboard QA por etapa. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-008 | badges coherentes con colas. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-009 | Admin, Gerente y Jefe de Laboratorio consultan reportes Lab según permisos. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |
| RF-DASH-010 | cero real ≠ error ≠ sin medición. | Admin/Gerente/Jefaturas | Alta | dashboard.routes.js; executiveDashboard.js; labSupervision.js; bodega/qa dashboard | admin_lab_e2e.mjs; navigation_kpi_e2e.mjs; frontend KPI tests | Implementado / contrato vigente |

### RF-IA

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-IA-001 | ejecutar analizador Python bajo demanda. | Admin/Gerente/Jefe de Laboratorio/Logística | Media | authorization.js; ai.routes.js; 06_ModelosIA/src/analyzer.py | endpoint/JSON smoke + documentación de método | Implementado / contrato vigente |
| RF-IA-002 | consultar PostgreSQL en modo lectura. | Admin/Gerente/Jefe de Laboratorio/Logística | Media | authorization.js; ai.routes.js; 06_ModelosIA/src/analyzer.py | endpoint/JSON smoke + documentación de método | Implementado / contrato vigente |
| RF-IA-003 | producir JSON válido. | Admin/Gerente/Jefe de Laboratorio/Logística | Media | authorization.js; ai.routes.js; 06_ModelosIA/src/analyzer.py | endpoint/JSON smoke + documentación de método | Implementado / contrato vigente |
| RF-IA-004 | Admin, Gerente, Jefe de Laboratorio y Logística consultan inteligencia operacional mediante ai.read; los demás roles son rechazados. El reporte es heurístico, no un modelo entrenado. | Admin/Gerente/Jefe de Laboratorio/Logística | Media | authorization.js; ai.routes.js; 06_ModelosIA/src/analyzer.py | endpoint/JSON smoke + documentación de método | Implementado / contrato vigente |
| RF-IA-005 | score de reincidencia no modifica operación. | Admin/Gerente/Jefe de Laboratorio/Logística | Media | authorization.js; ai.routes.js; 06_ModelosIA/src/analyzer.py | endpoint/JSON smoke + documentación de método | Implementado / contrato vigente |
| RF-IA-006 | interfaz identifica correctamente el método heurístico. | Admin/Gerente/Jefe de Laboratorio/Logística | Media | authorization.js; ai.routes.js; 06_ModelosIA/src/analyzer.py | endpoint/JSON smoke + documentación de método | Implementado / contrato vigente |
| RF-IA-007 | no presentar precisión/recall inexistente. | Admin/Gerente/Jefe de Laboratorio/Logística | Media | authorization.js; ai.routes.js; 06_ModelosIA/src/analyzer.py | endpoint/JSON smoke + documentación de método | Implementado / contrato vigente |

### RF-UX

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-UX-001 | navegación derivada de capacidades. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado / contrato vigente |
| RF-UX-002 | acceso directo a ruta debe respetar permiso. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado / contrato vigente |
| RF-UX-003 | temas Claro/Oscuro; Mobile también Automático. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado / contrato vigente |
| RF-UX-004 | preferencia visual persistente. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado / contrato vigente |
| RF-UX-005 | feedback inline para procesos. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado / contrato vigente |
| RF-UX-006 | evitar modales operacionales salvo controles nativos. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado / contrato vigente |
| RF-UX-007 | responsive sin overflow horizontal accidental. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado / contrato vigente |
| RF-UX-008 | objetivos táctiles Mobile adecuados. | Todos | Alta | Web pages/components/styles; rbac.ts; navigation.ts | ui-system.frontend.test.mjs; ux-suite.browser.mjs; roles.browser.mjs | Implementado; validación física pendiente |

### RF-MOB

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-MOB-001 | Mobile permite login. | Técnico Terreno/usuario | Alta | 07_Mobile/src/screens; services/api.js; Appearance/Auth contexts | operational-regression.test.mjs; settings.test.mjs; ui.test.mjs; visual.browser.mjs | Implementado / contrato vigente |
| RF-MOB-002 | Mobile muestra jornada/OS propias. | Técnico Terreno/usuario | Alta | 07_Mobile/src/screens; services/api.js; Appearance/Auth contexts | operational-regression.test.mjs; settings.test.mjs; ui.test.mjs; visual.browser.mjs | Implementado; validación física pendiente |
| RF-MOB-003 | Mobile reporta falla. | Técnico Terreno/usuario | Alta | 07_Mobile/src/screens; services/api.js; Appearance/Auth contexts | operational-regression.test.mjs; settings.test.mjs; ui.test.mjs; visual.browser.mjs | Implementado / contrato vigente |
| RF-MOB-004 | Mobile ejecuta retiro físico. | Técnico Terreno/usuario | Alta | 07_Mobile/src/screens; services/api.js; Appearance/Auth contexts | operational-regression.test.mjs; settings.test.mjs; ui.test.mjs; visual.browser.mjs | Implementado; validación física pendiente |
| RF-MOB-005 | Mobile completa instalación. | Técnico Terreno/usuario | Alta | 07_Mobile/src/screens; services/api.js; Appearance/Auth contexts | operational-regression.test.mjs; settings.test.mjs; ui.test.mjs; visual.browser.mjs | Implementado; validación física pendiente |
| RF-MOB-006 | Mobile consulta historial técnico. | Técnico Terreno/usuario | Alta | 07_Mobile/src/screens; services/api.js; Appearance/Auth contexts | operational-regression.test.mjs; settings.test.mjs; ui.test.mjs; visual.browser.mjs | Implementado; validación física pendiente |
| RF-MOB-007 | Mobile permite perfil/seguridad/apariencia. | Técnico Terreno/usuario | Alta | 07_Mobile/src/screens; services/api.js; Appearance/Auth contexts | operational-regression.test.mjs; settings.test.mjs; ui.test.mjs; visual.browser.mjs | Implementado; validación física pendiente |

### RNF-SEC

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RNF-SEC-001 | toda ruta protegida valida Firebase + usuario PostgreSQL. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |
| RNF-SEC-002 | denegación por defecto en acciones sensibles. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |
| RNF-SEC-003 | tokens/contraseñas no se registran en logs. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |
| RNF-SEC-004 | secretos fuera del repositorio. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |
| RNF-SEC-005 | autorización de frontend no reemplaza backend. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |
| RNF-SEC-006 | mutaciones sensibles auditables. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |
| RNF-SEC-007 | payloads de fotografías se procesan después de autenticación/RBAC. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |
| RNF-SEC-008 | último Admin protegido. | Transversal | Crítica | middleware; authorization.js; userAdministration.js; .gitignore | authorization.test.js; auth.revocation.test.js; roles_e2e.mjs | Implementado; hardening/verificación continua |

### RNF-DAT

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RNF-DAT-001 | transacciones en movimientos críticos. | Transversal | Crítica | PostgreSQL constraints/triggers; services transaccionales | database-tools.test.js; E2E PostgreSQL efímero | Implementado / contrato vigente |
| RNF-DAT-002 | identidad OS inmutable. | Transversal | Crítica | PostgreSQL constraints/triggers; services transaccionales | database-tools.test.js; E2E PostgreSQL efímero | Implementado / contrato vigente |
| RNF-DAT-003 | historial crítico append-only. | Transversal | Crítica | PostgreSQL constraints/triggers; services transaccionales | database-tools.test.js; E2E PostgreSQL efímero | Implementado / contrato vigente |
| RNF-DAT-004 | evidencia debe corresponder a estación/propósito/ciclo. | Transversal | Crítica | PostgreSQL constraints/triggers; services transaccionales | database-tools.test.js; E2E PostgreSQL efímero | Implementado / contrato vigente |
| RNF-DAT-005 | operaciones repetidas compatibles deben ser idempotentes. | Transversal | Crítica | PostgreSQL constraints/triggers; services transaccionales | database-tools.test.js; E2E PostgreSQL efímero | Implementado / contrato vigente |
| RNF-DAT-006 | conflicto de reintento incompatible devuelve 409. | Transversal | Crítica | PostgreSQL constraints/triggers; services transaccionales | database-tools.test.js; E2E PostgreSQL efímero | Implementado / contrato vigente |
| RNF-DAT-007 | FKs/checks refuerzan reglas de dominio. | Transversal | Crítica | PostgreSQL constraints/triggers; services transaccionales | database-tools.test.js; E2E PostgreSQL efímero | Implementado / contrato vigente |

### RNF-PER

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RNF-PER-001 | listados operacionales usan paginación/límites. | Transversal | Media | índices; paginación; consultas acotadas | performance_isolated.mjs + revisión de cierre | Implementado; evidencia de rendimiento a repetir |
| RNF-PER-002 | búsquedas no retornan conjuntos ilimitados. | Transversal | Media | índices; paginación; consultas acotadas | performance_isolated.mjs + revisión de cierre | Implementado; evidencia de rendimiento a repetir |
| RNF-PER-003 | índices soportan serie, OS, referencias, eventos y evidencia. | Transversal | Media | índices; paginación; consultas acotadas | performance_isolated.mjs + revisión de cierre | Implementado; evidencia de rendimiento a repetir |
| RNF-PER-004 | pruebas de carga se ejecutan en entorno aislado. | Transversal | Media | índices; paginación; consultas acotadas | performance_isolated.mjs + revisión de cierre | Implementado; evidencia de rendimiento a repetir |

### RNF-REL

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RNF-REL-001 | errores controlados usan códigos HTTP coherentes. | Transversal | Alta | errores de dominio; transacciones; idempotencia | unitarias + E2E negativos | Implementado / contrato vigente |
| RNF-REL-002 | 401/403/409/422 se distinguen de 500. | Transversal | Alta | errores de dominio; transacciones; idempotencia | unitarias + E2E negativos | Implementado / contrato vigente |
| RNF-REL-003 | errores no se transforman silenciosamente en datos vacíos. | Transversal | Alta | errores de dominio; transacciones; idempotencia | unitarias + E2E negativos | Implementado / contrato vigente |
| RNF-REL-004 | base habitual no debe ser alterada por pruebas destructivas. | Transversal | Alta | errores de dominio; transacciones; idempotencia | unitarias + E2E negativos | Implementado / contrato vigente |

### RNF-UX

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RNF-UX-001 | texto+icono+color para estados relevantes. | Todos | Alta | tokens/componentes; responsive; temas | all-pages.browser.mjs; ux-suite.browser.mjs; Mobile visual | Implementado / contrato vigente |
| RNF-UX-002 | foco visible. | Todos | Alta | tokens/componentes; responsive; temas | all-pages.browser.mjs; ux-suite.browser.mjs; Mobile visual | Implementado / contrato vigente |
| RNF-UX-003 | etiquetas comprensibles por proceso. | Todos | Alta | tokens/componentes; responsive; temas | all-pages.browser.mjs; ux-suite.browser.mjs; Mobile visual | Implementado / contrato vigente |
| RNF-UX-004 | semántica verde/ámbar/rojo/azul/gris consistente. | Todos | Alta | tokens/componentes; responsive; temas | all-pages.browser.mjs; ux-suite.browser.mjs; Mobile visual | Implementado / contrato vigente |
| RNF-UX-005 | campos derivados readonly. | Todos | Alta | tokens/componentes; responsive; temas | all-pages.browser.mjs; ux-suite.browser.mjs; Mobile visual | Implementado / contrato vigente |
| RNF-UX-006 | no pedir datos que el sistema ya conoce. | Todos | Alta | tokens/componentes; responsive; temas | all-pages.browser.mjs; ux-suite.browser.mjs; Mobile visual | Implementado / contrato vigente |

### RNF-MAN

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RNF-MAN-001 | reglas de rol centralizadas. | Equipo desarrollo | Alta | servicios por dominio; shared; documentación V2.0 | build + suites + revisión documental | Implementado / contrato vigente |
| RNF-MAN-002 | identidad de activos compartida. | Equipo desarrollo | Alta | servicios por dominio; shared; documentación V2.0 | build + suites + revisión documental | Implementado / contrato vigente |
| RNF-MAN-003 | servicios de dominio separados de rutas. | Equipo desarrollo | Alta | servicios por dominio; shared; documentación V2.0 | build + suites + revisión documental | Implementado / contrato vigente |
| RNF-MAN-004 | documentación V2.0 debe actualizarse junto al contrato funcional. | Equipo desarrollo | Alta | servicios por dominio; shared; documentación V2.0 | build + suites + revisión documental | Implementado / contrato vigente |
| RNF-MAN-005 | migraciones aditivas preservan historia. | Equipo desarrollo | Alta | servicios por dominio; shared; documentación V2.0 | build + suites + revisión documental | Implementado / contrato vigente |

### RNF-COM

| ID | Requisito | Actor | Prioridad | Implementación principal | Verificación / evidencia | Estado |
|---|---|---|---|---|---|---|
| RNF-COM-001 | Web compatible con navegador moderno. | Equipo desarrollo | Media | Vite/Node/PostgreSQL/Expo/Firebase/Python | build/export/smoke; dispositivo físico pendiente donde aplica | Implementado / contrato vigente |
| RNF-COM-002 | Mobile basado en Expo SDK 57. | Equipo desarrollo | Media | Vite/Node/PostgreSQL/Expo/Firebase/Python | build/export/smoke; dispositivo físico pendiente donde aplica | Implementado / contrato vigente |
| RNF-COM-003 | PostgreSQL como persistencia principal. | Equipo desarrollo | Media | Vite/Node/PostgreSQL/Expo/Firebase/Python | build/export/smoke; dispositivo físico pendiente donde aplica | Implementado / contrato vigente |
| RNF-COM-004 | entorno local soporta Windows; Ubuntu/Nginx/PM2 es proyección servidor. | Equipo desarrollo | Media | Vite/Node/PostgreSQL/Expo/Firebase/Python | build/export/smoke; dispositivo físico pendiente donde aplica | Implementado; validación física pendiente |

## 4. Reglas críticas con evidencia de cierre

| Regla | Implementación | Evidencia esperada |
|---|---|---|
| tipo+serie inmutable | assetIdentity + constraints/triggers | identidad incompatible rechazada |
| validar ≠ confirmar | custody/dispatch services | validación no modifica custodia |
| evidencia por ciclo | metadata + servicios de evidencia | evidencia vieja/otra estación rechazada |
| Admin sin wildcard | authorization.js | mutaciones operacionales 403 |
| Gerente read-only | authorization.js + enforceReadOnlyRole | escritura 403 |
| Jefe Lab limitado a Lab | POLICY + rutas | Bodega/QA/Terreno 403 |
| técnico carga propia | permits(resource) | OS ajena 403 |
| Bridge correlación-only | bridge.routes.js | operación antigua 410 |
| IN en despacho | warehouseDispatch.js | selección/lectura no crea IN |
| stock inicial sin OS | initialAssetStock.js | cero OS hasta despacho |
| repuesto por Bodega | warehouseParts.js | stock baja en entrega, no en cierre técnico |
| QA autónomo | qaWork.js | assign/start/process legacy 410 |
| dictamen ≠ salida | qaWork + qaCustody | custodia QA se conserva hasta salida |

## 5. Estado de validación

Los resultados actuales, las limitaciones y las condiciones de cierre se mantienen únicamente en [Estado y pendientes](../Documentacion%20Capstone/ESTADO_Y_PENDIENTES.md). Esta matriz identifica pruebas y contratos; “implementado” no equivale a aceptación real.

## 6. Regla de mantenimiento

Todo cambio de requisito debe actualizar simultáneamente ERS, esta matriz, código/BD correspondiente y evidencia de prueba.

## Conciliación documental del 14 de octubre de 2026

RF-IA-004, RF-TRZ-005 y RF-DASH-009 se sincronizan con las observaciones del 13-10 de la matriz Excel. La [ERS](../01_Requerimientos/ERS_PMP_Suite_V2.0.md) explica las diferencias basales y la extensión de reportes; no se modifican permisos, IDs ni funcionalidad. Las pruebas de Excel y Centro de reportes están en `04_Frontend/test/excel-report.frontend.test.mjs` y `04_Frontend/test/reports-center.frontend.test.mjs`.
