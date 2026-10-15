# 04 — Comunicación entre servicios

```plantuml
@startuml
!pragma layout smetana
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam ArrowColor #1565C0
skinparam shadowing false
participant "Web / Mobile" as C
participant "API" as A
participant "Firebase" as F
database "PostgreSQL" as P
participant "Python IA" as I

C -> F : login
F --> C : ID token
C -> A : HTTP + Bearer token
A -> F : verifyIdToken(token, true)
F --> A : identidad válida
A -> P : resolver pmp.usuarios\nactivo + rol
P --> A : usuario efectivo
A -> A : authorize(action) + alcance del recurso
note right of A
Identidad inválida: 401/403
Servicio Auth no disponible: 503
Rol/acción no autorizado: 403
Solo continúa una solicitud autorizada.
end note
A -> P : servicio de dominio
P --> A : resultado
A --> C : JSON

opt análisis Python autorizado
C -> A : GET predictive-report + Bearer
A -> A : identidad + ai.read
A -> I : ejecutar --json
I -> P : SELECT históricos
P --> I : datos
I --> A : JSON heurístico
A --> C : JSON heurístico
end
opt análisis de mantenimiento autorizado
C -> A : GET operational-insights
A -> A : ai.read + agregación
A -> P : SELECT OS, cierres, entregas y stock
P --> A : antecedentes
A --> C : JSON descriptivo y estimaciones condicionadas
end
@enduml
```

## Diagrama renderizado

![Diagrama 04](04_Comunicacion_Entre_Servicios_V2.0.svg)

[Fuente PlantUML](04_Comunicacion_Entre_Servicios_V2.0.puml) · [Abrir SVG](04_Comunicacion_Entre_Servicios_V2.0.svg).

Actualización documental V2.0 del 13-10-2026. Fuente editable y SVG concordantes; no acredita aprobación de fase ni ejecución operacional.
