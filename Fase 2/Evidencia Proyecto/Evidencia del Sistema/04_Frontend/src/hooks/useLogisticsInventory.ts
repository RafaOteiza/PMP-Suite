import { useEffect, useState } from 'react';
import { getLogisticsInventory, type LogisticsInventory } from '../api/bodega';
import { getApiErrorMessage } from '../api/errors';

export default function useLogisticsInventory(params:URLSearchParams) {
  const key=params.toString();
  const [data,setData]=useState<LogisticsInventory|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    getLogisticsInventory(Object.fromEntries(new URLSearchParams(key)),controller.signal)
      .then(value=>{if(!controller.signal.aborted)setData(value);})
      .catch(e=>{if(!controller.signal.aborted){setData(null);setError(getApiErrorMessage(e,'No se pudo consultar el inventario.'));}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[key,revision]);
  return {data,loading,error,reload:()=>setRevision(n=>n+1)};
}
