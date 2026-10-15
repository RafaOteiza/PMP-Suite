import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Me } from "../api/me";
import { getBadgeCounts, type BadgeCounts } from "../api/badges";
import { getActiveNavigationRoute, getNavigationForUser, type NavigationIcon } from "../app/navigation";
import { ROLES } from "../app/rbac";
import {
  Brain, CheckCircle, ChevronLeft, Cpu, FileBarChart, LayoutDashboard,
  Microscope, Monitor, Package, PlusSquare, Search, ShieldCheck, Users,
  ScanBarcode, Wrench, Workflow
} from "lucide-react";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="badge">{count > 99 ? "99+" : count}</span>;
}

const ICONS: Record<NavigationIcon, React.ReactNode> = {
  dashboard: <LayoutDashboard size={18} />,
  orders: <FileBarChart size={18} />,
  add: <PlusSquare size={18} />,
  equipment: <Cpu size={18} />,
  trace: <Search size={18} />,
  bridge: <Workflow size={18} />,
  scanner: <ScanBarcode size={18} />,
  users: <ShieldCheck size={18} />,
  dispatch: <Package size={18} />,
  lab: <Microscope size={18} />,
  assign: <Users size={18} />,
  validator: <Cpu size={18} />,
  console: <Monitor size={18} />,
  reports: <FileBarChart size={18} />,
  qa: <CheckCircle size={18} />,
  warehouse: <Package size={18} />,
  inventory: <Cpu size={18} />,
  parts: <Wrench size={18} />,
  ai: <Brain size={18} />
};

interface MenuLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}

function MenuLink({ to, icon, label, badge, active, collapsed, onNavigate }: MenuLinkProps) {
  return (
    <Link
      to={to}
      className={`sb-link ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      {icon}<span>{label}</span>{badge !== undefined ? <Badge count={badge} /> : null}
    </Link>
  );
}

interface SidebarProps {
  me: Me | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onNavigate: () => void;
}

export default function Sidebar({ me, collapsed, mobileOpen, onToggleCollapse, onNavigate }: SidebarProps) {
  const location = useLocation();
  const [badges, setBadges] = useState<BadgeCounts|null>(null);
  const navigation = useMemo(() => getNavigationForUser(me), [me]);
  const activeRoute = useMemo(() => getActiveNavigationRoute(location.pathname, navigation), [location.pathname, navigation]);
  const showOperationalBadges = me?.rol === ROLES.ADMIN || me?.rol === ROLES.LOGISTICA;

  useEffect(() => {
    if (!me || !showOperationalBadges) return;
    let active = true;
    const load = async () => {
      try {
        const counts = await getBadgeCounts();
        if (active) setBadges(counts);
      } catch (error) {
        if(active)setBadges(null);
      }
    };
    void load();
    window.addEventListener('pmp:warehouse-queue-updated',load);
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('pmp:warehouse-queue-updated',load); };
  }, [me, showOperationalBadges]);

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`} aria-label="Navegación principal">
      <div className="sb-brand">
        <div className="sb-brand-assets">
          <img className="sb-brand-logo-expanded" src="/brand/logo-horizontal-dark.svg" alt="PMP Suite" draggable="false" />
          <img className="sb-brand-logo-collapsed" src="/brand/isotipo-dark.svg" alt="PMP Suite" draggable="false" />
        </div>
        <button className="sb-collapse" onClick={onToggleCollapse} aria-expanded={!collapsed} aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"} title={collapsed ? "Expandir" : "Contraer"}>
          <ChevronLeft size={17} className={collapsed ? "is-rotated" : undefined} />
        </button>
      </div>

      <nav className="sb-nav">
        {navigation.map((section) => (
          <div className="sb-section" key={section.id}>
            <div className="sb-section-title">{section.label}</div>
            {section.items.map((item) => (
              <MenuLink
                key={item.id}
                to={item.route}
                icon={ICONS[item.icon]}
                label={item.label}
                badge={showOperationalBadges && item.badge ? badges?.[item.badge] : undefined}
                active={item.route === activeRoute}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
