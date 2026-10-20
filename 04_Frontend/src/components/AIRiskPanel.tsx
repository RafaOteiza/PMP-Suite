import FeedbackBanner from "./ui/FeedbackBanner";
import { useEffect, useState, type CSSProperties } from "react";
import { Activity, AlertCircle, Brain, ShieldCheck } from "lucide-react";
import { getAIRiskReport, type AIRiskItem } from "../api/ai";
import EmptyState from "./ui/EmptyState";
import {uniqueAssetRisks} from '../utils/aiPresentation';

export default function AIRiskPanel({compact = false}: {compact?: boolean} = {}) {
  const [error,setError]=useState('');
  const [risks, setRisks] = useState<AIRiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAIRiskReport()
      .then(items=>setRisks(uniqueAssetRisks(items)))
      .catch(() => setError("No fue posible consultar el análisis. No hay predicciones verificadas para mostrar."))
      .finally(() => setLoading(false));
  }, []);

  const getScoreColor = (score: number) => {
    if (compact && score === 0) return "var(--text-secondary)";
    if (score > 0.7) return "var(--red)";
    if (score > 0.4) return "var(--yellow)";
    return "var(--green)";
  };

  if (loading) {
    return (
      <section className="card ai-risk-panel" role="status" aria-live="polite" aria-busy="true">
        <div className="ai-risk-header"><div className="skeleton" style={{ width: 280, height: 42 }} /></div>
        <div style={{ padding: "var(--space-5)" }}><div className="skeleton" style={{ height: 180 }} /></div>
        <span className="sr-only"><Activity /> Cargando análisis de riesgo</span>
      </section>
    );
  }

  if(error)return <FeedbackBanner tone="danger">{error}</FeedbackBanner>;
  return (
    <section className={`card ai-risk-panel${compact ? ' ai-risk-panel-compact' : ''}`} aria-labelledby="ai-risk-title">
      <header className="ai-risk-header">
        <div className="ai-risk-heading">
          <div className="ai-risk-icon"><Brain size={20} aria-hidden="true" /></div>
          <div>
            <h2 className="chart-card-title" id="ai-risk-title">Prioridad de inspección · IA</h2>
            <p className="chart-card-description">Hasta 10 activos · historial de fallas y patrón EMV. Índice heurístico, no probabilidad de falla.</p>
          </div>
        </div>
        <span className="status-badge" data-tone="primary">Consulta ejecutada</span>
      </header>

      <div className="ai-risk-list">
        {risks.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={24} />} title="Sin mediciones disponibles" description="El análisis no devolvió observaciones de riesgo. Esto no confirma ausencia de fallas." />
        ) : risks.map((item) => {
          const riskColor = getScoreColor(item.riesgo_score);
          const riskStyle = { "--risk-color": riskColor } as CSSProperties;
          return (
            <div className="ai-risk-row" key={`${item.tipo_equipo}:${item.serie_equipo}`} style={riskStyle}>
              <div className="ai-risk-device">
                <div className="ai-risk-indicator"><AlertCircle size={19} aria-hidden="true" /></div>
                <div>
                  <div><strong>{item.serie_equipo}</strong> <span className="status-badge" data-tone="neutral">{item.tipo_equipo}</span></div>
                  <div className="small muted">{item.fallas_previas} OS por falla anteriores · excluye instalaciones</div>
                </div>
              </div>
              <div>
                <div className="ai-risk-score">{(item.riesgo_score * 100).toFixed(0)} / 100</div>
                <div className="small muted">{compact && item.riesgo_score === 0 ? 'Sin señales en estas reglas' : 'Índice de prioridad'}</div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="ai-risk-footer">Consulta ejecutada al abrir esta vista · Análisis de reincidencia</footer>
    </section>
  );
}
