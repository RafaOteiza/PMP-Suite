# 09 — Ejecución local

```plantuml
@startuml
!pragma layout smetana
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam ArrowColor #1565C0
skinparam shadowing false
node "PC desarrollo" {
  component "Vite :5173" as WEB
  component "Node API :4000" as API
  database "PostgreSQL :5432\npmp_suite" as DB
  component "Python IA" as PY
  component "Metro / Expo" as EXPO
}
cloud Firebase
node "Teléfono" {
  component "Cliente PMP compatible\ncon Expo SDK 57" as MOB
}
WEB --> Firebase : autenticación
MOB --> Firebase : autenticación
WEB --> API : Bearer
API --> DB
API --> Firebase
API --> PY
PY --> DB
EXPO --> MOB
MOB --> API : LAN
@enduml
```


## Diagrama renderizado

![Diagrama 09](09_Ejecucion_Local_V2.0.svg)

[Fuente PlantUML](09_Ejecucion_Local_V2.0.puml) · [Abrir SVG](09_Ejecucion_Local_V2.0.svg).

Actualización documental V2.0 del 13-10-2026. Fuente editable y SVG concordantes; no acredita aprobación de fase ni ejecución operacional.
