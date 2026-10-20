# PMP Suite V2.0

Proyecto Capstone para gestionar activos, órdenes de servicio, custodia, mantenimiento, QA, repuestos y trazabilidad de validadores y consolas. Incluye Web, Mobile, API, PostgreSQL, Firebase y analítica descriptiva/heurística. La entrega y presentación están previstas para el **23 de octubre de 2026**.

Esta guía permite preparar el entorno desde cero. Los resultados, límites y pendientes actuales están en [Estado y pendientes](Documentacion%20Capstone/ESTADO_Y_PENDIENTES.md). V2.0 identifica la entrega documental; los paquetes conservan `1.0.0`. Esta copia no contiene historial Git y no necesita Tesis para ejecutarse.

## Requisitos comprobados

Revisión local del 14-10-2026 en Windows. Las versiones siguientes se obtuvieron de los ejecutables y lockfiles utilizados; no son una promesa de compatibilidad con todas las versiones posteriores.

| Componente | Versión comprobada |
|---|---|
| Node.js / npm | 24.15.0 / 11.12.1 |
| Python del módulo IA | 3.13.14 |
| PostgreSQL | Cliente 18.1; el esquema conservado fue extraído de servidor 18.1. Servidor habitual no consultado en esta revisión. |
| Backend | Express 4.22.1, pg 8.16.3, Firebase Admin 12.7.0 |
| Web | React 18.3.1, Vite 5.4.21, TypeScript 5.9.3, Firebase 12.7.0 |
| Mobile | Expo 57.0.22, React Native 0.86.3, React 19.2.3, Firebase 12.8.0 |
| Python | pandas 3.0.3, python-dotenv 1.0.1, psycopg2-binary 2.9.11 |

Se necesitan acceso autorizado a PostgreSQL y Firebase Authentication, una cuenta habilitada en ambos sistemas, y conexión a Internet para instalar dependencias y autenticar. Mobile requiere un cliente nativo compatible con Expo SDK 57 o un build de desarrollo, además de conectividad hacia la API. La exportación JavaScript no instala una app en el teléfono. No se ha comprobado aquí un cliente Expo Go ni un build nativo instalado.

## Carpetas

`03_Backend/pmp-api`: API Express. `04_Frontend`: Web. `07_Mobile`: Expo. `06_ModelosIA`: analizador Python. `shared`: contratos de sesión e identidad usados por ambos clientes; conservarlo al copiar el proyecto. `05_BaseDatos`: esquema y migraciones históricas. `01_Requerimientos`, `02_Arquitectura`, `08_Pruebas` y `Documentacion Capstone`: especificación y documentación. Los cinco Word vigentes están en [Artefactos Metodología Cascada](Documentacion%20Capstone/Artefactos%20Metodologia%20Cascada/).

## Instalar dependencias

Abrir PowerShell en la raíz de esta carpeta. No copiar `node_modules` ni entornos Python de otra ubicación. Mantener los lockfiles y no ejecutar `npm update` para reproducir esta versión.

```powershell
Push-Location 03_Backend/pmp-api
npm.cmd ci --ignore-scripts --no-audit --no-fund
Pop-Location
Push-Location 04_Frontend
npm.cmd ci --ignore-scripts --no-audit --no-fund
Pop-Location
Push-Location 07_Mobile
npm.cmd ci --ignore-scripts --no-audit --no-fund
Pop-Location
python -m venv 06_ModelosIA/.venv
& ./06_ModelosIA/.venv/Scripts/python.exe -m pip install -r 06_ModelosIA/requirements.txt
& ./06_ModelosIA/.venv/Scripts/python.exe -m pip check
```

La instalación limpia no se repitió durante este cierre: se verificaron las dependencias ya instaladas mediante suites, build y exportaciones; `pip check` pasó. Los comandos `npm ci`, creación del venv e instalación pip son instrucciones revisadas, todavía no verificadas en un equipo vacío. `--ignore-scripts` evita hooks de instalación; si falta un binario nativo, revisar el error concreto y su paquete antes de autorizar su script, sin actualizar toda la aplicación.

## Configurar sin compartir secretos

Para una instalación nueva, copiar cada `.env.example` a `.env` **solo si el archivo no existe**. En esta copia ya existe configuración privada; no sobrescribirla. Completar los valores fuera de la documentación.

| Módulo | Configuración |
|---|---|
| Backend `.env` | `PORT` (4000), `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_PATH` con ruta absoluta a la credencial Admin externa a la entrega. |
| Web `.env` | `VITE_CORE_URL=http://localhost:4000`; `VITE_API_URL` es fallback legacy, también sin `/api`. Configurar `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`, `VITE_FB_STORAGE_BUCKET`, `VITE_FB_MESSAGING_SENDER_ID` y `VITE_FB_APP_ID` del proyecto autorizado. |
| Mobile `.env` | `EXPO_PUBLIC_API_URL=http://<IPv4-LAN-del-PC>:4000/api`. En emulador Android puede usarse `http://10.0.2.2:4000/api`. La configuración cliente Firebase está en `src/services/firebase.js`; una instalación independiente debe configurarla para su proyecto. |
| IA | La API busca `06_ModelosIA/.venv/Scripts/python.exe` en Windows y `.venv/bin/python` en Unix. `analyzer.py` lee `03_Backend/pmp-api/.env` y respeta variables ya definidas en el proceso. No tiene servidor propio. |

Web, Mobile y Admin deben apuntar al mismo proyecto Firebase autorizado. La API verifica el token y consulta `pmp.usuarios`: usuario activo, rol válido y coincidencia única entre correo e identidad Firebase. Crear una cuenta Firebase por sí solo no habilita acceso a PMP. La preparación de usuarios corresponde al administrador; no hay una contraseña inicial pública ni un seed de administrador.

Los valores `VITE_*` y `EXPO_PUBLIC_*` quedan visibles en los bundles: nunca colocar allí claves privadas, contraseñas ni credenciales Admin. No publicar `.env`, claves, dumps, capturas de sesión o archivos de cuenta de servicio.

## PostgreSQL existente e instalación independiente

**Usar la BD existente.** Esta copia reutiliza la BD y Firebase habituales. Mantener la configuración privada existente, iniciar los servicios autorizados si corresponde y no aplicar `schema_actual.sql`, migraciones ni seeds. Las acciones confirmadas en la aplicación escriben en esa BD; las pruebas automatizadas descritas abajo usan mocks. No se ha cambiado configuración, usuarios ni datos durante este cierre.

**Instalación independiente.** `05_BaseDatos/schema_actual.sql` contiene 26 tablas y sus objetos del esquema `pmp`, sin filas, propietarios ni concesiones. Puede servir como estructura inicial en PostgreSQL 18, pero **no produce una aplicación operativa por sí solo**. Antes de restaurar debe prepararse una base nueva identificada inequívocamente y un rol con los permisos apropiados. Este procedimiento no se ejecutó ni se autoriza sobre la BD habitual.

Faltan datos iniciales aprobados y un procedimiento reproducible para:

- `estados`, `ubicaciones` y `config_estado_ubicacion`: IDs, nombres y correspondencias que consumen las transiciones y consultas del código. No asignarlos arbitrariamente.
- `terminales`, `pst`, `terminal_pst` y `buses`: contexto operacional y relaciones válidas.
- `usuarios`: primera cuenta administrativa, roles e identidades Firebase coherentes.
- `repuestos`: catálogo, categorías y umbrales; las existencias deben originarse en datos autorizados, sin inventarlas.

Los maestros de activos y los movimientos se incorporan después mediante el flujo autorizado. Los fixtures E2E son datos sintéticos de pruebas, no un catálogo de instalación. Las migraciones conservadas son cambios históricos y no contienen un seed completo; no reaplicarlas después del esquema actual. También faltan validar restauración, permisos, recuperación y configuración del Firebase independiente. Una vez resueltos estos puntos, el responsable podrá preparar y ensayar el procedimiento; esta guía no declara reconstrucción independiente completa.

## Arrancar y acceder

Usar tres terminales desde la raíz. Comprobar primero que los puertos 4000, 5173 y 8081 no estén ocupados; no detener procesos ajenos automáticamente.

```powershell
# Terminal 1
cd 03_Backend/pmp-api
npm.cmd run dev
```

```powershell
# Terminal 2
cd 04_Frontend
npm.cmd run dev -- --host 127.0.0.1 --strictPort
```

```powershell
# Terminal 3
cd 07_Mobile
npm.cmd start
```

Web: `http://localhost:5173`. Salud API: `http://localhost:4000/api/health`. Swagger: `http://localhost:4000/docs`. Metro usa normalmente 8081; seguir la dirección que informe la terminal. Para acceso desde teléfono, Backend debe ser alcanzable por LAN y la URL no puede ser `localhost`. Revisar red y reglas existentes con el responsable; no abrir puertos ni cambiar permisos automáticamente. Reiniciar Metro después de cambiar su configuración cliente.

Ingresar con la cuenta propia. Logística registra, recibe y despacha; Jefe de Laboratorio recibe y asigna; Técnico Lab trabaja las OS asignadas; QA recibe, prueba y dictamina; Terreno reporta, retira e instala su trabajo. Admin administra usuarios y consulta; Gerente consulta. La autorización efectiva está en Backend y no depende de ocultar botones.

Los arranques están revisados en sus scripts. Durante este cierre se comprobaron la API con identidad/BD simuladas y la compilación de clientes; no se repitió el arranque conectado a los servicios habituales ni el login real.

## Pruebas y compilación seguras

Desde la raíz, los siguientes comandos no preparan datos de negocio. Los destinos inválidos refuerzan el aislamiento Backend; sus pruebas HTTP usan servidores locales efímeros y mocks de PostgreSQL/Firebase.

```powershell
Push-Location 03_Backend/pmp-api
$env:DATABASE_URL='postgresql://isolated:isolated@127.0.0.1:1/isolated'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:1'
npm.cmd test
Remove-Item Env:DATABASE_URL,Env:FIREBASE_AUTH_EMULATOR_HOST
Pop-Location
Push-Location 04_Frontend
npm.cmd test
npm.cmd run build
Pop-Location
Push-Location 07_Mobile
npm.cmd test
$env:EXPO_NO_DOTENV='1'
$env:EXPO_OFFLINE='1'
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:1/api'
& ./node_modules/.bin/expo.cmd export --platform ios --platform android
Remove-Item Env:EXPO_NO_DOTENV,Env:EXPO_OFFLINE,Env:EXPO_PUBLIC_API_URL
Pop-Location
```

Ejecutarlos en una terminal dedicada para no reemplazar variables de otra sesión. El build Web usa `.env`; para compartir un build de prueba, configurar valores ficticios de Firebase/API en el proceso. En esta revisión ambos bundles se generaron con destino temporal y API ficticia; Expo se ejecutó sin red y sin cargar `.env`. Ningún bundle generado acredita ejecución en dispositivo.

Mobile reutiliza todos los casos de `04_Frontend/test/requirements.frontend.test.mjs`, además de sus suites `settings` y `ui`: requiere también las dependencias Web. Sus totales incluyen casos compartidos y no deben sumarse como cobertura única. No existe script `lint`; TypeScript y las suites no equivalen a lint. Los ejecutores `verification/*.mjs` y `*.browser.mjs` tienen precondiciones propias y no forman parte de estos comandos. Revisarlos antes de usarlos; algunos necesitan instancias efímeras, fixtures o baselines que esta copia no contiene.

## Resultados y pendientes — 18 de octubre de 2026

Revisión limitada a `PMP_Suite_V2.0`: contratos de mocks, inventario de pruebas, suites completas declaradas y compilación/exportación. No se consultó Tesis, no se alteraron pruebas o aserciones y no se ejecutaron ciclos, migraciones, login real ni escrituras sobre la BD habitual. PostgreSQL y Firebase se aislaron con mocks y destinos de prueba `127.0.0.1:1`; los resultados de esta sección corresponden a esta ejecución, no a evidencias antiguas.

| Comprobación | Aprobadas | Fallidas | Omitidas | Alcance |
|---|---:|---:|---:|---|
| Backend, `npm.cmd test` | 125 | 0 | 0 | Los 15 archivos `*.test.js` declarados |
| Web, `npm.cmd test` | 285 | 0 | 0 | Los 16 archivos `*.test.mjs` declarados |
| Mobile, `npm.cmd test` | 210 | 0 | 0 | Los 3 archivos `*.test.mjs` declarados; incluye casos compartidos con Web |
| Web, `npm.cmd run build -- --outDir <temporal>` | Correcto | — | — | TypeScript y Vite, API/Firebase cliente ficticios |
| Expo, `expo export --platform ios --platform android --output-dir <temporal>` | Ambas plataformas | — | — | Offline, sin cargar `.env`, API ficticia; bundles Hermes, no compilación nativa |

Cero cancelaciones y cero casos TODO en las suites. No quedaron archivos `*.test.*` fuera de los scripts declarados. No se suman sus totales como cobertura única.

**Causa de los fallos anteriores.** El mock nativo compartido de `04_Frontend/test/requirements.frontend.test.mjs` carecía de `useAuth`, que sí exporta `07_Mobile/src/context/AuthContext.js` y consume `AssetHistoryScreen`. El mock de reportes carecía de `usersReport`, exportado realmente por `04_Frontend/src/utils/pageReports.ts` y requerido por `AdminUsersPage`. Ambas omisiones impedían importar componentes y registrar los casos siguientes. La versión encontrada ya contiene las dos correcciones: `useAuth()` devuelve el usuario/estado necesarios para esos escenarios y `usersReport(q, disabled)` respeta la forma del contrato de reporte. Las suites confirman que esos fallos ya no se reproducen; no fue necesario volver a modificar mocks ni código funcional.

**210 frente a 172 Mobile.** El comando anterior explícito y el actual `npm.cmd test` incluyen exactamente `test/operational-regression.test.mjs`, `test/settings.test.mjs` y `test/ui.test.mjs`. El desglose ejecutado por archivo es **136 + 39 + 35 = 210**. `operational-regression` importa directamente toda la suite Web de requerimientos. El registro local del 14-10 en `Documentacion Capstone/ESTADO_Y_PENDIENTES.md` documenta que las 172 entradas anteriores fueron 171 aprobadas y una entrada de archivo fallida por `usersReport`: faltaban registrar 39 casos, no archivos; 171 + 39 = 210 al desaparecer esa entrada fallida. Esta explicación histórica se contrasta con el registro conservado y el inventario/comando actuales; no se reabrieron los logs excluidos ni el proyecto original. La ejecución vigente cubre la suite automatizada declarada completa.

### Pendientes y límites de esta revisión

- **Persistencia Firebase Mobile, defecto funcional separado:** `src/services/firebase.js` usa `getAuth(app)` sin persistencia React Native. El SDK instalado confirma que ese camino conserva la sesión solo en memoria y emite el aviso adjunto. AsyncStorage ya está declarado e instalado; falta integrarlo en la inicialización de Auth. No se cambió autenticación en esta tarea.
- **Safe Area:** el aviso global de sesión se renderiza fuera del encabezado nativo y el contenedor de `App.js` excluye el borde superior. Esto coincide con el solapamiento de la captura. Las pruebas con primitivas nativas simuladas no acreditan esa geometría en iPhone; corrección y comprobación física pendientes.
- **Conexión y enlace Expo:** «Sin conexión» procede del manejo de errores de red de la API y no demuestra que falle la contraseña. El aviso de redirect `custom/ios` corresponde al middleware de Expo cuando no obtiene destino para el cliente de desarrollo; es independiente de `useAuth`/`usersReport`. Falta comprobar la URL LAN/API y el cliente instalado en el teléfono; no se alteraron servicios ni configuración.
- **Cobertura adicional:** no se ejecutaron `visual.browser.mjs`, escenarios E2E de `verification` ni pruebas físicas de sesión, cámara, QR, PoD, teclado o navegación. Son comprobaciones aparte de los 210 casos, no pruebas omitidas por el ejecutor. Los mocks sustituyen Firebase y geometría nativa; las suites aprobadas no cierran esos pendientes.
- **Word:** el README recibido ya estaba en UTF-8 sin caracteres de sustitución ni texto dañado detectado en sus referencias a Word. Este resumen conserva las tildes correctas. No se modificaron ni renderizaron documentos académicos; su revisión anterior no se presenta como realizada ahora.

Único archivo editado en esta tarea: `README.md`, en este resumen de resultados y pendientes. Se retiraron las salidas temporales de compilación/exportación; no se generaron informes adicionales.

## Problemas frecuentes

| Síntoma | Comprobación |
|---|---|
| API no inicia | Ejecutar desde `03_Backend/pmp-api`, comprobar Node, puerto y existencia de la ruta privada Admin, sin imprimir la clave. |
| Web no conecta / 404 | `VITE_CORE_URL` apunta a la raíz de API, sin `/api`; reiniciar Vite tras modificar `.env`. |
| Mobile no conecta | API con sufijo `/api`, IP LAN vigente, misma red y cliente compatible. El teléfono no comparte el `localhost` del PC. |
| 401 | Sesión ausente, vencida o revocada: reautenticar con la cuenta propia. |
| 403 o `IDENTITY_CONFLICT` | Revisar usuario activo, rol y vínculo único UID/correo con el administrador. No cambiar permisos para eludir el error. |
| 409 / evidencia inválida | Consultar custodia y ciclo actuales; obtener evidencia del propósito correcto antes de confirmar. Escanear no confirma el movimiento. |
| IA 503 | Verificar el venv en la ruta indicada, `pip check` y conectividad autorizada de PostgreSQL. No interpretar el error como ausencia de fallas. |
| Datos vacíos al instalar | El esquema no incluye catálogos ni usuarios; resolver la preparación independiente antes de probar el flujo. |
| `spawn EPERM` en pruebas | El ejecutor puede impedir procesos hijos. Usar una terminal local autorizada; no cambiar código ni omitir pruebas para evitar el bloqueo. |

Para continuar el cierre y preparar la presentación, consultar únicamente el [resumen vigente](Documentacion%20Capstone/ESTADO_Y_PENDIENTES.md) y los cinco Word de cascada. Las evidencias históricas de Tesis no son resultados de esta revisión.

## Ubicación de esta entrega en GitHub

El código vigente se publica en `Fase 2/Evidencia Proyecto/Evidencia del Sistema`. Los nueve documentos técnicos de la entrega están en la carpeta hermana [Evidencias Documentacion](../Evidencias%20Documentacion/). Las evidencias grupales, individuales y planillas de evaluación se conservan directamente en [Fase 2](../../).

La publicación actual no incorpora los archivos `.env`, el respaldo de datos local, la guía con contraseñas ni el ZIP privado. Las referencias a ese material requieren entrega privada coordinada. Los ejemplos de configuración no contienen las credenciales necesarias para arrancar. Publicar el código no acredita una nueva ejecución de pruebas ni un despliegue.
