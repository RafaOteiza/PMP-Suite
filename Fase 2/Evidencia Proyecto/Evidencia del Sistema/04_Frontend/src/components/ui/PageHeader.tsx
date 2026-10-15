import type { ReactNode } from "react";
import type {ExcelReport} from '../../utils/excelReport';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  report?: ExcelReport;
}

export default function PageHeader({ title, description, eyebrow, icon, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <svg className="page-header-circuit" viewBox="0 0 660 132" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path className="header-circuit-rail" d="M12 110H164L208 66H292L328 96H436L478 82H642" />
          <path className="header-circuit-rail header-circuit-rail--upper" d="M94 14H238L266 38H394L420 14H594" />
          <path className="header-circuit-rail header-circuit-rail--lower" d="M204 132H350L376 110H536L562 84H660" />
          <path className="header-circuit-signal" pathLength="100" d="M12 110H164L208 66H292L328 96H436L478 82H642" />
          <path className="header-circuit-signal header-circuit-signal--upper" pathLength="100" d="M94 14H238L266 38H394L420 14H594" />
        </g>
        <g className="header-circuit-nodes">
          <circle className="header-circuit-node header-circuit-node--blue" cx="208" cy="66" r="9" />
          <circle className="header-circuit-node header-circuit-node--teal" cx="378" cy="96" r="9" />
          <circle className="header-circuit-node header-circuit-node--white" cx="554" cy="82" r="9" />
          <circle className="header-circuit-terminal" cx="594" cy="14" r="4" />
          <circle className="header-circuit-terminal" cx="642" cy="82" r="4" />
        </g>
      </svg>
      <div className="page-heading">
        {icon ? <div className="page-heading-icon" aria-hidden="true">{icon}</div> : null}
        <div>
          {eyebrow ? <div className="dashboard-eyebrow">{eyebrow}</div> : null}
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
