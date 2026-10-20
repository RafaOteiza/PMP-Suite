import { ArrowLeft, FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="system-state">
      <div className="system-state-icon"><FileQuestion size={28} aria-hidden="true" /></div>
      <div className="system-state-code">Error 404</div>
      <h1>Página no encontrada</h1>
      <p>La ruta solicitada no existe o fue movida dentro de PMP Suite.</p>
      <Link className="btn" to="/"><ArrowLeft size={17} /> Volver al inicio</Link>
    </main>
  );
}
