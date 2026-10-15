import '../styles/admin-control.css';
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ReadOnlyNotice from "./ReadOnlyNotice";
import FeedbackBanner from "./ui/FeedbackBanner";
import { useSession } from "../app/SessionContext";
import { READ_ONLY_DENIED_EVENT, READ_ONLY_ROLE_MESSAGE } from "../api/errors";

export default function AppLayout() {
  const { me } = useSession();
  const [readOnlyError, setReadOnlyError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("pmp_sidebar") === "collapsed");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onReadOnlyDenied = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      setReadOnlyError(customEvent.detail?.message || READ_ONLY_ROLE_MESSAGE);
    };
    window.addEventListener(READ_ONLY_DENIED_EVENT, onReadOnlyDenied);
    return () => window.removeEventListener(READ_ONLY_DENIED_EVENT, onReadOnlyDenied);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("pmp_sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <Sidebar
        me={me}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onToggleCollapse={toggleSidebar}
        onNavigate={() => setMobileMenuOpen(false)}
      />
      <button
        className={`sidebar-backdrop ${mobileMenuOpen ? "is-visible" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-label="Cerrar navegación"
        tabIndex={mobileMenuOpen ? 0 : -1}
      />
      <div className="app-main">
        <TopBar
          me={me}
          sidebarCollapsed={sidebarCollapsed}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onToggleSidebar={toggleSidebar}
        />
        <main className={`app-content ${["admin","gerente","jefe_laboratorio"].includes(me?.rol||"")?"admin-workspace":""}`} id="main-content" tabIndex={-1}>
          <ReadOnlyNotice me={me} />
          {readOnlyError ? (
            <FeedbackBanner tone="warning" onDismiss={() => setReadOnlyError(null)}>
              <strong>Acción no disponible.</strong> {readOnlyError}
            </FeedbackBanner>
          ) : null}
          <Outlet context={me} />
        </main>
      </div>
    </div>
  );
}
