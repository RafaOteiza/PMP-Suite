import {pagedReport,reportSheet,summarySheet} from '../utils/pageReports';
import AssetDistributionCharts from '../components/AssetDistributionCharts';
import { type CSSProperties } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Archive, ArrowDownToLine, ArrowUpRight, Cpu, FlaskConical, LayoutDashboard, Monitor, PackageCheck, ShieldCheck, Truck, Warehouse } from 'lucide-react';
import type { Me } from '../api/me';
import { can, PERMISSIONS } from '../app/rbac';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import StatusBadge from '../components/ui/StatusBadge';
import LogisticsAssetTable from '../components/LogisticsAssetTable';
import useLogisticsInventory from '../hooks/useLogisticsInventory';
import '../styles/logistics-assets.css';
import { healthFromStatusName } from '../utils/health';

export default function BodegaDashboardPage() {
  const me=useOutletContext<Me|null>(),navigate=useNavigate();
  const [params,setParams]=useSearchParams();
  const {data,loading,error,reload}=useLogisticsInventory(params);
  const operations=can(me,PERMISSIONS.BODEGA_OPERATIONS_VIEW);
  const explore=(filters:Record<string,string>={})=>{
    if(operations)navigate('/bodega/modulos?'+new URLSearchParams(filters));
    else setParams({...filters,consulta:'1'});
  };
  const count=(stage:string)=>data?.distribucion.find(d=>d.etapa===stage)?.total??0;
  return <div className="page logistics-assets warehouse-overview">

    <PageHeader report={{title:'Dashboard bodega',disabled:loading||!!error,filters:Object.fromEntries(params),load:async()=>[summarySheet('Indicadores',data),reportSheet('Distribucion',data?.distribucion||[]),...await pagedReport('Activos','/api/bodega/inventario',Object.fromEntries(params)).load()]} } eyebrow="Centro logístico" title="Dashboard de bodega" description="Activos, ubicación y disponibilidad. Una visión del parque completo y sus movimientos pendientes." icon={<LayoutDashboard size={21}/>} actions={<><button className="btn ghost" onClick={reload} disabled={loading}>Actualizar</button>{operations&&<Link className="btn" to="/bodega/modulos">Ver inventario <ArrowUpRight size={16}/></Link>}</>}/>
    {error?<FeedbackBanner tone="danger">{error}</FeedbackBanner>:null}
    {loading?<p role="status">Consultando activos…</p>:data&&!error?<>
      <section className="asset-kpis" aria-label="Indicadores de activos">
        <StatCard label="Total activos" value={data.resumen.total} detail="Parque registrado · tipo + serie" icon={<Archive size={19}/>} variant="compact" onClick={()=>explore()}/>
        <StatCard label="Validadores" value={data.resumen.validadores} detail="En todo el parque" icon={<Cpu size={19}/>} tone="info" variant="compact" onClick={()=>explore({tipo:'VALIDADOR'})}/>
        <StatCard label="Consolas" value={data.resumen.consolas} detail="En todo el parque" icon={<Monitor size={19}/>} tone="info" variant="compact" onClick={()=>explore({tipo:'CONSOLA'})}/>
        <StatCard label="En operación" value={count('OPERACION')} detail="Instalados en buses" icon={<Warehouse size={19}/>} tone="success" variant="compact" onClick={()=>explore({etapa:'OPERACION'})}/>
        <StatCard label="Disponibles" value={data.resumen.disponibles} detail="En Bodega · elegibles para instalar" icon={<PackageCheck size={19}/>} tone="success" variant="compact" onClick={()=>explore({etapa:'DISPONIBLE'})}/>
        <StatCard label="Laboratorio" value={count('LABORATORIO')} detail="Recibidos físicamente" icon={<FlaskConical size={19}/>} tone="info" variant="compact" onClick={()=>explore({etapa:'LABORATORIO'})}/>
        <StatCard label="QA" value={count('QA')} detail="Recibidos en control de calidad" icon={<ShieldCheck size={19}/>} tone="info" variant="compact" onClick={()=>explore({etapa:'QA'})}/>
        <StatCard label="En tránsito" value={count('TRANSITO')} detail="Salida confirmada · destino pendiente" icon={<Truck size={19}/>} variant="compact" onClick={()=>explore({etapa:'TRANSITO'})}/>
      </section>
      <AssetDistributionCharts rows={data.distribucion} onExplore={explore} detail={<section className="panel asset-distribution" aria-labelledby="asset-distribution-title">
        <div className="section-heading"><div><h2 id="asset-distribution-title" className="section-title">Distribución de activos</h2><p className="small muted">Cada equipo cuenta una vez. Selecciona una etapa o un total para consultar sus activos.</p></div><StatusBadge tone="primary">{data.resumen.total} {data.resumen.total===1?'activo':'activos'}</StatusBadge></div>
        {!data.resumen.total?<EmptyState icon={<Archive size={24}/>} title="Sin activos registrados" description="La distribución se mostrará cuando existan equipos en el maestro."/>:
          <div className="asset-matrix-wrap"><table className="asset-matrix"><caption className="sr-only">Distribución por etapa o ubicación y tipo de equipo</caption><thead><tr><th scope="col">Etapa / ubicación</th><th scope="col"><span className="asset-wide-label">Validadores</span><abbr className="asset-short-label" title="Validadores">Val.</abbr></th><th scope="col"><span className="asset-wide-label">Consolas</span><abbr className="asset-short-label" title="Consolas">Cons.</abbr></th><th scope="col">Total</th></tr></thead><tbody>{data.distribucion.map(d=><tr key={d.etapa} data-health={healthFromStatusName(d.label)}><th scope="row"><button className="asset-bar" onClick={()=>explore({etapa:d.etapa})} aria-label={`${d.label}: ${d.total} activos, consultar`}><span>{d.label}<small>{Math.round(d.total/data.resumen.total*100)} %</small></span><span className="asset-bar-track" aria-hidden="true"><span style={{'--asset-share':`${d.total/data.resumen.total*100}%`} as CSSProperties}/></span></button></th>{(['validadores','consolas','total'] as const).map(key=><td key={key}><button className="asset-count" aria-label={`${d.label}, ${key}: ${d[key]}`} onClick={()=>explore({etapa:d.etapa,...(key==='total'?{}:{tipo:key==='validadores'?'VALIDADOR':'CONSOLA'})})}>{d[key]}</button></td>)}</tr>)}</tbody><tfoot><tr><th scope="row">Total activos</th><td>{data.resumen.validadores}</td><td>{data.resumen.consolas}</td><td>{data.resumen.total}</td></tr></tfoot></table></div>}
      </section>}/>
      <section className="panel" aria-labelledby="logistic-pending-title"><div className="section-heading"><div><h2 id="logistic-pending-title" className="section-title">Pendientes logísticos</h2><p className="small muted">Indicadores secundarios: pueden corresponder a los mismos activos. No se suman al parque.</p></div></div>
        <div className="asset-secondary">
          <div><Truck size={18}/><strong>{data.secundarios.instalaciones}</strong><span>IN pendientes<small>OS de instalación activas</small></span>{operations&&<Link className="btn ghost sm" to="/bodega/modulos?pendiente=IN" aria-label="Consultar activos con IN pendiente">Consultar <ArrowUpRight size={14}/></Link>}</div>
          <div><ArrowDownToLine size={18}/><strong>{data.secundarios.recepciones}</strong><span>Recepciones<small>OS por recibir en Bodega</small></span>{operations&&<Link className="btn ghost sm" to="/bodega?tab=transito">Ver recepciones <ArrowUpRight size={14}/></Link>}</div>
          <div><Truck size={18}/><strong>{data.secundarios.despachos}</strong><span>Despachos<small>OS por enviar a Lab / QA</small></span>{operations&&<Link className="btn ghost sm" to="/bodega?tab=para-lab">Ver despachos <ArrowUpRight size={14}/></Link>}</div>
          <div data-health={data.secundarios.alertasStock>0?'danger':'neutral'}><AlertTriangle size={18}/><strong>{data.secundarios.alertasStock}</strong><span>Alertas de stock<small>Repuestos en o bajo su umbral</small></span>{operations&&<Link className="btn ghost sm" to="/bodega/repuestos">Ver repuestos <ArrowUpRight size={14}/></Link>}</div>
        </div>
      </section>
      {params.has('consulta')&&<section className="panel"><div className="section-heading"><h2 className="section-title">Consulta de activos</h2><button className="btn ghost sm" onClick={()=>setParams({})}>Cerrar consulta</button></div><LogisticsAssetTable data={data} canDispatch={false} onPage={offset=>setParams({...Object.fromEntries(params),offset:String(offset)})}/></section>}
    </>:null}
  </div>;
}
