# 02 — Arquitectura lógica

```plantuml
@startuml
!pragma layout smetana
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam ArrowColor #1565C0
skinparam shadowing false
actor "Usuarios Web" as WebUser
actor "Técnico Terreno" as Terrain
component "Frontend Web\nReact + Vite" as Web
component "Mobile\nExpo + React Native" as Mobile
component "API REST\nNode + Express" as API
database "PostgreSQL\nschema pmp" as DB
cloud "Firebase Auth/Admin" as FB
component "Analizador Python\nHeurística" as IA
component "Análisis de mantenimiento\nServicios Node de lectura" as MA

WebUser --> Web
Terrain --> Mobile
Web --> FB : login / ID token
Mobile --> FB : login / ID token
Web --> API : HTTPS + Bearer
Mobile --> API
API --> FB : autenticación
API --> DB : dominio / persistencia
API --> IA : predictive-report
API --> MA : operational-insights
MA --> DB : lectura
IA --> DB : lectura
@enduml
```

## Diagrama renderizado

![Diagrama 02](02_Arquitectura_Logica_V2.0.svg)

[Fuente PlantUML](02_Arquitectura_Logica_V2.0.puml) · [Abrir SVG](02_Arquitectura_Logica_V2.0.svg).

Actualización documental V2.0 del 13-10-2026. Fuente editable y SVG concordantes; no acredita aprobación de fase ni ejecución operacional.
