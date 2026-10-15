import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useOutletContext } from "react-router-dom";
import type { Me } from "./api/me";
import { PERMISSIONS, ROLES, type Permission } from "./app/rbac";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

const LabWorkPage = lazy(() => import("./pages/LabWorkPage"));
const WarehouseOperationPage = lazy(() => import("./pages/WarehouseOperationPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const RoleDashboardPage = lazy(() => import("./pages/RoleDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const IngresoOSPage = lazy(() => import("./pages/IngresoOSPage"));
const IngresoRequerimientosPage = lazy(() => import("./pages/IngresoRequerimientosPage"));
const RetirosTerrenoPage = lazy(() => import("./pages/RetirosTerrenoPage"));
const GestionActivosPage = lazy(() => import("./pages/GestionActivosPage"));
const DespachoEscaneoPage = lazy(() => import("./pages/DespachoEscaneoPage"));
const OrdenesServicioPage = lazy(() => import("./pages/OrdenesServicioPage"));
const MyServiceOrdersPage = lazy(() => import("./pages/MyServiceOrdersPage"));
const AdminDespachoPage = lazy(() => import("./pages/AdminDespachoPage"));
const TrazabilidadPage = lazy(() => import("./pages/TrazabilidadPage"));
const AIPredictionsPage = lazy(() => import("./pages/AIPredictionsPage"));
const LabReceptionPage = lazy(() => import('./pages/LabReceptionPage'));
const LabCustodyPage = lazy(() => import('./pages/LabCustodyPage'));
const LabDashboardPage = lazy(() => import("./pages/LabDashboardPage"));
const LabAsignacionPage = lazy(() => import("./pages/LabAsignacionPage"));
const LabValidadoresPage = lazy(() => import("./pages/LabValidadoresPage"));
const LabConsolasPage = lazy(() => import("./pages/LabConsolasPage"));
const LabReportesPage = lazy(() => import("./pages/LabReportesPage"));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const LabDespachoQaPage = lazy(() => import("./pages/LabDespachoQaPage"));
const QaWorkPage = lazy(() => import("./pages/QaWorkPage"));
const QaPage = lazy(() => import("./pages/QaPage"));
const BodegaPage = lazy(() => import("./pages/BodegaPage"));
const BodegaModulosPage = lazy(() => import("./pages/BodegaModulosPage"));
const BodegaRepuestosPage = lazy(() => import("./pages/BodegaRepuestosPage"));
const BodegaDashboardPage = lazy(() => import("./pages/BodegaDashboardPage"));
const EquiposOperativosPage = lazy(() => import("./pages/EquiposOperativosPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));
const BridgeFlowPage = lazy(() => import("./pages/BridgeFlowPage"));
const EquipmentScanPage = lazy(() => import("./pages/EquipmentScanPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function Guarded({ permission, children }: { permission: Permission; children: ReactNode }) {
  return <ProtectedRoute permission={permission}>{children}</ProtectedRoute>;
}

function RootRedirector() {
  const me = useOutletContext<Me | null>();
  if (me?.rol === ROLES.TECNICO_LABORATORIO || me?.rol === ROLES.TECNICO_TERRENO || me?.rol === ROLES.QA) return <Navigate to="/mi-jornada" replace />;
  if (me?.rol === ROLES.JEFE_LABORATORIO) return <Navigate to="/lab/dashboard" replace />;
  if (me?.rol === ROLES.LOGISTICA) return <Navigate to="/bodega/dashboard" replace />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <Suspense fallback={<div className="page-loader" role="status" aria-live="polite"><span className="page-loader-mark" /><span>Cargando módulo…</span></div>}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Guarded permission={PERMISSIONS.DASHBOARD_VIEW}><RootRedirector /></Guarded>} />
        <Route path="/mi-jornada" element={<Guarded permission={PERMISSIONS.PERSONAL_DASHBOARD_VIEW}><RoleDashboardPage /></Guarded>} />

        <Route path="/admin/users" element={<Guarded permission={PERMISSIONS.USERS_VIEW}><AdminUsersPage /></Guarded>} />
        <Route path="/admin/despacho" element={<Guarded permission={PERMISSIONS.DISPATCH_OPERATIONS_VIEW}><AdminDespachoPage /></Guarded>} />

        <Route path="/operacion/os" element={<Guarded permission={PERMISSIONS.OS_VIEW}><OrdenesServicioPage /></Guarded>} />
        <Route path="/operacion/mis-os" element={<Guarded permission={PERMISSIONS.MY_OS_VIEW}><MyServiceOrdersPage /></Guarded>} />
        <Route path="/operacion/ingreso" element={<Guarded permission={PERMISSIONS.OS_CREATE}><IngresoOSPage /></Guarded>} />
        <Route path="/operacion/requerimientos" element={<Guarded permission={PERMISSIONS.REQUEST_CREATE}><IngresoRequerimientosPage /></Guarded>} />
        <Route path="/operacion/retiros" element={<Guarded permission={PERMISSIONS.WITHDRAWAL_ASSIGN}><RetirosTerrenoPage /></Guarded>} />
        <Route path="/operacion/activos" element={<Guarded permission={PERMISSIONS.ASSET_MANAGE}><GestionActivosPage /></Guarded>} />
        <Route path="/operacion/escaneo" element={<Guarded permission={PERMISSIONS.EQUIPMENT_SCAN_VIEW}><EquipmentScanPage /></Guarded>} />
        <Route path="/bridge" element={<Guarded permission={PERMISSIONS.BRIDGE_FLOW_VIEW}><BridgeFlowPage /></Guarded>} />

        <Route path="/mi-carga/:osId" element={<Guarded permission={PERMISSIONS.LAB_WRITE}><LabWorkPage /></Guarded>} />
        <Route path="/bodega/recepciones/:osId" element={<Guarded permission={PERMISSIONS.BODEGA_WRITE}><WarehouseOperationPage purpose="receipt" /></Guarded>} />
        <Route path="/bodega/envios-laboratorio/:osId" element={<Guarded permission={PERMISSIONS.BODEGA_WRITE}><WarehouseOperationPage purpose="lab" /></Guarded>} />
        <Route path="/bodega/envios-qa/:osId" element={<Guarded permission={PERMISSIONS.BODEGA_WRITE}><WarehouseOperationPage purpose="qa" /></Guarded>} />
        <Route path="/lab/custodia/:osId/:step" element={<Guarded permission={PERMISSIONS.LAB_DISPATCH}><LabCustodyPage /></Guarded>} />
        <Route path="/lab/recepcion" element={<Guarded permission={PERMISSIONS.REPORTS_VIEW}><LabReceptionPage /></Guarded>} />
        <Route path="/lab/dashboard" element={<Guarded permission={PERMISSIONS.LAB_VIEW}><LabDashboardPage /></Guarded>} />
        <Route path="/lab/asignacion" element={<Guarded permission={PERMISSIONS.LAB_ASSIGN}><LabAsignacionPage /></Guarded>} />
        <Route path="/lab/validadores" element={<Guarded permission={PERMISSIONS.LAB_EQUIPMENT_VIEW}><LabValidadoresPage /></Guarded>} />
        <Route path="/lab/consolas" element={<Guarded permission={PERMISSIONS.LAB_EQUIPMENT_VIEW}><LabConsolasPage /></Guarded>} />
        <Route path="/lab/reportes" element={<Guarded permission={PERMISSIONS.REPORTS_VIEW}><LabReportesPage /></Guarded>} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/lab/despacho-qa" element={<Guarded permission={PERMISSIONS.LAB_DISPATCH}><LabDespachoQaPage /></Guarded>} />

        <Route path="/qa" element={<Guarded permission={PERMISSIONS.QA_SUMMARY_VIEW}><QaPage /></Guarded>} />
        <Route path="/qa/:osId/:step" element={<Guarded permission={PERMISSIONS.QA_SUMMARY_VIEW}><QaWorkPage /></Guarded>} />
        <Route path="/bodega" element={<Guarded permission={PERMISSIONS.BODEGA_OPERATIONS_VIEW}><BodegaPage /></Guarded>} />
        <Route path="/bodega/dashboard" element={<Guarded permission={PERMISSIONS.BODEGA_VIEW}><BodegaDashboardPage /></Guarded>} />
        <Route path="/bodega/modulos" element={<Guarded permission={PERMISSIONS.BODEGA_OPERATIONS_VIEW}><BodegaModulosPage /></Guarded>} />
        <Route path="/bodega/despacho" element={<Guarded permission={PERMISSIONS.BODEGA_WRITE}><DespachoEscaneoPage /></Guarded>} />
        <Route path="/bodega/repuestos" element={<Guarded permission={PERMISSIONS.BODEGA_OPERATIONS_VIEW}><BodegaRepuestosPage /></Guarded>} />

        <Route path="/equipos-operativos" element={<Guarded permission={PERMISSIONS.EQUIPOS_VIEW}><EquiposOperativosPage /></Guarded>} />
        <Route path="/trazabilidad" element={<Guarded permission={PERMISSIONS.TRACE_VIEW}><TrazabilidadPage /></Guarded>} />
        <Route path="/ia/predicciones" element={<Guarded permission={PERMISSIONS.AI_VIEW}><AIPredictionsPage /></Guarded>} />
        <Route path="/settings" element={<Guarded permission={PERMISSIONS.SETTINGS_VIEW}><SettingsPage /></Guarded>} />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
