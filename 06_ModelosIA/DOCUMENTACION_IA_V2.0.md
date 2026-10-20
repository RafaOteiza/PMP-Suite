# Documentación de Inteligencia Operacional — V2.0

**Actualización:** 09-10-2026

## Alcance

PMP Suite utiliza una heurística de reincidencia para priorizar activos que merecen revisión. La implementación vigente está en `src/analyzer.py`.

## Datos utilizados

El analizador consulta `pmp.ordenes_servicio` y obtiene serie, tipo de equipo, falla, fecha y cantidad de fallas previas.

## Derivaciones

- `es_emv`: coincidencia del término EMV.
- `es_barcode`: coincidencia Barcode/QR/Lector.
- `fallas_previas`: OS anteriores de la misma serie.

Fórmula vigente:

```text
riesgo_score = clip(fallas_previas * 0.3 + es_emv * 0.5, 0, 1)
```

## Interpretación

El score ayuda a priorizar inspección. No constituye probabilidad estadística calibrada, diagnóstico, dictamen QA ni recomendación automática de baja.

## Arquitectura

```text
PostgreSQL
→ analyzer.py
→ JSON
→ API Node
→ Web
```

## Calidad

La consulta es de solo lectura; los errores no deben exponer credenciales; la interfaz debe describir el método real y no declarar precisión/recall sin una evaluación reproducible.

## Límites de la consulta observada — 11-10-2026

El SQL actual cuenta OS anteriores por **serie**, sin incluir `tipo_equipo` en la subconsulta de reincidencia, y no excluye expresamente las IN. Por tanto, `fallas_previas` es el nombre del campo calculado, no una garantía de contar únicamente fallas del mismo tipo + serie. Esta limitación impide presentar el score como historial técnico canónico o tasa validada de fallas.

El script ejecuta SELECT; `get_connection()` no impone por sí mismo una sesión PostgreSQL de solo lectura. La política de privilegios de despliegue debe distinguirse del comportamiento observado del script. Esta auditoría no cambia código, credenciales ni permisos.
