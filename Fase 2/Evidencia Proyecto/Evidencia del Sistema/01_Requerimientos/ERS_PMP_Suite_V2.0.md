# Especificación de Requisitos de Software — PMP Suite V2.0

Esta copia conserva documentación vigente y pruebas reutilizables. Los informes de ejecución, capturas y resultados históricos citados permanecen únicamente en el archivo original Tesis; no se incluyen ni acreditan una nueva ejecución en PMP_Suite_V2.0. Las comprobaciones de esta copia y sus pendientes se describen en el README principal.


**Versión:** V2.0  
**Estado:** vigente  
**Actualización:** 09-10-2026

## 1. Propósito

Definir el contrato funcional y no funcional vigente de PMP Suite. La versión V2.0 describe el sistema realmente implementado y validado en código, evitando mezclar flujos históricos retirados.

PMP Suite centraliza el ciclo de vida de validadores y consolas desde su registro inicial, instalación, operación, reporte de falla, retiro, recepción en Bodega, Laboratorio, QA, retorno a stock y nueva instalación.

## 2. Alcance

### Incluido

- autenticación y administración de usuarios;
- RBAC de siete roles;
- maestros operacionales;
- gestión de activos;
- recepción inicial sin OS;
- requerimientos/casos;
- OS MV/MC/PDV/PDC/IN;
- Terreno;
- Bodega/Logística;
- Laboratorio;
- QA;
- repuestos/stock;
- Bridge/referencias externas;
- trazabilidad por activo;
- dashboards y reportes;
- Mobile;
- analítica de reincidencia;
- temas claro/oscuro y UX responsive.

### Fuera de alcance actual

- integración automática con Aranda;
- decisión automática de reparación/baja mediante IA;
- despliegue productivo certificado;
- modificación de roles/catálogos mediante un motor dinámico de reglas.

## 3. Definiciones

| Término | Definición |
|---|---|
| Activo | equipo físico identificado por tipo + serie |
| Caso | necesidad operacional que puede agrupar varias intervenciones |
| OS | intervención concreta sobre un activo |
| Bridge | correlación entre PMP y una referencia externa |
| IN | OS de instalación creada al confirmar salida Bodega→Terreno |
| Physical First | principio que separa validar identidad de confirmar movimiento |
| Custodia | área que posee físicamente el equipo según evidencia vigente |
| PoD | pérdida/daño atribuible a tercero |
| NFF | no fault found / sin falla encontrada |
| SLA Lab | tiempo medido desde recepción física vigente de Laboratorio |
| Evidencia | escaneo o validación manual autorizada asociada a un propósito/ciclo |

## 4. Actores

| Rol | Responsabilidad |
|---|---|
| admin | usuarios, roles, seguridad y supervisión |
| gerente | lectura ejecutiva |
| jefe_laboratorio | recepción, asignación, supervisión y salida Lab |
| logistica | Bodega, inventario, repuestos, retiros y despachos |
| qa | recepción QA, Ambiente, pruebas, dictamen y salida |
| tecnico_laboratorio | diagnóstico, intervención y pruebas de su carga |
| tecnico_terreno | fallas, retiros e instalaciones asignadas |

## 5. Reglas de negocio transversales

- **RN-01:** identidad física = `tipo_equipo + serie`.
- **RN-02:** validador 72… = CVB35 / Mikroelektronika.
- **RN-03:** validador 74…/75… = CVB45 / Mikroelektronika.
- **RN-04:** consola = N9715 / Waysion.
- **RN-05:** un prefijo de validador desconocido no se completa por inferencia.
- **RN-06:** validar/leer no cambia custodia.
- **RN-07:** recepción y salida son movimientos distintos.
- **RN-08:** una evidencia no se reutiliza entre propósitos/ciclos.
- **RN-09:** una OS conserva inmutable la identidad del activo.
- **RN-10:** Bridge no crea OS ni mueve stock.
- **RN-11:** la IN se crea al confirmar despacho Bodega→Terreno.
- **RN-12:** Admin no hereda permisos operacionales.
- **RN-13:** Gerente no realiza escrituras operacionales.
- **RN-14:** técnico trabaja únicamente recursos propios/asignados.
- **RN-15:** técnico Lab no administra inventario.
- **RN-16:** QA es autónomo respecto de Admin.
- **RN-17:** error de API no se presenta como cero/lista vacía.
- **RN-18:** relaciones conocidas serie/PPU/terminal/operador se autocompletan; ambigüedad se pregunta.
- **RN-19:** reingreso QA crea un nuevo ciclo físico; no hereda evidencia anterior.
- **RN-20:** eventos históricos críticos son append-only.

# 6. Requisitos funcionales

## 6.1 Autenticación y sesión

- **RF-AUT-001:** autenticar mediante Firebase Authentication.
- **RF-AUT-002:** resolver identidad efectiva contra `pmp.usuarios`.
- **RF-AUT-003:** bloquear usuario inexistente, inactivo o con conflicto UID/correo.
- **RF-AUT-004:** ignorar claims del cliente como fuente de autorización.
- **RF-AUT-005:** exponer `/api/auth/me` con identidad/rol efectivo.
- **RF-AUT-006:** permitir al usuario cambiar su propia contraseña con reautenticación.
- **RF-AUT-007:** permitir flujo de enlace de recuperación autorizado.
- **RF-AUT-008:** invalidar contexto previo cuando cambia la identidad autenticada.

## 6.2 Administración de usuarios

- **RF-USR-001:** Admin lista usuarios.
- **RF-USR-002:** Admin crea usuario con nombre, apellido, correo y rol oficial.
- **RF-USR-003:** contraseña inicial es opcional; si se entrega, mínimo 8 caracteres.
- **RF-USR-004:** crear identidad Firebase y vínculo PostgreSQL en el flujo autorizado.
- **RF-USR-005:** Admin edita datos de otra cuenta.
- **RF-USR-006:** Admin activa/desactiva cuentas autorizadas.
- **RF-USR-007:** impedir desactivar el último Admin activo.
- **RF-USR-008:** impedir que Admin cambie su propio rol desde gestión de usuarios.
- **RF-USR-009:** impedir que Admin desactive su propia cuenta desde gestión administrativa.
- **RF-USR-010:** generar enlace/reset o establecer contraseña mediante Firebase según endpoint.
- **RF-USR-011:** no almacenar contraseñas en PostgreSQL.

## 6.3 Maestros y relaciones

- **RF-MST-001:** consultar terminales.
- **RF-MST-002:** consultar PST/operadores.
- **RF-MST-003:** validar relación terminal–PST.
- **RF-MST-004:** mantener buses por PPU.
- **RF-MST-005:** mostrar nombres de operador con formato visual sin alterar el valor persistido.
- **RF-MST-006:** no eliminar duplicados maestros sin análisis/autorización.

## 6.4 Gestión de activos

- **RF-ACT-001:** registrar Validador o Consola sin crear OS.
- **RF-ACT-002:** exigir serie, tipo, origen y fecha de ingreso.
- **RF-ACT-003:** derivar modelo/marca según identidad autoritativa.
- **RF-ACT-004:** registrar `ALTA_ACTIVO`.
- **RF-ACT-005:** impedir alta duplicada.
- **RF-ACT-006:** buscar activos registrados con estado derivado.
- **RF-ACT-007:** distinguir REGISTRADO, EN_OPERACION, DISPONIBLE_INSTALACION y estados logísticos.
- **RF-ACT-008:** recepción inicial requiere activo previamente registrado.
- **RF-ACT-009:** permitir evidencia SCANNER.
- **RF-ACT-010:** permitir MANUAL_AUTORIZADO solo a Logística con presencia física confirmada.
- **RF-ACT-011:** registrar `RECEPCION_INICIAL`.
- **RF-ACT-012:** registrar `HABILITADO_INSTALACION`.
- **RF-ACT-013:** recepción inicial no genera OS.
- **RF-ACT-014:** impedir recepción inicial si ya existe circuito operacional/OS.
- **RF-ACT-015:** stock inicial solo es elegible si la evidencia sigue vigente.

## 6.5 Requerimientos y casos

- **RF-REQ-001:** crear requerimiento solo sobre activo registrado.
- **RF-REQ-002:** requerimiento no crea/modifica maestro.
- **RF-REQ-003:** origen permitido ARANDA o INTERNO.
- **RF-REQ-004:** normalizar Aranda a `AR-<dígitos>`.
- **RF-REQ-005:** generar caso interno `INT-xxxxxx`.
- **RF-REQ-006:** clasificar MANTENCION o POD.
- **RF-REQ-007:** exigir bus real, terminal, operador, falla y fecha.
- **RF-REQ-008:** validar que activo esté en operación en el bus informado.
- **RF-REQ-009:** validar terminal/operador vigentes de la instalación.
- **RF-REQ-010:** impedir referencia externa duplicada.
- **RF-REQ-011:** impedir nueva intervención activa sobre mismo activo.
- **RF-REQ-012:** crear caso + OS en transacción.
- **RF-REQ-013:** correlacionar Aranda con OS PMP.
- **RF-REQ-014:** consultar caso por ID.
- **RF-REQ-015:** listar casos según permisos.
- **RF-REQ-016:** buscar activos operacionales con paginación.
- **RF-REQ-017:** buscar buses asociados a activos operacionales.
- **RF-REQ-018:** registrar PoD asociado al caso/intervención cuando corresponda.

## 6.6 Nomenclatura OS

- **RF-OS-001:** MV para mantenimiento de Validador.
- **RF-OS-002:** MC para mantenimiento de Consola.
- **RF-OS-003:** PDV para PoD Validador.
- **RF-OS-004:** PDC para PoD Consola.
- **RF-OS-005:** IN para instalación.
- **RF-OS-006:** generación de código es backend/DB, no cliente.
- **RF-OS-007:** identidad OS es inmutable.
- **RF-OS-008:** relaciones `caso_id`, `os_origen`, `stock_origen_os/evento` son inmutables.
- **RF-OS-009:** IN tiene correlativo independiente.
- **RF-OS-010:** una reparación no se reutiliza para representar reemplazo.

## 6.7 Terreno

- **RF-TER-001:** listar activos operativos autorizados.
- **RF-TER-002:** técnico reporta falla.
- **RF-TER-003:** técnico consulta Mis OS.
- **RF-TER-004:** Logística consulta pendientes de retiro.
- **RF-TER-005:** Logística asigna retiro a técnico.
- **RF-TER-006:** técnico valida identidad del equipo a retirar.
- **RF-TER-007:** registrar discrepancia de identidad sin ocultarla.
- **RF-TER-008:** confirmar retiro físico.
- **RF-TER-009:** permitir evidencia fotográfica PoD según reglas.
- **RF-TER-010:** retiro confirmado pasa a tránsito, no a Bodega recibida.
- **RF-TER-011:** técnico completa instalación asignada.
- **RF-TER-012:** instalación exitosa deja activo en operación.
- **RF-TER-013:** historial Mobile expone solo proyección técnica permitida.

## 6.8 Bodega — recepción y cola

- **RF-BOD-001:** mostrar cola de recepciones y despachos.
- **RF-BOD-002:** separar retiro pendiente de recepción confirmada.
- **RF-BOD-003:** validar recepción desde Terreno.
- **RF-BOD-004:** confirmar recepción física.
- **RF-BOD-005:** tránsito no se cuenta como custodia Bodega.
- **RF-BOD-006:** obtener destinos válidos de despacho.
- **RF-BOD-007:** dashboard de Bodega usa activos únicos.
- **RF-BOD-008:** badges usan la misma definición que la cola.

## 6.9 Bodega — despacho a Laboratorio

- **RF-BOD-009:** validar evidencia de salida Bodega→Lab.
- **RF-BOD-010:** confirmar salida Bodega→Lab.
- **RF-BOD-011:** tras salida, equipo queda En camino a Laboratorio.
- **RF-BOD-012:** equipo en tránsito no puede ser asignado en Lab.
- **RF-BOD-013:** evidencia Bodega no sustituye recepción Lab.

## 6.10 Laboratorio — custodia y supervisión

- **RF-LAB-001:** bandeja separa En camino/Recibidos/Incidencias/Historial.
- **RF-LAB-002:** Jefe Lab valida recepción física.
- **RF-LAB-003:** Jefe Lab confirma recepción.
- **RF-LAB-004:** recepción inicia SLA del ciclo vigente.
- **RF-LAB-005:** relecturas del mismo ciclo no reinician SLA.
- **RF-LAB-006:** Jefe Lab consulta técnicos activos.
- **RF-LAB-007:** Jefe Lab asigna/reasigna.
- **RF-LAB-008:** asignación no cambia custodia.
- **RF-LAB-009:** Jefe Lab visualiza carga por técnico.
- **RF-LAB-010:** Admin/Gerente solo consultan proyección autorizada.
- **RF-LAB-011:** Jefe Lab valida salida hacia Bodega.
- **RF-LAB-012:** Jefe Lab confirma salida.
- **RF-LAB-013:** cierre técnico no confirma salida.

## 6.11 Laboratorio — trabajo técnico

- **RF-LTW-001:** técnico solo abre OS asignada.
- **RF-LTW-002:** trabajo requiere recepción física vigente.
- **RF-LTW-003:** iniciar trabajo cambia Diagnóstico→Reparación.
- **RF-LTW-004:** guardar avance no cambia estado ni stock.
- **RF-LTW-005:** controlar revisión para evitar sobrescritura concurrente.
- **RF-LTW-006:** diagnóstico: CONFIRMADA/DIFERENTE/NFF/POD/OTRO.
- **RF-LTW-007:** registrar falla real y observación según diagnóstico.
- **RF-LTW-008:** registrar intervenciones.
- **RF-LTW-009:** métodos de prueba autorizados: Manual y Test MK.
- **RF-LTW-010:** cada prueba registra resultado/observación.
- **RF-LTW-011:** cierre exige pruebas aprobadas.
- **RF-LTW-012:** resultado final: REPARADO/NFF/POD según reglas de cierre.
- **RF-LTW-013:** registrar `registro_reparaciones`.
- **RF-LTW-014:** registrar eventos de diagnóstico/finalización.
- **RF-LTW-015:** resultado POD exige consistencia diagnóstico/resultado.
- **RF-LTW-016:** técnico no envía ID/cantidad de stock.
- **RF-LTW-017:** solicitud de repuesto requiere condición PoD documentada.
- **RF-LTW-018:** solicitud describe necesidad y motivo.
- **RF-LTW-019:** OS pasa a espera de repuesto mientras solicitud está pendiente.
- **RF-LTW-020:** no cerrar con solicitud de Bodega pendiente.
- **RF-LTW-021:** antecedentes de rechazo QA deben estar visibles en nuevo ciclo.

## 6.12 Repuestos

- **RF-REP-001:** Logística consulta repuestos/stock.
- **RF-REP-002:** stock crítico se expone para alerta.
- **RF-REP-003:** Logística entrega una solicitud pendiente.
- **RF-REP-004:** validar categoría del repuesto contra tipo de equipo.
- **RF-REP-005:** validar stock disponible.
- **RF-REP-006:** descontar stock de forma transaccional.
- **RF-REP-007:** entrega es idempotente para misma pieza/cantidad/usuario.
- **RF-REP-008:** registrar `LOGISTICA_ENTREGA_REPUESTO`.
- **RF-REP-009:** impedir sobrescritura directa de stock sin política de ajuste.

## 6.13 QA

- **RF-QA-001:** Bodega valida despacho a QA.
- **RF-QA-002:** Bodega confirma salida a QA.
- **RF-QA-003:** QA muestra dashboard/cola/incoming.
- **RF-QA-004:** QA valida recepción.
- **RF-QA-005:** QA confirma recepción.
- **RF-QA-006:** QA inicia/toma su trabajo sin asignación Admin.
- **RF-QA-007:** registrar etapa Instalación Ambiente.
- **RF-QA-008:** registrar pruebas.
- **RF-QA-009:** guardar avances con revisión.
- **RF-QA-010:** dictamen OPERATIVO o RECHAZADO.
- **RF-QA-011:** rechazo exige motivo.
- **RF-QA-012:** dictamen no confirma salida.
- **RF-QA-013:** QA valida salida.
- **RF-QA-014:** QA confirma salida.
- **RF-QA-015:** Bodega debe confirmar recepción posterior.
- **RF-QA-016:** Operativo queda elegible después de recepción Bodega.
- **RF-QA-017:** Rechazado vuelve a circuito de corrección con contexto.
- **RF-QA-018:** endpoints legacy de asignación/proceso responden 410.

## 6.14 Inventario e instalación

- **RF-INV-001:** inventario representa parque global.
- **RF-INV-002:** distinguir stock físico de parque global.
- **RF-INV-003:** distinguir disponible/no disponible.
- **RF-INV-004:** stock inicial y reparado tienen orígenes distintos.
- **RF-INV-005:** un activo con intervención activa no es elegible.
- **RF-INV-006:** validar contexto de nueva instalación o reemplazo.
- **RF-INV-007:** validar identidad física del activo seleccionado.
- **RF-INV-008:** permitir MANUAL_AUTORIZADO con motivo/presencia física.
- **RF-INV-009:** confirmar despacho en transacción.
- **RF-INV-010:** crear IN + evento SALIDA_BODEGA_TERRENO de forma atómica.
- **RF-INV-011:** impedir reutilizar la misma evidencia con contexto distinto.
- **RF-INV-012:** impedir doble consumo de stock origen.

## 6.15 Bridge y trazabilidad

- **RF-BRG-001:** buscar por referencia, serie u OS.
- **RF-BRG-002:** crear correlación solo por Logística.
- **RF-BRG-003:** correlación debe coincidir con tipo/serie de OS.
- **RF-BRG-004:** correlaciones son inmutables.
- **RF-BRG-005:** no exponer Bridge como flujo operacional.
- **RF-TRZ-001:** historial agrupa OS por tipo+serie.
- **RF-TRZ-002:** incluir referencias externas.
- **RF-TRZ-003:** incluir eventos físicos/técnicos.
- **RF-TRZ-004:** mantener historial de cambios de OS.
- **RF-TRZ-005:** Técnico Terreno y Jefe de Laboratorio reciben proyección técnica restringida desde la API, sin auditoría administrativa ni metadatos restringidos.
- **RF-TRZ-006:** búsquedas globales respetan RBAC.

## 6.16 Dashboards, reportes y KPI

- **RF-DASH-001:** dashboard ejecutivo para Admin/Gerente.
- **RF-DASH-002:** parque total sin doble conteo.
- **RF-DASH-003:** distribución por etapa/custodia.
- **RF-DASH-004:** órdenes activas separadas de parque.
- **RF-DASH-005:** dashboard Bodega.
- **RF-DASH-006:** dashboard Lab: camino/recibidos/carga/SLA/listos.
- **RF-DASH-007:** dashboard QA por etapa.
- **RF-DASH-008:** badges coherentes con colas.
- **RF-DASH-009:** Admin, Gerente y Jefe de Laboratorio consultan reportes Lab según permisos.
- **RF-DASH-010:** cero real ≠ error ≠ sin medición.

## 6.17 Inteligencia operacional

- **RF-IA-001:** ejecutar analizador Python bajo demanda.
- **RF-IA-002:** consultar PostgreSQL en modo lectura.
- **RF-IA-003:** producir JSON válido.
- **RF-IA-004:** Admin, Gerente, Jefe de Laboratorio y Logística consultan inteligencia operacional mediante ai.read; los demás roles son rechazados. El reporte es heurístico, no un modelo entrenado.
- **RF-IA-005:** score de reincidencia no modifica operación.
- **RF-IA-006:** interfaz identifica correctamente el método heurístico.
- **RF-IA-007:** no presentar precisión/recall inexistente.

## 6.18 Web/Mobile/Configuración personal

- **RF-UX-001:** navegación derivada de capacidades.
- **RF-UX-002:** acceso directo a ruta debe respetar permiso.
- **RF-UX-003:** temas Claro/Oscuro; Mobile también Automático.
- **RF-UX-004:** preferencia visual persistente.
- **RF-UX-005:** feedback inline para procesos.
- **RF-UX-006:** evitar modales operacionales salvo controles nativos.
- **RF-UX-007:** responsive sin overflow horizontal accidental.
- **RF-UX-008:** objetivos táctiles Mobile adecuados.
- **RF-MOB-001:** Mobile permite login.
- **RF-MOB-002:** Mobile muestra jornada/OS propias.
- **RF-MOB-003:** Mobile reporta falla.
- **RF-MOB-004:** Mobile ejecuta retiro físico.
- **RF-MOB-005:** Mobile completa instalación.
- **RF-MOB-006:** Mobile consulta historial técnico.
- **RF-MOB-007:** Mobile permite perfil/seguridad/apariencia.

# 7. Requisitos no funcionales

## Seguridad

- **RNF-SEC-001:** toda ruta protegida valida Firebase + usuario PostgreSQL.
- **RNF-SEC-002:** denegación por defecto en acciones sensibles.
- **RNF-SEC-003:** tokens/contraseñas no se registran en logs.
- **RNF-SEC-004:** secretos fuera del repositorio.
- **RNF-SEC-005:** autorización de frontend no reemplaza backend.
- **RNF-SEC-006:** mutaciones sensibles auditables.
- **RNF-SEC-007:** payloads de fotografías se procesan después de autenticación/RBAC.
- **RNF-SEC-008:** último Admin protegido.

## Integridad y consistencia

- **RNF-DAT-001:** transacciones en movimientos críticos.
- **RNF-DAT-002:** identidad OS inmutable.
- **RNF-DAT-003:** historial crítico append-only.
- **RNF-DAT-004:** evidencia debe corresponder a estación/propósito/ciclo.
- **RNF-DAT-005:** operaciones repetidas compatibles deben ser idempotentes.
- **RNF-DAT-006:** conflicto de reintento incompatible devuelve 409.
- **RNF-DAT-007:** FKs/checks refuerzan reglas de dominio.

## Rendimiento

- **RNF-PER-001:** listados operacionales usan paginación/límites.
- **RNF-PER-002:** búsquedas no retornan conjuntos ilimitados.
- **RNF-PER-003:** índices soportan serie, OS, referencias, eventos y evidencia.
- **RNF-PER-004:** pruebas de carga se ejecutan en entorno aislado.

## Disponibilidad y errores

- **RNF-REL-001:** errores controlados usan códigos HTTP coherentes.
- **RNF-REL-002:** 401/403/409/422 se distinguen de 500.
- **RNF-REL-003:** errores no se transforman silenciosamente en datos vacíos.
- **RNF-REL-004:** base habitual no debe ser alterada por pruebas destructivas.

## Usabilidad y accesibilidad

- **RNF-UX-001:** texto+icono+color para estados relevantes.
- **RNF-UX-002:** foco visible.
- **RNF-UX-003:** etiquetas comprensibles por proceso.
- **RNF-UX-004:** semántica verde/ámbar/rojo/azul/gris consistente.
- **RNF-UX-005:** campos derivados readonly.
- **RNF-UX-006:** no pedir datos que el sistema ya conoce.

## Mantenibilidad

- **RNF-MAN-001:** reglas de rol centralizadas.
- **RNF-MAN-002:** identidad de activos compartida.
- **RNF-MAN-003:** servicios de dominio separados de rutas.
- **RNF-MAN-004:** documentación V2.0 debe actualizarse junto al contrato funcional.
- **RNF-MAN-005:** migraciones aditivas preservan historia.

## Compatibilidad

- **RNF-COM-001:** Web compatible con navegador moderno.
- **RNF-COM-002:** Mobile basado en Expo SDK 57.
- **RNF-COM-003:** PostgreSQL como persistencia principal.
- **RNF-COM-004:** entorno local soporta Windows; Ubuntu/Nginx/PM2 es proyección servidor.

# 8. Criterios de aceptación de cierre

1. Todos los roles reciben únicamente sus capacidades.
2. Una lectura sin confirmación no cambia custodia.
3. Una evidencia vieja no puede mover un equipo.
4. Un activo conserva historia por tipo+serie.
5. Un rechazo QA retorna con antecedentes.
6. Técnico Lab no puede consumir stock.
7. Admin no puede operar físicamente por ser Admin.
8. IN se crea solo al despacho físico.
9. Dashboards no duplican activos.
10. La matriz de `08_Pruebas/` vincula requisitos y pruebas; los resultados vigentes se concentran en `Documentacion Capstone/ESTADO_Y_PENDIENTES.md`.

# 9. Trazabilidad

La matriz detallada requisito → componente → endpoint → prueba → evidencia se mantiene en:

`08_Pruebas/MATRIZ_TRAZABILIDAD_V2.0.md`.

## Conciliación documental del 14 de octubre de 2026

Se sincronizan RF-IA-004, RF-TRZ-005 y RF-DASH-009 con las observaciones fechadas el 13-10-2026 en `01_Requerimientos/Matriz_Requerimientos_PMP_Suite.xlsx` y con el código. La redacción basal limitaba IA a Admin/Gerente y el historial técnico a Terreno; la política ya implementada incorpora Jefe de Laboratorio y Logística en `ai.read`, y Jefe de Laboratorio en la proyección técnica. Esta corrección documental no modifica permisos ni acredita aprobación académica.

RF-DASH-009 conserva el requisito de reportes Lab. Se formaliza por separado su extensión ya implementada: Centro de reportes y Excel para Admin, Gerente, Jefe de Laboratorio y Logística, dentro de las consultas permitidas de cada área. Recupera los registros filtrados, aborta exportaciones parciales, conserva series como texto y usa columnas permitidas. No habilita exportación a Técnico Lab, QA ni Terreno. Verificación: `04_Frontend/test/excel-report.frontend.test.mjs` y `reports-center.frontend.test.mjs`. No se renumeran requisitos ni se amplía funcionalidad.

“Implementado” describe el contrato del código, no aceptación real. El estado de cierre y sus límites se concentra en `Documentacion Capstone/ESTADO_Y_PENDIENTES.md`.
