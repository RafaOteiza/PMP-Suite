import { can, getUserRole, PERMISSIONS, ROLES, type Permission, type RbacUser, type Role } from "./rbac";

export type NavigationIcon =
  | "dashboard" | "orders" | "add" | "equipment" | "trace" | "bridge"
  | "scanner"
  | "users" | "dispatch" | "lab" | "assign" | "validator" | "console"
  | "reports" | "qa" | "warehouse" | "inventory" | "parts" | "ai";

export type NavigationBadge = "lab" | "lab_dispatch" | "bodega" | "qa";

export interface NavigationItem {
  id: string;
  label: string;
  route: string;
  icon: NavigationIcon;
  capability: Permission;
  badge?: NavigationBadge;
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
}

export function getActiveNavigationRoute(pathname: string, navigation: readonly NavigationSection[]): string | undefined {
  const custodyStep = pathname.match(/^\/lab\/custodia\/[^/]+\/(recepcion|salida)\/?$/)?.[1];
  if (custodyStep) {
    const parent = custodyStep === "recepcion" ? "/lab/recepcion" : "/lab/despacho-qa";
    return navigation.some(section => section.items.some(item => item.route === parent)) ? parent : undefined;
  }
  if((pathname==="/admin/despacho"||pathname.startsWith("/admin/despacho/")))return navigation.flatMap(s=>s.items).find(i=>i.id==="lab-dispatch")?.route;
  if(pathname==="/operacion/escaneo" && navigation.flatMap(s=>s.items).some(i=>i.id==="lab-reception"))return "/lab/recepcion";
  if(pathname==="/mi-jornada" && navigation.flatMap(s=>s.items).some(i=>i.label==="Mi trabajo QA"))return "/qa";
  if(pathname.startsWith("/mi-carga/"))return "/mi-jornada";
  return navigation
    .flatMap((section) => section.items)
    .filter((item) => pathname === item.route || (item.route !== "/" && pathname.startsWith(`${item.route}/`)))
    .sort((a, b) => b.route.length - a.route.length)[0]?.route;
}

interface NavigationDefinition extends Omit<NavigationItem, "label" | "route"> {
  label: string;
  labels?: Partial<Record<Role, string>>;
  route: string;
  routes?: Partial<Record<Role, string>>;
}

interface SectionDefinition {
  id: string;
  label: string;
  items: readonly NavigationDefinition[];
}

const DEFINITIONS: readonly SectionDefinition[] = [
  {
    id: "general",
    label: "General",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        labels: {
          [ROLES.GERENTE]: "Dashboard ejecutivo",
          [ROLES.ADMIN]: "Dashboard operativo",
          [ROLES.LOGISTICA]: "Dashboard logística",
          [ROLES.TECNICO_TERRENO]: "Mi jornada",
          [ROLES.TECNICO_LABORATORIO]: "Mi carga",
          [ROLES.QA]: "Mi trabajo QA"
        },
        route: "/",
        routes: {
          [ROLES.LOGISTICA]: "/bodega/dashboard",
          [ROLES.TECNICO_TERRENO]: "/mi-jornada",
          [ROLES.TECNICO_LABORATORIO]: "/mi-jornada",
          [ROLES.QA]: "/qa"
        },
        icon: "dashboard",
        capability: PERMISSIONS.DASHBOARD_VIEW
      },
      { id: "orders", label: "Órdenes de servicio", route: "/operacion/os", icon: "orders", capability: PERMISSIONS.OS_VIEW },
      { id: "my-orders", label: "Mis OS", route: "/operacion/mis-os", icon: "orders", capability: PERMISSIONS.MY_OS_VIEW },
      { id: "new-order", label: "Reportar falla", route: "/operacion/ingreso", icon: "add", capability: PERMISSIONS.OS_CREATE },
      { id: "new-request", label: "Ingreso de requerimientos", route: "/operacion/requerimientos", icon: "add", capability: PERMISSIONS.REQUEST_CREATE },
      { id: "terrain-withdrawals", label: "Retiros de terreno", route: "/operacion/retiros", icon: "assign", capability: PERMISSIONS.WITHDRAWAL_ASSIGN },
      { id: "asset-master", label: "Gestión de activos", route: "/operacion/activos", icon: "equipment", capability: PERMISSIONS.ASSET_MANAGE },
      {
        id: "equipment",
        label: "Equipos en operación",
        route: "/equipos-operativos",
        icon: "equipment",
        capability: PERMISSIONS.EQUIPOS_VIEW
      },
      { id: "trace", label: "Trazabilidad", route: "/trazabilidad", icon: "trace", capability: PERMISSIONS.TRACE_VIEW },
      {
        id: "equipment-scan",
        label: "Estación de escaneo",
        labels: {
          [ROLES.GERENTE]: "Consulta de identificadores",
          [ROLES.ADMIN]: "Recepción laboratorio",
          [ROLES.LOGISTICA]: "Escaneo en bodega",
          [ROLES.TECNICO_LABORATORIO]: "Escaneo laboratorio",
          [ROLES.QA]: "Escaneo QA"
        },
        route: "/operacion/escaneo",
        icon: "scanner",
        capability: PERMISSIONS.EQUIPMENT_SCAN_VIEW
      },
      {
        id: "bridge",
        label: "Bridge · Referencias externas",
        route: "/bridge",
        icon: "bridge",
        capability: PERMISSIONS.BRIDGE_WORKSPACE_VIEW
      }
    ]
  },
  {
    id: "administration",
    label: "Administración",
    items: [
      { id: "users", label: "Usuarios", route: "/admin/users", icon: "users", capability: PERMISSIONS.USERS_VIEW },
      { id: "dispatch", label: "Control de salida", route: "/admin/despacho", icon: "dispatch", capability: PERMISSIONS.DISPATCH_OPERATIONS_VIEW, badge: "lab_dispatch" }
    ]
  },
  {
    id: "laboratory",
    label: "Laboratorio",
    items: [
      { id: "lab-summary", label: "Resumen laboratorio", route: "/lab/dashboard", icon: "lab", capability: PERMISSIONS.LAB_VIEW, badge: "lab" },
      { id: "lab-assign", label: "Asignar carga", route: "/lab/asignacion", icon: "assign", capability: PERMISSIONS.LAB_ASSIGN },
      { id: "lab-dispatch", label: "Despacho a bodega", route: "/lab/despacho-qa", icon: "dispatch", capability: PERMISSIONS.LAB_DISPATCH },
      { id: "lab-validators", label: "Validadores", route: "/lab/validadores", icon: "validator", capability: PERMISSIONS.LAB_EQUIPMENT_VIEW },
      { id: "lab-consoles", label: "Consolas", route: "/lab/consolas", icon: "console", capability: PERMISSIONS.LAB_EQUIPMENT_VIEW },
      { id: "lab-reports", label: "Reportes", route: "/lab/reportes", icon: "reports", capability: PERMISSIONS.REPORTS_VIEW }
    ]
  },
  {
    id: "quality",
    label: "Calidad",
    items: [
      { id: "qa-summary", label: "Operación QA", route: "/qa", icon: "qa", capability: PERMISSIONS.QA_SUMMARY_VIEW, badge: "qa" }
    ]
  },
  {
    id: "logistics",
    label: "Logística",
    items: [
      { id: "warehouse-summary", label: "Resumen bodega", route: "/bodega/dashboard", icon: "warehouse", capability: PERMISSIONS.BODEGA_VIEW },
      { id: "warehouse-operations", label: "Recepciones y despachos", route: "/bodega", icon: "dispatch", capability: PERMISSIONS.BODEGA_OPERATIONS_VIEW, badge: "bodega" },
      { id: "warehouse-inventory", label: "Inventario de equipos", route: "/bodega/modulos", icon: "inventory", capability: PERMISSIONS.BODEGA_OPERATIONS_VIEW },
      { id: "warehouse-parts", label: "Repuestos y stock", route: "/bodega/repuestos", icon: "parts", capability: PERMISSIONS.BODEGA_OPERATIONS_VIEW }
    ]
  },
  {
    id: "intelligence",
    label: "Inteligencia operacional",
    items: [
      { id: "ai", label: "Análisis de fallas / IA", route: "/ia/predicciones", icon: "ai", capability: PERMISSIONS.AI_VIEW }
    ]
  }
];

export function getNavigationForUser(user: RbacUser): NavigationSection[] {
  const role = getUserRole(user);
  if (!role) return [];
  const usedRoutes = new Set<string>();

  const sections = DEFINITIONS.map((section) => ({
    id: section.id,
    label: section.label,
    items: section.items
      .filter((item) => can(user, item.capability) && !(role === ROLES.TECNICO_LABORATORIO && item.id === "lab-summary"))
      .map((item) => ({
        id: item.id,
        label: item.labels?.[role] ?? item.label,
        route: item.routes?.[role] ?? item.route,
        icon: item.icon,
        capability: item.capability,
        badge: role === ROLES.QA && item.id === "dashboard" ? "qa" as NavigationBadge : item.badge
      }))
      .filter((item) => {
        if (usedRoutes.has(item.route)) return false;
        usedRoutes.add(item.route);
        return true;
      })
  })).filter((section) => section.items.length > 0);
  const reports:NavigationSection={id:'reports',label:'Reportes',items:[
    {id:'report-center',label:'Centro de reportes',route:'/reportes',icon:'reports',capability:PERMISSIONS.DASHBOARD_VIEW},
    ...sections.flatMap(s=>s.items).filter(i=>i.id==='lab-reports').map(i=>({...i,label:'Indicadores de laboratorio'}))
  ]};
  const withReports=(groups:NavigationSection[])=>[
    ...groups.map(s=>({...s,items:s.items.filter(i=>i.id!=='lab-reports')})).filter(s=>s.items.length),
    ...([ROLES.ADMIN,ROLES.GERENTE,ROLES.JEFE_LABORATORIO,ROLES.LOGISTICA].some(value=>value===role)?[reports]:[])
  ];
  if(role===ROLES.QA){
    const secondary=sections.flatMap(s=>s.items).filter(i=>['trace','bridge','equipment-scan'].includes(i.id));
    return [...sections.map(s=>({...s,items:s.items.filter(i=>!secondary.includes(i))})).filter(s=>s.items.length),{id:'qa-consultas',label:'Consultas y herramientas',items:secondary}];
  }
  if(role===ROLES.ADMIN||role===ROLES.GERENTE||role===ROLES.JEFE_LABORATORIO){
    const items=sections.flatMap(s=>s.items).filter(i=>i.id!=='dispatch'&&i.id!=='equipment-scan');
    const group=(id:string,label:string,ids:string[]):NavigationSection=>({id,label,items:ids.flatMap(key=>items.filter(i=>i.id===key))});
    const reception:NavigationItem={id:'lab-reception',label:'Recepción de equipos',route:'/lab/recepcion',icon:'scanner',capability:PERMISSIONS.REPORTS_VIEW};
    if(role===ROLES.JEFE_LABORATORIO){
      const lab=group('laboratory','Gestión de Laboratorio',['lab-summary','lab-assign','lab-validators','lab-consoles','lab-dispatch','lab-reports']);lab.items.splice(1,0,reception);
      return withReports([lab,group('consultas','Antecedentes técnicos',['orders','equipment','trace']),group('intelligence','Inteligencia operacional',['ai'])]);
    }
    const lab=group('laboratory','Supervisión de Laboratorio',['lab-summary','lab-validators','lab-consoles']);lab.items.splice(1,0,reception);
    const result=[group('control','Centro de control',['dashboard','orders','equipment','trace','bridge','lab-reports']),lab,
      group('supervision','Supervisión operacional',['warehouse-summary','qa-summary'])];
    if(role===ROLES.ADMIN)result.push({...group('administration','Administración',['users']),items:[...items.filter(i=>i.id==='users'),{id:'settings',label:'Configuración autorizada',route:'/settings',icon:'users',capability:PERMISSIONS.SETTINGS_VIEW}]});
    result.push(group('intelligence','Inteligencia operacional',['ai']));
    return withReports(result.filter(s=>s.items.length).map(s=>({...s,items:s.items.map(i=>i.id==='dashboard'?{...i,label:role===ROLES.ADMIN?'Supervisión global':'Dashboard ejecutivo'}:i)})));
  }
  return withReports(sections);
}
