// Read-only decision support. Observed intervals are not a trained prediction or proof of cause.
const day = 86400000;
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const date = value => value ? Date.parse(value) : NaN;
const simulation = value => /SIMULACI[OÓ]N/i.test(value || '');
const rounded = value => Math.round(value * 10) / 10;
const median = values => { const v=[...values].sort((a,b)=>a-b);return v.length ? (v[Math.floor((v.length-1)/2)]+v[Math.ceil((v.length-1)/2)])/2 : null; };
const rank = (rows,key) => [...rows.reduce((m,r)=>{const k=r[key]?.trim();if(k)m.set(k,(m.get(k)||0)+1);return m;},new Map())].map(([label,total])=>({label,total})).sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label));

export function buildMaintenanceAnalysis({orders=[],closures=[],deliveries=[],stock=[]}, at) {
 const now=date(at),groups=new Map(),alerts=[],byOrder=new Map(orders.map(o=>[o.codigo_os,o])),closuresByOrder=new Map();
 for(const c of closures){if(!closuresByOrder.has(c.codigo_os))closuresByOrder.set(c.codigo_os,[]);closuresByOrder.get(c.codigo_os).push(c);}
 for(const o of orders){const key=JSON.stringify([o.tipo_equipo,o.serie]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
 const assets=[...groups.values()].map(rows=>{
  rows.sort((a,b)=>date(a.fecha)-date(b.fecha)||a.codigo_os.localeCompare(b.codigo_os));
  const last=rows.at(-1),events=rows.flatMap(o=>closuresByOrder.get(o.codigo_os)||[]).sort((a,b)=>date(b.fecha)-date(a.fecha));
  const intervals=rows.slice(1).map((r,i)=>(date(r.fecha)-date(rows[i].fecha))/day).filter(n=>Number.isFinite(n)&&n>0);
  const real=rows.filter(r=>!simulation(r.falla)&&Number.isFinite(date(r.fecha))&&date(r.fecha)<=now);
  const realIntervals=real.slice(1).map((r,i)=>(date(r.fecha)-date(real[i].fecha))/day).filter(n=>Number.isFinite(n)&&n>0);
  // Descriptive range only, never a probability or calendar promise. Synthetic records cannot support it.
  const estimate=realIntervals.length>=3 && date(real.at(-1).fecha)-date(real[0].fecha)>=30*day
   ? {intervals:realIntervals.length,medianDays:rounded(median(realIntervals)),minDays:rounded(Math.min(...realIntervals)),maxDays:rounded(Math.max(...realIntervals))} : null;
  const result={tipo:last.tipo_equipo,serie:last.serie,failures:rows.length,simulationFailures:rows.filter(r=>simulation(r.falla)).length,
   firstFailure:rows[0].fecha,lastFailure:last.fecha,medianDays:intervals.length?rounded(median(intervals)):null,intervals:intervals.length,
   reportedFault:last.falla,diagnosis:events.find(e=>e.diagnostico)?.diagnostico||null,result:events[0]?.resultado||null,
   incidents:rows.map(o=>({os:o.codigo_os,fecha:o.fecha,falla:o.falla,bus:o.bus_ppu})),estimate};
  if(real.length>=2)alerts.push({tone:'warning',subject:`${last.tipo_equipo} ${last.serie}`,evidence:`${real.length} reportes reales por falla.`,action:'Revisar diagnóstico, reparación anterior, conectores y condiciones del bus antes de repetir el cambio de piezas.'});
  return result;
 }).sort((a,b)=>b.failures-a.failures||a.serie.localeCompare(b.serie));
 const latestByAsset=new Map();
 for(const c of [...closures].sort((a,b)=>date(a.fecha)-date(b.fecha))){const o=byOrder.get(c.codigo_os);if(o)latestByAsset.set(JSON.stringify([o.tipo_equipo,o.serie]),c);}
 const outcomes=rank(assets.map(a=>({resultado:latestByAsset.get(JSON.stringify([a.tipo,a.serie]))?.resultado||'SIN_CIERRE'})),'resultado');
 const parts=stock.map(p=>{
  const matched=deliveries.filter(d=>String(d.repuesto_id)===String(p.id));
  const window=matched.filter(d=>date(d.fecha)<=now&&date(d.fecha)>=now-90*day);
  const real=window.filter(d=>!simulation(d.falla));
  const units=window.reduce((n,d)=>n+numeric(d.cantidad),0),realUnits=real.reduce((n,d)=>n+numeric(d.cantidad),0);
  const span=real.length?(now-Math.min(...real.map(d=>date(d.fecha))))/day:0;
  const enough=real.length>=3 && span>=30;
  const rate=enough?realUnits/90:null,available=numeric(p.stock),critical=numeric(p.stock_critico);
  const coverage=rate>0?Math.floor(Math.max(0,available)/rate):null;
  const missing=Math.max(0,critical-available);
  const plan={nombre:p.nombre,tipo:p.categoria,stock:available,critical,units90:units,realUnits90:realUnits,simulationUnits90:units-realUnits,
   deliveries90:window.length,dailyRate:rate===null?null:Math.round(rate*1000)/1000,coverageDays:coverage,
   depletionDate:coverage===null?null:new Date(now+coverage*day).toISOString(),
   suggestedUnits30:rate===null?null:Math.max(0,Math.ceil(rate*30+critical-available)),minimumGap:missing,
   leadTimeDays:null};
  if(available<=critical)alerts.push({tone:available<=0?'danger':'warning',subject:p.nombre,evidence:`Stock ${available}; umbral vigente ${critical}.`,action:missing?`Evaluar reponer al menos ${missing} unidades para alcanzar el umbral. Confirmar pedidos en curso y plazo del proveedor.`:'Revisar reposición: se alcanzó el umbral de stock.'});
  else if(coverage!==null&&coverage<=30)alerts.push({tone:'warning',subject:p.nombre,evidence:`Cobertura orientativa: ${coverage} días, basada en ${realUnits} unidades reales entregadas en 90 días.`,action:'Cotizar reposición y confirmar plazo del proveedor. La fecha de compra depende de ese plazo y de pedidos en curso.'});
  return plan;
 }).sort((a,b)=>b.units90-a.units90||a.nombre.localeCompare(b.nombre));
 const recurrent=rank(orders,'falla');
 const diagnostics=rank(closures,'diagnostico');
 if(diagnostics.length)alerts.push({tone:'info',subject:'Prevención técnica',evidence:`Diagnóstico más registrado: ${diagnostics[0].label} (${diagnostics[0].total} cierres).`,action:'Revisar el procedimiento de inspección y la prueba de aceptación para este diagnóstico. Validar causas con evidencia técnica; frecuencia no demuestra causalidad.'});
 return {updatedAt:at,assets,parts,outcomes,incidents:recurrent,diagnostics,alerts,
  method:{prediction:'NOT_TRAINED',partsWindowDays:90,minimumIntervals:3,minimumHistoryDays:30,
   intervalDefinition:'Días entre reportes por falla; incluye tiempos fuera de operación. No es MTBF.',
   partDefinition:'Salidas físicas de repuestos, no consumo instalado confirmado. Proyecciones excluyen simulaciones.',
   outcomeDefinition:'Último cierre técnico de cada activo (tipo + serie). Sin cierre no equivale a no reparable.',
   purchaseDefinition:'Cobertura bajo demanda constante de 90 días. Faltan plazo del proveedor y pedidos en curso para fijar una fecha de compra.'}};
}
