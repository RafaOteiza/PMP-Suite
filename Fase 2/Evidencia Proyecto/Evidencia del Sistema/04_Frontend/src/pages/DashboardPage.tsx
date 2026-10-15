import {sheetsReport,reportSheet,summarySheet} from '../utils/pageReports';
import AssetDistributionCharts from '../components/AssetDistributionCharts';
﻿import {useEffect,useState,type ReactNode} from 'react';
import {Link,useNavigate,useOutletContext} from 'react-router-dom';
import {Activity,Archive,ArrowRight,CheckCircle,ClipboardList,Cpu,FlaskConical,LayoutDashboard,Monitor,PackageCheck,RefreshCw,ShieldCheck,Warehouse} from 'lucide-react';
import {getExecutiveDashboard,type ExecutiveDashboard} from '../api/executive';
import type {Me} from '../api/me';
import {can,PERMISSIONS} from '../app/rbac';
import {labSLA} from '../utils/labWorkload';
import type {HealthState} from '../utils/health';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import EmptyState from '../components/ui/EmptyState';
import AIRiskPanel from '../components/AIRiskPanel';
import '../styles/logistics-assets.css';
import '../styles/admin-control.css';

export default function DashboardPage(){
 const me=useOutletContext<Me|null>(),navigate=useNavigate();
 const [data,setData]=useState<ExecutiveDashboard|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');getExecutiveDashboard(controller.signal).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(()=>{if(!controller.signal.aborted)setError('No se pudo consultar el centro de control. Actualiza para reintentar.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[refresh]);
 const operations=can(me,PERMISSIONS.BODEGA_OPERATIONS_VIEW),assign=can(me,PERMISSIONS.LAB_ASSIGN);
 const inventory=(filters:Record<string,string>={})=>(operations?'/bodega/modulos?':'/bodega/dashboard?consulta=1&')+new URLSearchParams(filters);
 const labLink=(filter='all')=>assign?'/lab/asignacion?tab='+filter:'/lab/recepcion?tab=recibidos';
 const stat=(label:string,value:number,detail:string,icon:ReactNode,path:string,health:HealthState='info')=><StatCard key={label} label={label} value={value} detail={detail} icon={icon} health={value===0?'neutral':health} healthLabel={value===0?'Sin registros':undefined} variant="compact" onClick={()=>navigate(path)}/>;
 const process=(title:string,rows:[string,number,string,HealthState?][]) => <section className="panel process-summary" key={title}><h2 className="section-title">{title}</h2><dl>{rows.map(([label,value,path,health])=><div key={label}><dt><Link to={path}>{label}<ArrowRight size={14}/></Link></dt><dd><StatusBadge health={value===0?'neutral':health||'info'}>{value}</StatusBadge></dd></div>)}</dl></section>;
 const slas=data?.labWorkload.map(labSLA)||[];
 const parkDetails=data&&(<section className="panel"><div className="section-heading"><div><h2 className="section-title">Distribución del parque</h2><p className="small muted">Cada activo cuenta una vez en esta matriz. Los indicadores superiores y procesos secundarios pueden solaparse.</p></div></div>
    {!data.assets.total?<EmptyState icon={<Archive size={24}/>} title="Sin activos registrados" description="Las órdenes y los activos se contabilizan por separado."/>:<table className="asset-matrix"><thead><tr><th>Etapa / ubicación</th><th><span className="asset-wide-label">Validadores</span><abbr className="asset-short-label" title="Validadores">Val.</abbr></th><th><span className="asset-wide-label">Consolas</span><abbr className="asset-short-label" title="Consolas">Cons.</abbr></th><th>Total</th></tr></thead><tbody>{data.distribution.map(d=><tr key={d.etapa}><th scope="row"><Link to={inventory({etapa:d.etapa})}>{d.label}</Link></th><td>{d.validadores}</td><td>{d.consolas}</td><td><button className="asset-count" onClick={()=>navigate(inventory({etapa:d.etapa}))} aria-label={`Consultar ${d.label}: ${d.total}`}>{d.total}</button></td></tr>)}</tbody><tfoot><tr><th>Total activos</th><td>{data.assets.validadores}</td><td>{data.assets.consolas}</td><td>{data.assets.total}</td></tr></tfoot></table>}
    <div className="executive-context"><Link to={inventory({disponibilidad:'NO'})}><StatusBadge health="neutral">{data.assets.noDisponibles} no disponibles para instalación</StatusBadge></Link><Link to={inventory({etapa:'TRANSITO'})}><StatusBadge health="info">{data.assets.transito} en tránsito</StatusBadge></Link>{data.transit.map(t=><Link key={t.destino} to={inventory({etapa:'TRANSITO',estado:t.destino})}>{t.destino}: {t.total}</Link>)}</div>
   </section>);
 return <div className="page logistics-assets executive-dashboard">
  <PageHeader report={sheetsReport('Dashboard ejecutivo',[summarySheet('Indicadores',data),reportSheet('Distribucion',data?.distribution||[]),reportSheet('Carga laboratorio',data?.labWorkload||[])],loading||!!error)} eyebrow="Centro de control" title={me?.rol==='admin'?'Supervisión global':'Dashboard ejecutivo'} description="Parque global, continuidad operacional y prioridades de supervisión." icon={<LayoutDashboard size={21}/>} actions={<button className="btn ghost" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16}/> Actualizar</button>}/>

  {loading?<p role="status">Consultando indicadores…</p>:error?<FeedbackBanner tone="danger">{error}</FeedbackBanner>:data&&<>
   <div className="section-heading"><h2 className="section-title">Parque registrado</h2><span className="small muted">Actualizado {new Date(data.updatedAt).toLocaleString('es-CL')}</span></div>
   <section className="asset-kpis" aria-label="Indicadores de activos">
    {stat('Total activos',data.assets.total,'Identidad única: tipo + serie',<Archive size={19}/>,inventory())}
    {stat('Validadores',data.assets.validadores,'Todo el parque',<Cpu size={19}/>,inventory({tipo:'VALIDADOR'}))}
    {stat('Consolas',data.assets.consolas,'Todo el parque',<Monitor size={19}/>,inventory({tipo:'CONSOLA'}))}
    {stat('En operación',data.assets.operacion,'Instalación vigente',<Activity size={19}/>,inventory({etapa:'OPERACION'}),'success')}
    {stat('Disponibles',data.assets.disponibles,'Elegibles para instalación',<PackageCheck size={19}/>,inventory({etapa:'DISPONIBLE'}),'success')}
    {stat('En Bodega',data.assets.bodega,'Stock físico disponible y no disponible',<Warehouse size={19}/>,inventory({alcance:'BODEGA'}))}
    {stat('En Laboratorio',data.assets.laboratorio,'Carga físicamente recibida',<FlaskConical size={19}/>,inventory({etapa:'LABORATORIO'}))}
    {stat('En QA',data.assets.qa,'Recibidos en control de calidad',<ShieldCheck size={19}/>,inventory({etapa:'QA'}))}
   </section>
   {me?.rol==='gerente'?<AssetDistributionCharts rows={data.distribution} onExplore={filters=>navigate(inventory(filters))} detail={parkDetails}/>:parkDetails}
   <section className="panel"><div className="section-heading"><div><h2 className="section-title">Órdenes y prioridades</h2><p className="small muted">OS reales y casos; no se suman al parque. SLA sobre carga activa de Laboratorio, desde la recepción vigente.</p></div></div><div className="asset-kpis">
    {stat('OS activas',data.orders.activas,'Excluye estados finales',<ClipboardList size={19}/>,'/operacion/os?grupo=activas')}
    {stat('OS cerradas / finalizadas',data.orders.cerradas,'Estados finales vigentes',<CheckCircle size={19}/>,'/operacion/os?grupo=cerradas','success')}
    {stat('Casos PoD',data.podCases,'Casos vinculados a OS PoD',<ShieldCheck size={19}/>,'/operacion/os?grupo=pod',data.podCases?'warning':'neutral')}
    {stat('Fallas registradas',data.orders.fallas,'OS de mantenimiento / PoD · histórico',<Activity size={19}/>,'/operacion/os?grupo=fallas',data.orders.fallas?'warning':'neutral')}
   </div><div className="executive-context">{slas.length===0?<span className="muted">SLA: sin mediciones de carga activa.</span>:<>{(['vigente','critico','vencido','sinSla'] as const).map((key,i)=>{const count=slas.filter(s=>key==='vigente'?!s.sinSla&&!s.critico&&!s.vencido:!!s[key]).length;return <Link key={key} to={assign?`/lab/asignacion?tab=all&sla=${key}`:'/lab/dashboard'}><StatusBadge health={(['success','warning','danger','neutral'] as const)[i]}>{['SLA vigente','SLA crítico','SLA vencido','Sin fecha de ingreso'][i]}: {count}</StatusBadge></Link>;})}</>}</div></section>
   <div className="executive-process-grid">
    {process('Terreno',[
     ['IN pendientes',data.orders.instalaciones,'/operacion/os?grupo=instalaciones'],['En ruta a terreno',data.orders.enRuta,inventory({estado:'En ruta hacia terreno'})],['Retiros pendientes',data.orders.retiros,can(me,PERMISSIONS.WITHDRAWAL_ASSIGN)?'/operacion/retiros':'/operacion/os?grupo=retiros','warning']])}
    {process('Bodega',[
     ['Recepciones pendientes',data.orders.recepciones,operations?'/bodega?tab=transito':'/bodega/dashboard','warning'],['Disponibles para instalación',data.assets.disponibles,inventory({etapa:'DISPONIBLE'}),'success'],['Pendientes de despacho',data.orders.despachos,operations?'/bodega?tab=para-lab':'/bodega/dashboard'],['Alertas de stock',data.stockAlerts,operations?'/bodega/repuestos':'/bodega/dashboard',data.stockAlerts?'danger':'neutral']])}
    {process('Laboratorio',[
     ['En camino · no asignables',data.lab.camino,'/lab/recepcion?tab=camino'],['Recibidos sin técnico',data.lab.pendientes,labLink('pending'),'warning'],['En diagnóstico',data.lab.diagnostico,assign?'/lab/asignacion?tab=all&estado=4':labLink()],['En reparación',data.lab.reparacion,assign?'/lab/asignacion?tab=all&estado=5':labLink()],['Espera de repuesto',data.lab.repuestos,assign?'/lab/asignacion?tab=all&estado=9':labLink(),'warning'],['Listos para salida',data.lab.salida,can(me,PERMISSIONS.LAB_DISPATCH)?'/lab/despacho-qa':'/lab/recepcion?tab=recibidos','success']])}
    {process('Control QA',[
     ['Pendientes de recepción',data.qa.RECEPCION||0,'/qa?etapa=RECEPCION'],['Instalación Ambiente',data.qa.AMBIENTE||0,'/qa?etapa=AMBIENTE'],['Pruebas / dictamen',data.qa.PRUEBAS||0,'/qa?etapa=PRUEBAS'],['Pendientes de despacho',data.qa.DESPACHO||0,'/qa?etapa=DESPACHO','warning'],['Por verificar',data.qa.POR_VERIFICAR||0,'/qa?etapa=POR_VERIFICAR','warning']])}
   </div>
   <AIRiskPanel/>
  </>}
 </div>;
}
