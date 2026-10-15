import QaPage from './QaPage';
import LabTechnicianWorklist from '../components/LabTechnicianWorklist';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import type { Me } from '../api/me';
import { getMyOs } from '../api/os';
import { getLabQueue } from '../api/lab';
import { assetHistoryUrl, type Asset } from '../api/bridge';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import EmptyState from '../components/ui/EmptyState';

type WorkItem = Asset & {codigo_os:string;falla:string;estado_nombre?:string};
export default function RoleDashboardPage(){
 const me=useOutletContext<Me|null>();
 return me?.rol==='tecnico_laboratorio'?<LabTechnicianWorklist me={me}/>:me?.rol==='qa'?<QaPage/>:<OtherRoleDashboard/>;
}
function OtherRoleDashboard(){
  const me=useOutletContext<Me|null>();const [items,setItems]=useState<WorkItem[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const role=me?.rol;
  const route=role==='tecnico_terreno'?'/operacion/mis-os':'/lab/dashboard';
  useEffect(()=>{let active=true;setLoading(true);setError('');
    const load=async()=>{try{
      const rows=role==='tecnico_terreno'?await getMyOs():(await Promise.all([getLabQueue('VALIDADOR'),getLabQueue('CONSOLA')])).flat();
      if(active)setItems(rows as WorkItem[]);
    }catch{if(active)setError('No fue posible cargar las OS asignadas.');}finally{if(active)setLoading(false);}};
    void load();return()=>{active=false;};
  },[role]);
  return <div className="page"><PageHeader title={`Mi jornada · ${me?.nombre||''}`} description="Carga asignada en el flujo normal de OS PMP." icon={<ClipboardList size={21}/>}/>
    {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}<section className="panel"><h2>Mis OS PMP{!loading && !error ? ` (${items.length})` : ""}</h2><Link className="btn" to={route}>Abrir bandeja de trabajo</Link>
    {loading?<p role="status">Cargando…</p>:error?null:items.map(o=><article className="work-summary" key={o.codigo_os}><h3>{o.codigo_os}</h3><p>{o.falla} · {o.estado_nombre}</p><Link className="btn ghost sm" to={assetHistoryUrl(o)}>Historial del activo · {o.serie}</Link></article>)}{!loading&&!items.length&&!error&&<EmptyState icon={<ClipboardList size={24}/>} title="Sin órdenes asignadas" description="Las OS asociadas a tu usuario aparecerán aquí."/>}</section></div>;
}
