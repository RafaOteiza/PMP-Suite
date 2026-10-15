import {PmpButton as Button,AssetIdentitySummary,PmpFeedback,EmptyState,statusLabel,AppCard,SectionHeader,StatusBadge} from '../components/PmpUi';
import {useAuth} from '../context/AuthContext';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View, ActivityIndicator, Image } from 'react-native';
import api from '../services/api';
import { getGlobalStyles, usePmpTheme } from '../constants/styles';

function WithdrawalPhotos({event}){
 const m=event.detalle?.metadata||event.detalle,theme=usePmpTheme(),styles=getGlobalStyles(theme);
 if(!m?.fotografias?.length)return null;
 return <View>{m.pod&&<View style={styles.badge}><Text style={[styles.badgeText,{color:theme.text}]}>PoD detectado</Text></View>}<Text style={{color:theme.text}}>Evidencia fotográfica del retiro</Text>{m.fotografias.map((p,i)=><Image key={i} accessibilityLabel={`Evidencia de retiro ${i+1}`} source={{uri:`data:image/jpeg;base64,${p.base64}`}} style={{width:'100%',height:240,marginVertical:8}} resizeMode="contain"/>)}</View>;
}
const withdrawalState=statusLabel;
function TechnicalHistory({history}) {
 const theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const interventions=history.intervenciones||[];
 const tone=result=>['Reparado','NFF confirmado','Operativo'].includes(result)?'success':['Rechazado','No reparable','Falla persistente'].includes(result)?'danger':result?'info':'neutral';
 const stateTone=/rechaz|falla|fuera de servicio/i.test(history.estado_actual||'')?'danger':/pendiente|por verificar/i.test(history.estado_actual||'')?'warning':/^(En operación|Operativo|Disponible para instalación)$/i.test(history.estado_actual||'')?'success':!history.estado_actual||/^Sin /i.test(history.estado_actual)?'neutral':'info';
 return <>
  <AssetIdentitySummary asset={history}/>
  <Text style={styles.label}>Estado actual</Text><StatusBadge label={history.estado_actual||'Sin estado registrado'} tone={stateTone}/>
  <SectionHeader title="Historial técnico" description="Fallas e intervenciones, de la más reciente a la más antigua."/>
  {!interventions.length&&<EmptyState title="Sin fallas ni reparaciones registradas"/>}
  {interventions.map(item=><AppCard key={item.codigo_os}>
   <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}><Text style={styles.label}>{item.codigo_os}</Text><StatusBadge label={item.resultado||(item.pendiente?'Pendiente':'Sin resultado registrado')} tone={item.resultado?tone(item.resultado):item.pendiente?'warning':'neutral'}/></View>
   <Text style={styles.secondaryText}>{item.fecha?new Date(item.fecha).toLocaleString('es-CL'):'Fecha no registrada'}</Text>
   {[
    ['Falla reportada',item.falla_reportada||'Sin registro'],
    ['Diagnóstico confirmado',item.diagnostico||(item.pendiente?'Pendiente de diagnóstico':'Sin diagnóstico registrado')],
    ['Trabajo realizado',item.trabajo_realizado||(item.pendiente?'Intervención pendiente':'Sin intervención registrada')],
   ].map(([label,value])=><View key={label} style={{marginTop:8}}><Text style={styles.secondaryText}>{label}</Text><Text style={styles.bodyText}>{value}</Text></View>)}
   {!!item.observaciones?.length&&<View style={{marginTop:8}}><Text style={styles.secondaryText}>Observaciones técnicas</Text>{item.observaciones.map((value,i)=><Text key={i} style={styles.bodyText}>{value}</Text>)}</View>}
  </AppCard>)}
 </>;
}
export default function AssetHistoryScreen({ route }) {
  const {user}=useAuth();
  const terrain=user?.rol==='tecnico_terreno';
  const [query,setQuery]=useState(route.params?.serie||'');
  const [matches,setMatches]=useState([]),[history,setHistory]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [cases, setCases] = useState([]), [caseHistory, setCaseHistory] = useState(null);
  const theme=usePmpTheme(),styles=getGlobalStyles(theme);
  const load=async(asset)=>{
    setBusy(true);setError('');setHistory(null);setCaseHistory(null);setCases([]);
    try {
      const {data}=await api.get(`/bridge/activos/${encodeURIComponent(asset.tipo_equipo)}/${encodeURIComponent(asset.serie)}/historial`);
      if(terrain&&!Array.isArray(data?.intervenciones))throw new Error('Technical history contract unavailable');
      setHistory(data);setMatches([]);
    }
    catch(e){setError(e.response?.data?.message||'No se pudo consultar el historial.');}finally{setBusy(false);}
  };
  const loadCase=async(id)=>{
    if(terrain)return;
    setBusy(true);setError('');setHistory(null);setMatches([]);setCases([]);setCaseHistory(null);
    try { setCaseHistory((await api.get(`/requerimientos/${encodeURIComponent(id)}`)).data); }
    catch(e){setError(e.response?.data?.message||'No se pudo consultar el caso.');}finally{setBusy(false);}
  };
  const search=async()=>{
    setBusy(true);setError('');setHistory(null);setMatches([]);setCases([]);setCaseHistory(null);
    try{const [{data},{data:caseMatches}]=await Promise.all([api.get('/bridge/buscar',{params:{q:query.trim()}}),terrain?Promise.resolve({data:[]}):api.get('/requerimientos',{params:{q:query.trim()}})]);setMatches(data);setCases(caseMatches);
      const exact=data.filter(a=>a.serie.toUpperCase()===query.trim().toUpperCase());
      if(exact.length===1)await load(exact[0]);else if(data.length===1&&!caseMatches.length)await load(data[0]);else if(!data.length&&!caseMatches.length)setError('No se encontraron activos ni casos.');
    }catch{setError('No se pudo buscar el activo.');}finally{setBusy(false);}
  };
  useEffect(()=>{if(route.params?.caso_id&&!terrain)void loadCase(route.params.caso_id);else if(route.params?.serie&&route.params?.tipo_equipo)void load(route.params);},[route.params?.serie,route.params?.tipo_equipo,route.params?.caso_id,terrain]);
  const date=value=>value?new Date(value).toLocaleString():'Sin fecha';
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content,{gap:8}]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={styles.label}>Serie, OS PMP u OS Aranda</Text>
    <TextInput placeholder="Serie, OS PMP u OS Aranda" placeholderTextColor={theme.muted} returnKeyType="search" style={styles.input} accessibilityLabel="Serie, OS PMP u OS Aranda" value={query} maxLength={120} onChangeText={setQuery} onSubmitEditing={()=>!busy&&query.trim()&&search()}/>
    <Button title="Buscar historial" disabled={busy||!query.trim()} onPress={search}/>
    {busy&&<ActivityIndicator accessibilityLabel="Cargando historial" color={theme.link}/>}{!!error&&<PmpFeedback tone="danger">{error}</PmpFeedback>}
    {!busy&&!error&&!history&&!caseHistory&&!matches.length&&!cases.length&&<EmptyState title={terrain?'Consulta el historial técnico':'Consulta la vida del activo'} description={terrain?'Busca por serie, OS PMP o referencia para consultar fallas e intervenciones.':'Busca su serie o una referencia de intervención para ver fechas, eventos y evidencias.'} icon="search-outline"/>}
    {matches.map(a=><Button key={`${a.tipo_equipo}:${a.serie}`} title={`${a.tipo_equipo} · ${a.serie}`} disabled={busy} onPress={()=>load(a)}/>)}
    {!terrain&&cases.map(c=><Button key={c.id} title={`Caso ${c.codigo_caso} · ${c.bus_ppu}`} disabled={busy} onPress={()=>loadCase(c.id)}/>)}
    {!terrain&&caseHistory&&<>
      <Text style={styles.label}>Caso {caseHistory.caso.codigo_caso} · {caseHistory.caso.origen}</Text>
      <Text style={styles.label}>{caseHistory.caso.falla_reportada} · Bus {caseHistory.caso.bus_ppu} · {caseHistory.caso.terminal || 'Sin terminal'}</Text>
      <Text style={styles.label}>Intervenciones relacionadas</Text>
      {caseHistory.ordenes.map(o=><View key={o.codigo_os} style={styles.card}><Text style={styles.label}>{o.codigo_os} · {withdrawalState(o.estado_nombre || o.estado)}</Text><Text style={styles.label}>{o.tipo_equipo} · Serie {o.serie}</Text><Text style={styles.label}>{o.bus_ppu} · {o.tecnico_nombre || 'Sin técnico'} · {date(o.fecha)}</Text>{!!o.os_origen&&<Text style={styles.label}>OS origen: {o.os_origen}</Text>}<Button title="Ver historial individual del activo" onPress={()=>load(o)}/></View>)}
      <Text style={styles.label}>Referencias externas</Text>
      {caseHistory.referencias.map(r=><Text key={r.id} style={styles.label}>{r.sistema_externo} · {r.referencia_externa} ↔ {r.codigo_os}</Text>)}
      <Text style={styles.label}>Eventos del caso</Text>
      {caseHistory.eventos.map(e=><View key={e.id} style={styles.card}><Text style={styles.label}>{e.codigo_os} · {date(e.fecha)} · {e.titulo||statusLabel(e.tipo)}</Text><Text style={styles.label}>{e.comentario} {e.descripcion}</Text><WithdrawalPhotos event={e}/></View>)}
    </>}
    {history&&terrain&&<TechnicalHistory history={history}/>}
    {history&&!terrain&&<><AssetIdentitySummary asset={history}/>
      <Text style={styles.label}>Intervenciones / OS PMP ({history.ordenes.length})</Text>
      {history.ordenes.map(o=><View key={o.codigo_os} style={styles.card}><Text style={styles.label}>{o.codigo_os} · {date(o.fecha)}</Text><Text style={styles.label}>{o.falla} · {withdrawalState(o.estado)}</Text>
        {!!o.caso_id&&<Button title={`Ver caso ${o.codigo_caso || o.caso_id}`} onPress={()=>loadCase(o.caso_id)}/>}
        {history.referencias.filter(r=>r.codigo_os===o.codigo_os).map(r=><Text key={r.id} style={styles.label}>{r.sistema_externo} · {r.referencia_externa} · {date(r.fecha)}</Text>)}
      </View>)}
      {!history.ordenes.length&&<Text style={styles.label}>Sin OS PMP.</Text>}
      <Text style={styles.label}>Referencias externas ({history.referencias.length})</Text>
      {history.referencias.map(r=><View key={r.id} style={styles.card}><Text style={styles.label}>{r.sistema_externo} · {r.referencia_externa}</Text><Text style={styles.label}>OS PMP: {r.codigo_os||'Sin vínculo histórico'} · {date(r.fecha)}</Text><Text style={styles.label}>{r.comentario||''}</Text></View>)}
      <Text style={styles.label}>Eventos ({history.eventos.length})</Text>
      {history.eventos.map(e=><View key={e.id} style={styles.card}><Text style={styles.label}>{e.titulo||statusLabel(e.tipo)}</Text><Text style={styles.secondaryText}>{date(e.fecha)} · {e.codigo_os||'Activo'}</Text><Text style={styles.bodyText}>{e.comentario||''} {e.descripcion}</Text><WithdrawalPhotos event={e}/>{e.cambios.map(c=><Text key={c.campo} style={styles.secondaryText}>{c.campo.replaceAll('_',' ')}: {String(c.campo).includes('estado')?statusLabel(c.anterior):c.anterior} → {String(c.campo).includes('estado')?statusLabel(c.actual):c.actual}</Text>)}</View>)}
    </>}
  </ScrollView>;
}
