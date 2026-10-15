# Activo nuevo: alta, recepción e instalación\n\n**Revisión documental:** 13-10-2026. Diagrama funcional; no agrega estados a la FSM.

```plantuml
@startuml
!pragma layout smetana
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam ArrowColor #1565C0
skinparam shadowing false
start
:Logística registra maestro\n(tipo, serie, modelo, marca y origen);
:ALTA_ACTIVO\nSin OS ni stock disponible;
:Capturar identidad y validar\npresencia física en Bodega;
if (¿Validación válida?) then (Sí)
 :Confirmar recepción inicial;
 :RECEPCION_INICIAL +\nHABILITADO_INSTALACION;
 :Disponible para instalación\nOrigen de stock = evento;
 :Seleccionar destino y técnico;
 :Nueva evidencia de despacho\nNo reutilizar recepción;
 if (¿Confirmación válida?) then (Sí)
  :Transacción: crear IN independiente\ny SALIDA_BODEGA_TERRENO;
  :En ruta;
  :Terreno informa resultado;
  if (¿Instalación operativa?) then (Sí)
   :Activo en operación;
  else (No)
   :INSTALACION_FALLIDA
En retorno a Bodega;
   :Bodega valida y confirma recepción;
  endif
 else (No)
  :Sin despacho ni nueva IN;
 endif
else (No)
 :Bloquear recepción\nConservar maestro no disponible;
endif
stop
@enduml
```

## Diagrama renderizado

![Diagrama 10](10_Alta_Recepcion_Instalacion_V2.0.svg)

[Fuente PlantUML](10_Alta_Recepcion_Instalacion_V2.0.puml) — [Abrir SVG](10_Alta_Recepcion_Instalacion_V2.0.svg).

Actualización documental V2.0 del 13-10-2026. Fuente editable y SVG concordantes; no acredita aprobación de fase ni ejecución operacional.
