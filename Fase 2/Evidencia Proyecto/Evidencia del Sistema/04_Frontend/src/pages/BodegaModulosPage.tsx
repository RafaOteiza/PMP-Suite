import {pagedReport} from '../utils/pageReports';
import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Archive, Cpu, Monitor, PackageCheck, PackageX, Search, Warehouse } from 'lucide-react';
import type { Me } from '../api/me';
import { can, PERMISSIONS } from '../app/rbac';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import LogisticsAssetTable from '../components/LogisticsAssetTable';
import useLogisticsInventory from '../hooks/useLogisticsInventory';
import { formatDate, formatTime, formatOperationalStatus } from '../utils/formatters';
import '../styles/logistics-assets.css';

export default function BodegaModulosPage() {
  const me=useOutletContext<Me|null>(),canWrite=can(me,PERMISSIONS.BODEGA_WRITE);
  const [params,setParams]=useSearchParams();
  const {data,loading,error,reload}=useLogisticsInventory(params);
  const [search,setSearch]=useState(params.get('q')||'');
  useEffect(()=>setSearch(params.get('q')||''),[params]);
  const filter=(name:string,value:string)=>{const next=new URLSearchParams(params);next.delete('offset');if(value)next.set(name,value);else next.delete(name);setParams(next);};
  const section=(etapa:string)=>{const next=new URLSearchParams(params);['etapa','offset','alcance','disponibilidad','pendiente'].forEach(k=>next.delete(k));if(etapa)next.set('etapa',etapa);setParams(next);};
  const tab=params.get('etapa')||'';
  const tabLabels:Record<string,string>={'':'Todos los activos',DISPONIBLE:'Listos para instalación',BODEGA:'No disponibles',VALIDACION:'Pendientes de validación'};
  const title=params.get('pendiente')==='IN'?'Activos con IN pendiente':tabLabels[tab]||data?.distribucion.find(d=>d.etapa===tab)?.label||'Activos';
  return <div className="page logistics-assets asset-inventory">

    <PageHeader report={pagedReport('Inventario equipos','/api/bodega/inventario',Object.fromEntries(params),loading||!!error)} eyebrow="Consulta logística" title="Inventario de equipos" description="El parque global y el stock físico de Bodega, con su disponibilidad real para instalación." icon={<Archive size={21}/>} actions={<><button className="btn ghost" disabled={loading} onClick={reload}>Actualizar</button>{canWrite&&<Link className="btn" to="/bodega/despacho">Despacho por escaneo</Link>}</>}/>
    {error?<FeedbackBanner tone="danger">{error}</FeedbackBanner>:null}
    <section className="asset-kpis inventory-kpis" aria-label="Resumen de inventario">
      <StatCard label="En Bodega" value={loading||error?'—':data?.resumen.bodega??'—'} detail="Stock físico confirmado" icon={<Warehouse size={19}/>} variant="compact" onClick={()=>setParams({alcance:'BODEGA'})}/>
      <StatCard label="Disponibles" value={loading||error?'—':data?.resumen.disponibles??'—'} detail="En Bodega · elegibles para instalar" icon={<PackageCheck size={19}/>} variant="compact" tone="success" onClick={()=>setParams({etapa:'DISPONIBLE'})}/>
      <StatCard label="No disponibles" value={loading||error?'—':data?.resumen.noDisponibles??'—'} detail="En Bodega · no elegibles" icon={<PackageX size={19}/>} variant="compact" tone="warning" onClick={()=>setParams({etapa:'BODEGA'})}/>
      <StatCard label="Validadores" value={loading||error?'—':data?.resumen.validadores??'—'} detail="Maestro global" icon={<Cpu size={19}/>} variant="compact" tone="info" onClick={()=>setParams({tipo:'VALIDADOR'})}/>
      <StatCard label="Consolas" value={loading||error?'—':data?.resumen.consolas??'—'} detail="Maestro global" icon={<Monitor size={19}/>} variant="compact" tone="info" onClick={()=>setParams({tipo:'CONSOLA'})}/>
      <StatCard label="Total inventario" value={loading||error?'—':data?.resumen.total??'—'} detail="Todos los activos registrados" icon={<Archive size={19}/>} variant="compact" onClick={()=>setParams({})}/>
    </section>
    <section className="panel asset-inventory-panel">
      <div className="asset-sections" role="group" aria-label="Secciones del inventario">{Object.entries(tabLabels).map(([value,label])=><button className="btn ghost" key={value} aria-pressed={tab===value} onClick={()=>section(value)}>{label}</button>)}</div>
      <form className="asset-filters" onSubmit={event=>{event.preventDefault();filter('q',search);}} aria-label="Filtros de inventario">
        <label className="asset-search">Buscar equipo<div><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Serie, modelo, marca, PPU u OS"/><button className="btn ghost" type="submit" aria-label="Buscar equipos"><Search size={17}/></button></div></label>
        <label>Tipo<select value={params.get('tipo')||''} onChange={e=>filter('tipo',e.target.value)}><option value="">Todos los tipos</option><option value="VALIDADOR">Validador</option><option value="CONSOLA">Consola</option></select></label>
        <label>Modelo<select value={params.get('modelo')||''} onChange={e=>filter('modelo',e.target.value)}><option value="">Todos los modelos</option>{data?.filtros.modelos.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Estado<select value={params.get('estado')||''} onChange={e=>filter('estado',e.target.value)}><option value="">Todos los estados</option>{data?.filtros.estados.map(v=><option key={v} value={v}>{formatOperationalStatus(v)}</option>)}</select></label>
        <label>Origen<select value={params.get('origen')||''} onChange={e=>filter('origen',e.target.value)}><option value="">Todos los orígenes</option>{data?.filtros.origenes.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Disponibilidad<select value={params.get('disponibilidad')||''} onChange={e=>filter('disponibilidad',e.target.value)}><option value="">Todas</option><option value="SI">Disponible</option><option value="NO">No disponible</option></select></label>
        <label>Alcance<select value={params.get('alcance')||''} onChange={e=>filter('alcance',e.target.value)}><option value="">Activos globales</option><option value="BODEGA">Stock físico de Bodega</option></select></label>
        <button className="btn ghost sm" type="button" onClick={()=>setParams({})} disabled={!params.size}>Limpiar filtros</button>
      </form>
      <div className="section-heading"><div><h2 className="section-title">{title}</h2><p className="small muted">{tab==='DISPONIBLE'?'Recepción inicial conforme o reparación aprobada por QA. Estar disponible no sustituye la validación física de un nuevo despacho.':tab==='BODEGA'?'Equipos físicamente en Bodega que todavía no son elegibles para instalación.':tab==='VALIDACION'?'Activos registrados pendientes de recepción inicial. El alta no confirma presencia en Bodega.':'Los indicadores superiores muestran el parque completo; los filtros se aplican a esta consulta.'}</p></div><StatusBadge tone="neutral">{loading||error?'—':data?.totalFiltrado??'—'} {data?.totalFiltrado===1?'equipo':'equipos'}</StatusBadge></div>
      {loading?<p role="status">Consultando inventario…</p>:data&&!error?<LogisticsAssetTable data={data} canDispatch={canWrite} onPage={offset=>setParams({...Object.fromEntries(params),offset:String(offset)})}/>:null}
    </section>
    {!loading&&!error&&!!data?.recientes.length&&<section className="panel"><div className="section-heading"><div><h2 className="section-title">Movimientos recientes</h2><p className="small muted">Últimos movimientos confirmados de los activos de esta consulta.</p></div></div><ul className="asset-recent">{data.recientes.map(event=><li key={event.id}><div><strong>{event.titulo}</strong><span className="small muted">{event.tipo_equipo} {event.serie} · {event.codigo_os||'Sin OS'}</span></div><time className="small muted" dateTime={event.fecha}>{formatDate(event.fecha)} · {formatTime(event.fecha)}</time><Link className="btn ghost sm" aria-label={`Ver historial de ${event.serie}`} to={`/trazabilidad?tipo=${event.tipo_equipo}&serie=${encodeURIComponent(event.serie)}`}>Ver historial</Link></li>)}</ul></section>}
  </div>;
}
