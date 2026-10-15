import { Link } from 'react-router-dom';
import { ArrowUpRight, PackageSearch } from 'lucide-react';
import type { LogisticsInventory } from '../api/bodega';
import EmptyState from './ui/EmptyState';
import StatusBadge from './ui/StatusBadge';
import { formatDate, formatOperationalStatus } from '../utils/formatters';

export default function LogisticsAssetTable({data,canDispatch,onPage}:{data:LogisticsInventory;canDispatch:boolean;onPage:(offset:number)=>void}) {
  if(!data.items.length) return <EmptyState icon={<PackageSearch size={24}/>} title="Sin equipos en esta consulta" description="Prueba otra sección o ajusta los filtros. Registrar un activo no lo habilita automáticamente para instalar."/>;
  return <>
    <div className="asset-table-wrap"><table className="asset-logistics-table">
      <caption className="sr-only">Activos por tipo y serie. La disponibilidad no confirma un despacho físico.</caption>
      <thead><tr><th scope="col">Equipo</th><th scope="col">Procedencia</th><th scope="col">Estado / ubicación</th><th scope="col">Fecha</th><th scope="col">Validación</th><th scope="col">Acción</th></tr></thead>
      <tbody>{data.items.map(a=><tr key={`${a.tipo_equipo}:${a.serie}`}>
        <td data-label="Equipo"><strong className="asset-series">{a.serie}</strong><span>{a.tipo_equipo==='VALIDADOR'?'Validador':'Consola'}</span><small>{[a.modelo,a.marca].filter(Boolean).join(' · ')||'Modelo / marca no registrados'}</small></td>
        <td data-label="Procedencia"><span>{a.procedencia==='Inicial'?'Recepción inicial':a.procedencia==='Reparado'?'Reparación aprobada por QA':a.procedencia}</span><small>{a.codigo_os||'Sin OS'}</small></td>
        <td data-label="Estado / ubicación"><StatusBadge tone={a.disponible?'success':a.etapa==='TRANSITO'?'info':undefined}>{formatOperationalStatus(a.estado_actual)}</StatusBadge><small>{a.ubicacion_actual}</small></td>
        <td data-label="Fecha"><span>{a.fecha?formatDate(a.fecha):'No registrada'}</span><small>{a.procedencia==='Inicial'?'Recepción inicial':'Alta del activo'}</small></td>
        <td data-label="Validación">{a.disponible?<><StatusBadge health={a.escaneado_bodega?'success':'warning'}>{a.escaneado_bodega?'Escaneado en Bodega':'Pendiente de escaneo'}</StatusBadge><small>Para despacho a terreno</small></>:<span className="muted">{a.etapa==='VALIDACION'?'Recepción por confirmar':'No disponible para instalación'}</span>}</td>
        <td data-label="Acción"><div className="asset-row-actions">{a.disponible&&canDispatch?<Link className="btn sm" to="/bodega/despacho">Preparar despacho físico</Link>:null}<Link className="btn ghost sm" aria-label={`Ver historial de ${a.tipo_equipo.toLowerCase()} ${a.serie}`} to={`/trazabilidad?tipo=${a.tipo_equipo}&serie=${encodeURIComponent(a.serie)}`}>Historial <ArrowUpRight size={14}/></Link></div></td>
      </tr>)}</tbody>
    </table></div>
    <nav className="asset-pagination" aria-label="Paginación de activos"><span className="small muted">{data.offset+1}–{Math.min(data.offset+data.items.length,data.totalFiltrado)} de {data.totalFiltrado} activos</span><div><button className="btn ghost sm" disabled={data.offset===0} onClick={()=>onPage(Math.max(0,data.offset-data.limit))}>Anterior</button><button className="btn ghost sm" disabled={data.offset+data.limit>=data.totalFiltrado} onClick={()=>onPage(data.offset+data.limit)}>Siguiente</button></div></nav>
  </>;
}
