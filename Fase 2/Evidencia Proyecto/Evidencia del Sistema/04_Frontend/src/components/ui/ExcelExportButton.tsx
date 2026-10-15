import {useRef,useState} from 'react';
import {useOutletContext} from 'react-router-dom';
import {FileSpreadsheet,LoaderCircle} from 'lucide-react';
import type {Me} from '../../api/me';
import {canExportReports,downloadExcel,type ExcelReport} from '../../utils/excelReport';
export default function ExcelExportButton({report,onBusyChange,primary=false}:{report:ExcelReport;primary?:boolean;onBusyChange?:(busy:boolean)=>void}){
 const me=useOutletContext<Me|null>(),lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!canExportReports(me?.rol))return null;
 const run=async()=>{if(lock.current)return;lock.current=true;setBusy(true);onBusyChange?.(true);setError('');try{await downloadExcel(report,me?.rol||'');}catch(e){setError(e instanceof Error?e.message:'No se pudo generar el informe.');}finally{lock.current=false;setBusy(false);onBusyChange?.(false);}};
 return <div className="excel-export"><button type="button" className={primary?"btn":"btn ghost"} disabled={busy||report.disabled} onClick={()=>void run()} title="Descargar todos los registros que coincidan con los filtros">{busy?<LoaderCircle size={16} className="animate-spin"/>:<FileSpreadsheet size={16}/>} {busy?'Preparando Excel…':'Descargar Excel'}</button>{error&&<p role="alert" className="small text-danger">{error}</p>}</div>;
}
