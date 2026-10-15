# Recepción, carga y SLA de Laboratorio

**Revisión documental:** 13-10-2026. Diagrama funcional; no agrega estados a la FSM.

```plantuml
@startuml
!pragma layout smetana
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam defaultFontSize 16
skinparam ArrowColor #1565C0
skinparam shadowing false
start
repeat
 :Bodega confirma salida hacia Lab\nEn tránsito sin carga ni SLA;
 :Jefe Lab valida llegada;
 if (¿Recepción física confirmada?) then (Sí)
  :Custodia Lab e inicio SLA del nuevo ciclo;
 else (No)
  :Mantener tránsito y corregir evidencia;
  stop
 endif
 :Jefe Lab asigna técnico;
 :Trabajo propio y cierre técnico\nDiagnóstico, intervención y pruebas;
 :Salida Lab confirmada\nBodega recibe y despacha a QA;
 :QA recibe, prueba y registra dictamen;
 :QA confirma salida\nBodega confirma recepción;
repeat while (¿Dictamen rechazado?) is (Sí, nuevo ciclo) not (No, operativo)
:Evaluar stock reparado elegible;
stop
@enduml
```

## Diagrama renderizado

![Diagrama 11](11_Ciclo_Laboratorio_SLA_V2.0.svg)

[Fuente PlantUML](11_Ciclo_Laboratorio_SLA_V2.0.puml) — [Abrir SVG](11_Ciclo_Laboratorio_SLA_V2.0.svg).

Actualización documental V2.0 del 13-10-2026. Fuente editable y SVG concordantes; no acredita aprobación de fase ni ejecución operacional.
