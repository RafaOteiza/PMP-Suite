import LabSupervisionReport from '../components/LabSupervisionReport';
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock, Download, FileSpreadsheet, FileText, Gauge, RefreshCw, TrendingUp, Wrench } from "lucide-react";
import type { Me } from "../api/me";
import { api } from "../api/http";
import EmptyState from "../components/ui/EmptyState";
import ChartCard from "../components/ui/ChartCard";
import ChartTooltip from "../components/ui/ChartTooltip";
import DashboardSkeleton from "../components/ui/DashboardSkeleton";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";

interface ReporteData {
  eficienciaSemanal: number; totalReparados: number; totalEnProceso: number; tiempoPromedioHoras: number;
  fallas: { name: string; cantidad: number }[]; porTecnico: { name: string; cantidad: number }[]; porTipo: { name: string; value: number }[];
}

const COLORS = ["var(--chart-primary)", "var(--chart-secondary)", "var(--chart-neutral)"];

function ExistingLabReportesPage() {
  const me = useOutletContext<Me | null>();
  const [data, setData] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [exportError, setExportError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: raw } = await api.get('/api/lab/reportes');
      if (!raw || ![raw.eficienciaSemanal, raw.totalReparados, raw.totalEnProceso, raw.tiempoPromedioHoras].every(Number.isFinite)
        || ![raw.fallas, raw.porTecnico, raw.porTipo].every(Array.isArray)) throw new Error("Reporte incompleto");
      setData(raw);
    } catch { setData(null); setLoadError("Reportes no disponibles. No hay mediciones verificadas para mostrar."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Tipo", "Ítem", "Valor"], ["KPI", "Eficiencia Semanal", `${data.eficienciaSemanal}%`], ["KPI", "Total Reparados", data.totalReparados], ["KPI", "En Proceso", data.totalEnProceso], ["KPI", "Tiempo Promedio (hrs)", data.tiempoPromedioHoras], [],
      ["Top Fallas", "Descripción", "Cantidad"], ...data.fallas.map((failure) => ["Falla", failure.name, failure.cantidad]), [], ["Por Técnico", "Nombre", "Reparaciones"], ...data.porTecnico.map((technician) => ["Técnico", technician.name, technician.cantidad])
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `reporte_laboratorio_${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (!data) return;
    setExportError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
        { Métrica: "Eficiencia Semanal", Valor: `${data.eficienciaSemanal}%` }, { Métrica: "Total Reparados", Valor: data.totalReparados }, { Métrica: "En Proceso", Valor: data.totalEnProceso }, { Métrica: "Tiempo Promedio (hrs)", Valor: data.tiempoPromedioHoras }
      ]), "KPIs");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.fallas.map((failure) => ({ Falla: failure.name, Cantidad: failure.cantidad }))), "Top Fallas");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.porTecnico.map((technician) => ({ Técnico: technician.name, Reparaciones: technician.cantidad }))), "Por Técnico");
      XLSX.writeFile(workbook, `reporte_laboratorio_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) { console.error("Error exportando Excel:", error); setExportError("No se pudo generar el archivo Excel."); }
  };

  if (loading) return <DashboardSkeleton />;
  if (!data) return <div className="page dashboard-page">

    <PageHeader eyebrow="Analítica de laboratorio" title="Laboratorio · Reportes" icon={<FileText size={21} />}
      actions={<button onClick={load} className="btn ghost"><RefreshCw size={17} /> Reintentar</button>} />
    <FeedbackBanner tone="warning">{loadError}</FeedbackBanner>
  </div>;

  return (
    <div className="page dashboard-page">

      <PageHeader
        eyebrow="Analítica de laboratorio"
        title="Laboratorio · Reportes"
        description="Métricas de rendimiento, capacidad técnica y fallas frecuentes."
        icon={<FileText size={21} />}
        actions={<><button onClick={exportCSV} className="btn ghost"><Download size={16} /> CSV</button><button onClick={exportExcel} className="btn ghost"><FileSpreadsheet size={16} /> Excel</button><button onClick={load} className="icon-btn" aria-label="Actualizar reportes"><RefreshCw size={17} /></button></>}
      />
      {exportError ? <FeedbackBanner tone="danger" onDismiss={() => setExportError("")}>{exportError}</FeedbackBanner> : null}

      <section className="stat-grid">
        <StatCard label="Eficiencia semanal" value={`${data.eficienciaSemanal}%`} detail="Sin objetivo configurado para evaluar salud" icon={<Gauge size={19} />} tone="neutral" />
        <StatCard label="Total reparados" value={data.totalReparados} detail="Durante esta semana" icon={<Wrench size={19} />} tone="success" />
        <StatCard label="En proceso" value={data.totalEnProceso} detail="Actualmente en laboratorio" icon={<RefreshCw size={19} />} tone="technical" />
        <StatCard label="Tiempo promedio" value={`${data.tiempoPromedioHoras}h`} detail="Por OS reparada" icon={<Clock size={19} />} tone="primary" />
      </section>

      <section className="report-chart-grid">
        <ChartCard title="Fallas recurrentes" description="Principales diagnósticos registrados">
          {data.fallas.length ? <ResponsiveContainer width="100%" height={Math.min(320, Math.max(150, data.fallas.length * 40 + 40))}><BarChart data={data.fallas} layout="vertical" margin={{ left: 8, right: 28 }} barSize={17}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" stroke="var(--muted)" fontSize={11} width={110} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--primary-soft)" }} /><Bar dataKey="cantidad" name="Incidencias" radius={[0, 6, 6, 0]} background={{ fill: "var(--dashboard-surface-muted)" }}>{data.fallas.map((failure, index) => <Cell key={`${failure.name}-${index}`} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyState icon={<FileText size={24}/>} title="Sin registros en este periodo" description="Los indicadores aparecerán cuando existan intervenciones registradas."/>}
        </ChartCard>
        <ChartCard title="Reparaciones por técnico" description="Distribución de cierres por especialista" action={<TrendingUp size={18} />}>
          {data.porTecnico.length ? <ResponsiveContainer width="100%" height={Math.min(320, Math.max(150, data.porTecnico.length * 40 + 40))}><BarChart data={data.porTecnico} layout="vertical" margin={{ left: 8, right: 28 }} barSize={19}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" stroke="var(--muted)" fontSize={11} width={130} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--primary-soft)" }} /><Bar dataKey="cantidad" name="Reparaciones" radius={[0, 6, 6, 0]} background={{ fill: "var(--dashboard-surface-muted)" }}>{data.porTecnico.map((technician, index) => <Cell key={`${technician.name}-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyState icon={<FileText size={24}/>} title="Sin registros en este periodo" description="Los indicadores aparecerán cuando existan intervenciones registradas."/>}
        </ChartCard>
        <ChartCard title="Distribución por equipo" description="Validadores frente a consolas" className="report-type-chart">
          {data.porTipo.some(item => item.value > 0) ? <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.porTipo} cx="50%" cy="44%" innerRadius={70} outerRadius={98} paddingAngle={3} cornerRadius={6} dataKey="value" stroke="var(--dashboard-surface-elevated)" strokeWidth={3}>{data.porTipo.map((item, index) => <Cell key={`${item.name}-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer> : <EmptyState icon={<FileText size={24}/>} title="Sin equipos en este periodo"/>}
        </ChartCard>
      </section>
    </div>
  );
}

export default function LabReportesPage(){const me=useOutletContext<Me|null>();return me?.rol==='jefe_laboratorio'?<LabSupervisionReport/>:<ExistingLabReportesPage/>;}
