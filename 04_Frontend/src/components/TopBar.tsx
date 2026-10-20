import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Cpu, Menu, Monitor, Moon, Search, Sun } from "lucide-react";
import { toggleTheme } from "../app/theme";
import { can, PERMISSIONS, ROLES } from "../app/rbac";
import type { Me } from "../api/me";
import { api } from "../api/http";
import { assetHistoryUrl, type Asset } from "../api/bridge";
import { caseHistoryUrl, getCases, type OperationalCase } from "../api/requerimientos";

const UserMenu = lazy(() => import("./UserMenu"));

const pageTitles: Array<[RegExp, string, string]> = [
  [/^\/reportes/, "Reportes", "Centro de reportes"],
  [/^\/mi-carga\//, "Mi operación", "Trabajo técnico"],
  [/^\/bodega\/recepciones\//, "Bodega y logística", "Recepción en Bodega"],
  [/^\/bodega\/envios-laboratorio\//, "Bodega y logística", "Envío a Laboratorio"],
  [/^\/$/, "Centro de control", "Dashboard ejecutivo"],
  [/^\/mi-jornada/, "Mi operación", "Prioridades de la jornada"],
  [/^\/operacion\/os/, "Operación", "Órdenes de servicio"],
  [/^\/operacion\/mis-os/, "Terreno", "Mis órdenes de servicio"],
  [/^\/operacion\/ingreso/, "Operación", "Ingreso de OS"],
  [/^\/operacion\/requerimientos/, "Operación", "Ingreso de requerimientos"],
  [/^\/operacion\/retiros/, "Terreno", "Retiros de terreno"],
  [/^\/bridge/, "Correlación", "Bridge · Referencias externas"],
  [/^\/lab\/recepcion/, "Gestión de Laboratorio", "Recepción de equipos"],
  [/^\/lab\/custodia/, "Gestión de Laboratorio", "Custodia física"],
  [/^\/lab\/asignacion/, "Gestión de Laboratorio", "Gestión de carga"],
  [/^\/lab/, "Laboratorio", "Gestión técnica"],
  [/^\/qa/, "Calidad", "Certificación QA"],
  [/^\/bodega\/modulos/, "Logística", "Inventario de equipos"],
  [/^\/bodega\/despacho/, "Logística", "Despacho por escaneo"],
  [/^\/bodega/, "Logística", "Bodega y stock"],
  [/^\/admin\/users/, "Administración", "Usuarios y accesos"],
  [/^\/admin\/despacho/, "Administración", "Control de salida"],
  [/^\/equipos-operativos/, "Operación", "Equipos en operación"],
  [/^\/trazabilidad/, "Operación", "Trazabilidad"],
  [/^\/ia/, "Inteligencia operacional", "Análisis de fallas / IA"],
  [/^\/settings/, "Cuenta", "Seguridad personal"]
];

interface TopBarProps {
  me: Me | null;
  sidebarCollapsed: boolean;
  onOpenMenu: () => void;
  onToggleSidebar: () => void;
}

export default function TopBar({ me, sidebarCollapsed, onOpenMenu, onToggleSidebar }: TopBarProps) {
  const nav = useNavigate();
  const location = useLocation();
  const [receiptContext, setReceiptContext] = useState<{ routeKey: string; title: string } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [caseResults, setCaseResults] = useState<OperationalCase[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDark, setIsDark] = useState(() => (document.documentElement.getAttribute("data-theme") || "light") === "dark");
  const canGlobalSearch = can(me, PERMISSIONS.TRACE_VIEW);

  useEffect(() => {
    const updateReceiptTitle = (event: Event) => {
      setReceiptContext((event as CustomEvent<{ routeKey: string; title: string }>).detail);
    };
    window.addEventListener("pmp:warehouse-reception-title", updateReceiptTitle);
    return () => window.removeEventListener("pmp:warehouse-reception-title", updateReceiptTitle);
  }, []);

  useEffect(() => {
    if (!canGlobalSearch) {
      setResults([]);
      setCaseResults([]);
      setShowDropdown(false);
      return;
    }
    const normalized = query.trim();
    if (!normalized) {
      setResults([]);
      setCaseResults([]);
      setShowDropdown(false);
      return;
    }
    const controller = new AbortController();
    const delayDebounceFn = window.setTimeout(async () => {
      try {
        const [response, cases] = await Promise.all([api.get("/api/dashboard/global-search", { params: { q: normalized }, signal: controller.signal }), me?.rol===ROLES.JEFE_LABORATORIO?Promise.resolve([]):getCases(normalized, controller.signal)]);
        if (controller.signal.aborted) return;
        setResults(response.data);
        setCaseResults(cases);
        setShowDropdown(true);
      } catch {
        if (!controller.signal.aborted) { setResults([]); setCaseResults([]); }
      }
    }, 400);
    return () => { controller.abort(); window.clearTimeout(delayDebounceFn); };
  }, [query, canGlobalSearch, me?.rol]);

  const displayName = useMemo(() => {
    if (!me) return "Sesión";
    const full = `${me.nombre ?? ""} ${me.apellido ?? ""}`.trim();
    return full || me.correo || "Sesión";
  }, [me]);

  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PS";
  }, [displayName]);

  const context = pageTitles.find(([pattern]) => pattern.test(location.pathname)) ?? [/.*/, "PMP Suite", "Operación logística"];
  const section = context[1];
  const pageTitle = /^\/bodega\/recepciones\//.test(location.pathname) && receiptContext?.routeKey === location.key
    ? receiptContext.title
    : location.pathname === "/" && me?.rol === ROLES.ADMIN ? "Supervisión global" : context[2];

  const changeTheme = () => {
    toggleTheme();
    setIsDark((document.documentElement.getAttribute("data-theme") || "light") === "dark");
  };

  const openResult = (asset: Asset) => {
    setQuery("");
    setShowDropdown(false);
    nav(assetHistoryUrl(asset));
  };

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button
          className="icon-btn topbar-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Expandir navegación" : "Contraer navegación"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expandir navegación" : "Contraer navegación"}
        >
          <Menu size={19} />
        </button>
        <button className="icon-btn topbar-mobile-menu" onClick={onOpenMenu} aria-label="Abrir navegación"><Menu size={19} /></button>

        <div className="topbar-context">
          <span className="topbar-eyebrow">{section}</span>
          <span className="topbar-context-divider" aria-hidden="true">/</span>
          <span className="topbar-title">{pageTitle}</span>
        </div>
      </div>

      {canGlobalSearch ? <div className="search topbar-search">
        <Search size={17} aria-hidden="true" />
        <input
          placeholder="Buscar serie, OS PMP u OS Aranda…"
          maxLength={120}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query && setShowDropdown(true)}
          onBlur={() => window.setTimeout(() => setShowDropdown(false), 160)}
          aria-label="Búsqueda global"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
        />
        {!query ? <span className="search-shortcut" aria-hidden="true">GLOBAL</span> : null}
        {showDropdown ? (
          <div className="search-dropdown" id="global-search-results" role="listbox">
            {!results.some(asset=>asset.serie.toUpperCase()===query.trim().toUpperCase()) && caseResults.map(result => <button key={`case:${result.id}`} className="search-result" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(''); setShowDropdown(false); nav(caseHistoryUrl(result.id)); }}><span className="search-result-body"><strong>Caso {result.codigo_caso}</strong><span className="search-result-meta">{result.bus_ppu} · Ver todas las intervenciones relacionadas</span></span></button>)}
            {results.length === 0 && caseResults.length === 0 ? (
              <div className="search-empty">Sin resultados para “{query}”</div>
            ) : results.map((result) => (
              <button
                key={`${result.tipo_equipo}:${result.serie}`}
                className="search-result"
                role="option"
                aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => openResult(result)}
              >
                <span className="search-result-icon">
                  {result.tipo_equipo === "VALIDADOR" ? <Cpu size={18} /> : <Monitor size={18} />}
                </span>
                <span className="search-result-body">
                  <span className="search-result-row">
                    <strong>Serie {result.serie}</strong>
                  </span>
                  <span className="search-result-meta">{result.tipo_equipo} · Ver historial completo</span>
                </span>
              </button>
            ))}
            {results.some(asset=>asset.serie.toUpperCase()===query.trim().toUpperCase()) && caseResults.map(result => <button key={`case:${result.id}`} className="search-result" role="option" aria-selected="false" onMouseDown={event=>event.preventDefault()} onClick={()=>{setQuery('');setShowDropdown(false);nav(caseHistoryUrl(result.id));}}><span className="search-result-body"><strong>Caso {result.codigo_caso}</strong><span className="search-result-meta">Intervenciones relacionadas</span></span></button>)}
          </div>
        ) : null}
      </div> : <div className="topbar-search-spacer" aria-hidden="true" />}

      <div className="topbar-right">
        <button className="icon-btn" onClick={changeTheme} aria-label={isDark ? "Activar tema claro" : "Activar tema oscuro"} title={isDark ? "Tema claro" : "Tema oscuro"}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Suspense fallback={
          <div className="user-menu-placeholder" aria-hidden="true">
            <span className="user-avatar" aria-hidden="true">{initials}</span>
          </div>
        }>
          <UserMenu me={me} displayName={displayName} initials={initials} routeKey={location.pathname} />
        </Suspense>
      </div>
    </header>
  );
}
