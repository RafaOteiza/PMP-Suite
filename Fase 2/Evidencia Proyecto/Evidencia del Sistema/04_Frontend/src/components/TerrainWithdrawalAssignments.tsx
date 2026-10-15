import {useEffect,useState} from 'react';
import {ClipboardList,UserCheck,Search,RefreshCw} from 'lucide-react';
import {assignWithdrawal,getPendingWithdrawals,type PendingWithdrawal} from '../api/os';
import {getTecnicosTerreno,type TecnicoTerreno} from '../api/bodega';
import {getApiErrorMessage} from '../api/errors';
import FeedbackBanner from './ui/FeedbackBanner';
import StatCard from './ui/StatCard';
import StatusBadge from './ui/StatusBadge';
import EmptyState from './ui/EmptyState';
import {formatOperationalStatus} from '../utils/formatters';

export default function TerrainWithdrawalAssignments(){
  const [orders,setOrders]=useState<PendingWithdrawal[]>([]),[techs,setTechs]=useState<TecnicoTerreno[]>([]);
  const [assigned,setAssigned]=useState<Record<string,string>>({}),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const [query,setQuery]=useState('');
  const load=async()=>{setBusy(true);setError('');try{const [items,users]=await Promise.all([getPendingWithdrawals(),getTecnicosTerreno()]);setOrders(items);setTechs(users);setAssigned(Object.fromEntries(items.map(o=>[o.codigo_os,o.tecnico_terreno_id||''])));}catch(e){setError(getApiErrorMessage(e,'No se pudieron cargar los retiros pendientes.'));}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  const assign=async(code:string)=>{if(busy||!assigned[code])return;setBusy(true);setError('');try{await assignWithdrawal(code,assigned[code]);await load();}catch(e){setError(getApiErrorMessage(e,'No se pudo asignar el retiro.'));}finally{setBusy(false);}};
  const groups=[
    {id:'withdrawals-unassigned',title:'Pendientes de asignación',items:orders.filter(o=>!o.tecnico_terreno_id)},
    {id:'withdrawals-assigned',title:'Asignados / pendientes de retiro',items:orders.filter(o=>!!o.tecnico_terreno_id)},
  ];
  const term=query.trim().toLocaleLowerCase('es-CL');
  const matches=(order:PendingWithdrawal)=>[order.codigo_os,order.serie,order.bus_ppu].some(value=>value.toLocaleLowerCase('es-CL').includes(term));
  return <div className="terrain-withdrawals">
    <div className="stat-grid withdrawal-summary" aria-label="Resumen de retiros">
      {groups.map((group,index)=><StatCard key={group.id} label={group.title} value={busy||error?"—":group.items.length} variant="inline" tone={index?'info':'warning'} icon={index?<UserCheck size={19}/>:<ClipboardList size={19}/>}/>)}
    </div>
    <div className="panel withdrawal-filters">
    <div className="toolbar withdrawal-toolbar">
      <div className="search filter-search"><Search size={17} aria-hidden="true"/><input id="withdrawal-search" aria-label="Buscar por OS, serie o PPU" type="search" placeholder="Buscar por OS, serie o PPU" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></div>
      <button type="button" className="btn ghost" disabled={busy} onClick={()=>void load()}><RefreshCw size={17} className={busy?'animate-spin':''} aria-hidden="true"/>Actualizar retiros</button>
    </div>
    <p className="field-hint">Asignar un técnico mantiene el activo en el bus. Solo la confirmación física del retiro lo pasa a tránsito hacia Bodega.</p>
    </div>
    {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
    {busy&&<p role="status">Actualizando retiros…</p>}
    {groups.map(group=>{
      const visible=group.items.filter(matches);
      return <section key={group.id} className="panel withdrawal-group" aria-labelledby={group.id} aria-busy={busy}>
      <div className="section-heading"><h2 className="section-title" id={group.id}>{group.title}</h2>{!error&&!busy&&<StatusBadge tone="neutral">{term?`${visible.length} de `:''}{group.items.length}</StatusBadge>}</div>
      {!visible.length&&!busy&&!error&&<EmptyState icon={<ClipboardList size={24}/>} title={term?'No hay coincidencias en este grupo.':'No hay retiros en este grupo.'} description={term?'Prueba con otra OS, serie o PPU.':'Actualiza la consulta para revisar nuevos retiros.'}/>}
      {!!visible.length&&<div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table" role="table" aria-label={group.title}>
        <colgroup>{['os','equipment','bus','context','failure','reference','status','assignment'].map(column=><col key={column} className={`withdrawal-col-${column}`}/>)}</colgroup>
        <thead role="rowgroup"><tr role="row">{['OS','Equipo','PPU','Terminal / Operador','Falla','Referencia AR','Estado','Técnico / Acción'].map(label=><th scope="col" role="columnheader" key={label}>{label}</th>)}</tr></thead>
        <tbody role="rowgroup">{visible.map(o=><tr role="row" key={o.codigo_os} aria-label={`Retiro ${o.codigo_os}`}>
          <td role="cell" data-label="OS"><strong className="mono-value">{o.codigo_os}</strong></td>
          <td role="cell" data-label="Equipo"><strong className="mono-value">{o.serie}</strong><span className="withdrawal-secondary">{o.tipo_equipo} · {o.modelo||'Modelo no registrado'}{o.marca?' · '+o.marca:''}</span></td>
          <td role="cell" data-label="PPU">{o.bus_ppu}</td>
          <td role="cell" data-label="Terminal / Operador"><span>{o.terminal||'Terminal no registrada'}</span><span className="withdrawal-secondary">{o.operador||'Operador no registrado'}</span></td>
          <td role="cell" data-label="Falla"><details className="withdrawal-failure"><summary title={o.falla||'Falla no registrada'}>{o.falla||'Falla no registrada'}</summary><p>{o.falla||'Falla no registrada'}</p></details></td>
          <td role="cell" data-label="Referencia AR">{o.referencia_ar||'Sin referencia AR'}</td>
          <td role="cell" data-label="Estado"><StatusBadge tone="warning">{formatOperationalStatus(o.estado_actual)}</StatusBadge></td>
          <td role="cell" data-label="Técnico / Acción">
          <span className="withdrawal-secondary">{o.tecnico_terreno_id?(o.tecnico||'Técnico asignado'):'Sin asignar'}</span>
          <div className="withdrawal-assignment"><select aria-label={`Técnico para ${o.codigo_os}`} disabled={busy} value={assigned[o.codigo_os]||''} onChange={e=>setAssigned(current=>({...current,[o.codigo_os]:e.target.value}))}>
          <option value="">Selecciona técnico de terreno</option>
          {o.tecnico_terreno_id&&!techs.some(t=>t.id===o.tecnico_terreno_id)&&<option value={o.tecnico_terreno_id} disabled>{o.tecnico||'Técnico asignado'} (no disponible)</option>}
          {techs.map(t=><option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>)}</select>
          <button type="button" className="btn sm" aria-label={`${o.tecnico_terreno_id?'Cambiar técnico':'Asignar retiro'} ${o.codigo_os}`} disabled={busy||!assigned[o.codigo_os]||assigned[o.codigo_os]===o.tecnico_terreno_id} onClick={()=>void assign(o.codigo_os)}>{o.tecnico_terreno_id?'Cambiar':'Asignar'}</button></div>
          </td>
        </tr>)}</tbody>
      </table></div>}
    </section>;})}
  </div>;
}
