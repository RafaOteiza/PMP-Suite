# PMP Suite

> **Plataforma integral para la gestión de mantenimiento y trazabilidad de validadores y consolas.**

PMP Suite es un proyecto Capstone de Ingeniería Informática que centraliza el ciclo físico, técnico y administrativo de equipos tecnológicos asociados al transporte público. Integra una aplicación web, una aplicación móvil, una API REST, una base de datos PostgreSQL, autenticación mediante Firebase y un módulo de analítica en Python.

## Tabla de contenidos

- [Nombre del proyecto](#nombre-del-proyecto)
- [Descripción](#descripción)
- [Módulos principales](#módulos-principales)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Arquitectura de la solución](#arquitectura-de-la-solución)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Instrucciones para ejecutar el proyecto localmente](#instrucciones-para-ejecutar-el-proyecto-localmente)
- [Pruebas](#pruebas)
- [Integrantes del equipo](#integrantes-del-equipo)
- [Metodología de trabajo](#metodología-de-trabajo)
- [Documentación principal](#documentación-principal)

## Nombre del proyecto

**PMP Suite — Gestión integral de mantenimiento y trazabilidad de equipos.**

## Descripción

PMP Suite permite registrar y seguir un equipo desde la detección de una falla en terreno hasta su retiro, recepción en bodega, diagnóstico, reparación, control de calidad, retorno a stock y posterior reinstalación.

La plataforma está dirigida a los equipos de **Terreno, Logística/Bodega, Laboratorio, Control de Calidad (QA), Administración y Gerencia** que intervienen en el mantenimiento de validadores y consolas.

### Problema que resuelve

El proceso original depende de planillas independientes, correos, guías de despacho, registros técnicos y controles separados por área. Esta fragmentación dificulta conocer con certeza:

- la ubicación y custodia actual de cada equipo;
- el estado real de una orden de servicio;
- la relación entre activo, caso, orden, falla, reparación y evidencia;
- el historial técnico de una serie;
- los repuestos utilizados y el stock disponible;
- el resultado de las pruebas de QA;
- los tiempos de atención, reincidencias e indicadores operacionales.

PMP Suite aborda esta brecha mediante una **fuente operacional centralizada**, identidad única por tipo y número de serie, control de acceso por rol, eventos de trazabilidad, evidencia por movimiento y un historial transversal por activo.

## Módulos principales

| Módulo | Función principal |
|---|---|
| Terreno | Reporte de fallas, consulta de órdenes asignadas, retiro e instalación de equipos y captura de evidencia desde dispositivos móviles. |
| Logística y Bodega | Registro de activos, recepción, inventario, asignación, movimientos, despachos y control de repuestos. |
| Laboratorio | Recepción física, custodia, asignación de carga, diagnóstico, reparación, pruebas técnicas y preparación de salida. |
| Control de Calidad | Recepción desde laboratorio, ejecución de pruebas, aprobación o rechazo y despacho posterior. |
| Administración y Gerencia | Gestión de usuarios y roles, supervisión, dashboards, reportes e indicadores de solo lectura según permisos. |
| Trazabilidad y Bridge | Historial por activo, consulta de movimientos y vinculación controlada con referencias externas. |
| Analítica | Detección de reincidencias, equipos sin movimiento y apoyo a la supervisión operacional. |

## Tecnologías utilizadas

| Capa | Tecnologías | Uso en la solución |
|---|---|---|
| Lenguajes | JavaScript, TypeScript, Python y SQL | Implementación de clientes, API, analítica y persistencia. |
| Frontend web | React 18, TypeScript, Vite 5, React Router, Axios, Recharts y SheetJS/XLSX | Operación web, administración, dashboards y exportación de reportes. |
| Aplicación móvil | Expo SDK 57, React Native 0.86, React Navigation, Expo Camera, Image Picker y AsyncStorage | Operación de Terreno, lectura/captura de evidencia y consulta móvil. |
| Backend | Node.js, Express 4, PostgreSQL Driver (`pg`), Firebase Admin, Swagger/OpenAPI y Sharp | API REST, reglas de negocio, autorización, transacciones, documentación y tratamiento de evidencias. |
| Base de datos | PostgreSQL, esquema `pmp` | Activos, órdenes, movimientos, usuarios, repuestos, evidencias, QA e historial. |
| Cloud e identidad | Firebase Authentication y Firebase Admin SDK | Inicio de sesión, validación de identidad y administración segura de sesiones. |
| Analítica | Python 3, pandas, psycopg2 y python-dotenv | Procesamiento de datos y análisis operacional bajo demanda. |
| Ingeniería y documentación | Git, GitHub, Mermaid, Markdown, Swagger y pruebas nativas de Node.js | Versionamiento, colaboración, diagramas, documentación y validación automatizada. |

## Arquitectura de la solución

PMP Suite utiliza una arquitectura **cliente-servidor modular**. La aplicación web y la aplicación móvil consumen una API REST central. La API concentra las reglas de negocio, la autorización, las validaciones de custodia y las transacciones. PostgreSQL mantiene la información operacional y Firebase valida la identidad de los usuarios.

```mermaid
flowchart LR
    UW["Usuarios Web<br/>Administración · Gerencia · Logística · Laboratorio · QA"] --> WEB["Aplicación Web<br/>React + Vite"]
    UT["Técnico de Terreno"] --> MOB["Aplicación Mobile<br/>Expo + React Native"]

    WEB -->|REST / JSON| API["API REST<br/>Node.js + Express"]
    MOB -->|REST / JSON| API

    WEB -->|Autenticación| FB["Firebase Authentication"]
    MOB -->|Autenticación| FB
    API -->|Validación de token| FB

    API -->|Lectura y escritura transaccional| DB[("PostgreSQL<br/>schema pmp")]
    API -->|Ejecución bajo demanda| IA["Analítica Python<br/>pandas + psycopg2"]
    IA -->|Lectura autorizada| DB
```

### Principios arquitectónicos

1. **Backend autoritativo:** los permisos y reglas críticas se validan en la API, no solamente en la interfaz.
2. **Identidad y autorización separadas:** Firebase autentica al usuario; PostgreSQL determina si la cuenta está activa y cuál es su rol efectivo.
3. **Physical First:** escanear o seleccionar un equipo no cambia su custodia; el movimiento debe validarse y confirmarse con su evidencia correspondiente.
4. **Trazabilidad por eventos:** cada movimiento relevante conserva actor, fecha, origen, destino, contexto y evidencia.
5. **Identidad técnica única:** el tipo y la serie determinan de forma transversal la marca y el modelo del activo.
6. **Analítica no intrusiva:** el módulo Python apoya la supervisión y trabaja principalmente en modo lectura; no reemplaza la decisión operacional.

## Estructura del repositorio

```text
PMP-Suite/
├── Fase 1/
│   ├── Evidencias Grupales/
│   └── Evidencias Individuales/
└── Fase 2/
    └── Evidencia Proyecto/
        └── Evidencia del Sistema/
            ├── 01_Requerimientos/
            ├── 02_Arquitectura/
            ├── 03_Backend/pmp-api/
            ├── 04_Frontend/
            ├── 05_BaseDatos/
            ├── 06_ModelosIA/
            ├── 07_Mobile/
            ├── 08_Pruebas/
            ├── 09_BrandKit/
            ├── Documentacion Capstone/
            ├── shared/
            └── README.md
```

El código ejecutable se encuentra en **`Fase 2/Evidencia Proyecto/Evidencia del Sistema`**. El presente archivo actúa como README global del repositorio y la guía técnica interna contiene el detalle operativo del entorno.

## Instrucciones para ejecutar el proyecto localmente

### 1. Requisitos previos

Entorno verificado:

- Git.
- Node.js 24.x y npm 11.x.
- Python 3.13.x.
- PostgreSQL 18.x o una instancia compatible.
- Proyecto autorizado de Firebase Authentication.
- Credencial de Firebase Admin almacenada fuera del repositorio.
- Cuenta habilitada tanto en Firebase como en la tabla `pmp.usuarios`.
- Para Mobile: cliente compatible con Expo SDK 57 o un build de desarrollo.

### 2. Clonar y entrar al sistema

```bash
git clone https://github.com/RafaOteiza/PMP-Suite.git
cd PMP-Suite
cd "Fase 2/Evidencia Proyecto/Evidencia del Sistema"
```

Los siguientes comandos se ejecutan desde la carpeta **`Evidencia del Sistema`**, utilizando terminales separadas para Backend, Web y Mobile.

### 3. Configurar el Backend

```bash
cd "03_Backend/pmp-api"
npm ci
```

Copiar `.env.example` como `.env` y completar los valores autorizados:

```env
PORT=4000
DATABASE_URL=postgresql://usuario:contrasena@localhost:5432/pmp_suite
FIREBASE_SERVICE_ACCOUNT_PATH=C:\ruta\segura\firebase-admin.json
```

En PowerShell se puede crear la copia con:

```powershell
Copy-Item .env.example .env
```

Iniciar la API:

```bash
npm run dev
```

Servicios disponibles:

- API: `http://localhost:4000/api`
- Estado de salud: `http://localhost:4000/api/health`
- Swagger: `http://localhost:4000/docs`

### 4. Configurar el Frontend web

Desde una nueva terminal ubicada en `Evidencia del Sistema`:

```bash
cd "04_Frontend"
npm ci
```

Copiar `.env.example` como `.env` y configurar:

```env
VITE_CORE_URL=http://localhost:4000
VITE_API_URL=http://localhost:4000
VITE_FB_API_KEY=TU_API_KEY
VITE_FB_AUTH_DOMAIN=TU_AUTH_DOMAIN
VITE_FB_PROJECT_ID=TU_PROJECT_ID
VITE_FB_STORAGE_BUCKET=TU_STORAGE_BUCKET
VITE_FB_MESSAGING_SENDER_ID=TU_MESSAGING_SENDER_ID
VITE_FB_APP_ID=TU_APP_ID
```

Iniciar la aplicación:

```bash
npm run dev
```

Abrir `http://localhost:5173`.

### 5. Preparar el módulo de analítica

Desde `Evidencia del Sistema`:

```bash
cd "06_ModelosIA"
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

macOS o Linux:

```bash
./.venv/bin/python -m pip install -r requirements.txt
```

El módulo no requiere iniciar un servidor independiente; la API lo ejecuta bajo demanda desde el entorno virtual.

### 6. Configurar la aplicación Mobile

Desde una nueva terminal ubicada en `Evidencia del Sistema`:

```bash
cd "07_Mobile"
npm ci
```

Copiar `.env.example` como `.env`. Para un dispositivo físico se debe usar la IPv4 LAN del equipo que ejecuta la API:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000/api
```

Para un emulador Android puede utilizarse:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api
```

Iniciar Expo:

```bash
npm start
```

### 7. Consideraciones de base de datos

La ejecución habitual utiliza la base PostgreSQL autorizada definida en `DATABASE_URL`. El repositorio incluye `05_BaseDatos/schema_actual.sql` como respaldo estructural del esquema `pmp`, pero ese archivo no contiene todos los catálogos operacionales, usuarios ni datos maestros necesarios para una instalación funcional independiente.

Por lo tanto:

- no se debe restaurar el esquema sobre la base habitual sin respaldo y autorización;
- una instalación nueva debe incorporar catálogos, estados, ubicaciones, roles, usuarios y relaciones operacionales validadas;
- las credenciales, archivos `.env`, claves de servicio y respaldos con datos reales no deben subirse al repositorio.

## Pruebas

### Backend

```bash
cd "03_Backend/pmp-api"
npm test
```

### Frontend

```bash
cd "04_Frontend"
npm test
npm run build
```

### Mobile

```bash
cd "07_Mobile"
npm test
```

Las pruebas automatizadas validan roles, navegación, sesiones, flujos de activos, Bodega, Laboratorio, QA, escaneo, trazabilidad y regresiones operacionales. Para los procedimientos de prueba aislada y exportación Mobile, consultar la guía técnica interna.

## Integrantes del equipo

| Integrante | Rol principal | Responsabilidades |
|---|---|---|
| **Rafael Oteiza** | Líder técnico y especialista de dominio | Arquitectura de solución, backend, base de datos, integración, seguridad, analítica y coordinación técnica del proyecto. |
| **Matías Garrido** | Analista de requerimientos y documentación | Levantamiento funcional, modelamiento de procesos, especificación de requerimientos, trazabilidad y documentación del proyecto. |
| **Luis Arenas** | Desarrollador Frontend y UX | Diseño e implementación de interfaces, experiencia de usuario, componentes web, responsividad y apoyo en integración y pruebas. |

Las responsabilidades indicadas corresponden al foco principal de cada integrante; el desarrollo y la validación se realizan de manera colaborativa.

## Metodología de trabajo

El proyecto se desarrolla con **metodología en cascada**, adecuada al formato académico del Capstone y a la necesidad de mantener entregables formales y trazables entre etapas.

```text
Inicio y planificación
        ↓
Levantamiento y especificación de requerimientos
        ↓
Diseño funcional, de datos y de arquitectura
        ↓
Construcción e integración
        ↓
Pruebas y validación
        ↓
Despliegue, evidencias y cierre
```

La metodología se apoya en:

- ERS y matriz de trazabilidad para relacionar requerimientos, diseño, implementación y pruebas;
- WBS, carta Gantt, matriz de riesgos y planes de prueba/despliegue;
- Git y GitHub para control de versiones y consolidación del trabajo;
- revisiones incrementales dentro de cada fase antes de cerrar el entregable;
- pruebas automatizadas y validaciones funcionales para controlar regresiones.

Aunque la metodología principal es cascada, el equipo utiliza prácticas iterativas de revisión y mejora durante la construcción, sin alterar la secuencia formal de los entregables.

## Documentación principal

- [Guía técnica del sistema](Fase%202/Evidencia%20Proyecto/Evidencia%20del%20Sistema/README.md)
- [Especificación de Requerimientos de Software](Fase%202/Evidencia%20Proyecto/Evidencia%20del%20Sistema/01_Requerimientos/ERS_PMP_Suite_V2.0.md)
- [Arquitectura integral](Fase%202/Evidencia%20Proyecto/Evidencia%20del%20Sistema/02_Arquitectura/Arquitectura_Integral_PMP_Suite_V2.0.md)
- [Catálogo de la API](Fase%202/Evidencia%20Proyecto/Evidencia%20del%20Sistema/02_Arquitectura/CATALOGO_API_V2.0.md)
- [Modelo y diccionario de datos](Fase%202/Evidencia%20Proyecto/Evidencia%20del%20Sistema/02_Arquitectura/MODELO_DATOS_DICCIONARIO_V2.0.md)
- [Problemática y contexto](Fase%202/Evidencia%20Proyecto/Evidencia%20del%20Sistema/Documentacion%20Capstone/00_PROBLEMATICA_Y_CONTEXTO_V2.0.md)
- [Estado y pendientes](Fase%202/Evidencia%20Proyecto/Evidencia%20del%20Sistema/Documentacion%20Capstone/ESTADO_Y_PENDIENTES.md)

---

**PMP Suite** busca convertir un proceso fragmentado y dependiente de planillas en una operación integrada, auditable y basada en la trazabilidad real de cada equipo.
