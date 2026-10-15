import React,{useRef,useState} from 'react';
import {View,Text,ScrollView,Switch} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import api,{apiErrorMessage} from '../services/api';
import {getGlobalStyles,usePmpTheme} from '../constants/styles';
import {AssetIdentitySummary,PmpButton,PmpFeedback,SectionHeader,AppInput,EmptyState} from '../components/PmpUi';

export default function NewOrderScreen(){
 const theme=usePmpTheme(),styles=getGlobalStyles(theme),navigation=useNavigation();
 const [type,setType]=useState('VALIDADOR'),[ppu,setPpu]=useState(''),[series,setSeries]=useState('');
 const [selected,setSelected]=useState(null),[results,setResults]=useState([]),[more,setMore]=useState(false);
 const [fault,setFault]=useState(''),[pod,setPod]=useState(false),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
 const [error,setError]=useState(''),[created,setCreated]=useState('');const revision=useRef(0);
 const clear=()=>{revision.current++;setSelected(null);setResults([]);setPpu('');setSeries('');setMore(false);setSearched(false);setError('');};
 const search=async()=>{
  const version=++revision.current;setBusy(true);setError('');
  try{const {data}=await api.get('/os/activos-operativos',{params:{tipo_equipo:type,q:series,bus_ppu:ppu,limit:6}});
   if(version===revision.current){setResults(data.items);setMore(data.has_more);setSearched(true);}
  }catch(e){if(version===revision.current)setError(apiErrorMessage(e));}finally{setBusy(false);}
 };
 const select=asset=>{revision.current++;setSelected(asset);setPpu(asset.bus_ppu);setSeries(asset.serie);setResults([]);setError('');};
 const submit=async()=>{
  if(!selected||!fault.trim()||busy)return;
  setBusy(true);setError('');
  try{const {data}=await api.post('/os/crear',{tipo:type,serie_equipo:selected.serie,bus_ppu:selected.bus_ppu,terminal_id:selected.terminal_id,pst_codigo:selected.pst_codigo,falla:fault.trim(),es_pod:pod});setCreated(data.os.codigo_os);}
  catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}
 };
 if(created)return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><PmpFeedback tone="success">OS {created} creada. El activo permanece instalado hasta confirmar su retiro físico.</PmpFeedback><PmpButton title="Volver a la bandeja" onPress={()=>navigation.goBack()}/></ScrollView>;
 return <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
  <SectionHeader title="1. Activo en operación" description="Busca por PPU o serie. Los datos de instalación se completan automáticamente."/>
  {!!error&&<PmpFeedback tone="danger">{error}</PmpFeedback>}
  <View style={styles.card}>
   <Text style={styles.label}>Tipo de equipo</Text>
   <View style={{flexDirection:'row',gap:8,marginBottom:12}}>{['VALIDADOR','CONSOLA'].map(value=><View key={value} style={{flex:1}}><PmpButton title={value==='VALIDADOR'?'Validador':'Consola'} secondary={type!==value} disabled={busy} onPress={()=>{clear();setType(value);}}/></View>)}</View>
   <AppInput label="Bus / PPU" accessibilityLabel="Bus / PPU" style={styles.input} placeholder="PPU o parte de ella" placeholderTextColor={theme.muted} value={ppu} editable={!selected&&!busy} autoCapitalize="characters" maxLength={6} onChangeText={value=>{setPpu(value.toUpperCase());setResults([]);setSearched(false);}}/>
   <AppInput label="Serie" accessibilityLabel="Serie del activo" style={styles.input} placeholder="Serie o parte de ella" placeholderTextColor={theme.muted} value={series} editable={!selected&&!busy} onChangeText={value=>{setSeries(value);setResults([]);setSearched(false);}}/>
   {selected?<><AssetIdentitySummary asset={selected}/><Text style={styles.label}>Instalación vigente · Solo lectura</Text><Text style={styles.bodyText}>{selected.bus_ppu} · {selected.terminal||'Terminal pendiente de revisión'} · {selected.operador||'Operador pendiente de revisión'}</Text><PmpButton title="Cambiar activo o PPU" secondary disabled={busy} onPress={clear}/></>:<>
    <PmpButton title={busy?'Consultando…':'Buscar activos en operación'} disabled={busy} secondary onPress={search}/>
    {searched&&!results.length&&!error&&<EmptyState title="Sin coincidencias" description="Revisa el tipo, serie o PPU."/>}
    <ScrollView nestedScrollEnabled style={{maxHeight:360}}>{results.map(asset=><View key={`${asset.tipo_equipo}:${asset.serie}`} style={styles.identity}><AssetIdentitySummary asset={asset}/><Text style={styles.secondaryText}>{asset.bus_ppu} · {asset.terminal} · {asset.operador}</Text><PmpButton title={`Seleccionar ${asset.serie}`} secondary onPress={()=>select(asset)}/></View>)}</ScrollView>
    {more&&<Text style={styles.secondaryText}>Hay más coincidencias. Completa parte de la serie o PPU para acotar la búsqueda.</Text>}
   </>}
  </View>
  <SectionHeader title="2. Falla observada"/><View style={styles.card}><AppInput label="Falla reportada" accessibilityLabel="Falla reportada" style={[styles.input,{minHeight:96,textAlignVertical:'top'}]} multiline value={fault} editable={!busy} placeholder="Describe la falla observada" placeholderTextColor={theme.muted} onChangeText={setFault}/>
   <Text style={styles.label}>Daño atribuible a tercero (PoD)</Text><Switch trackColor={{true:theme.link}} accessibilityLabel="Clasificar requerimiento como PoD" value={pod} disabled={busy} onValueChange={setPod}/>
   <Text style={styles.secondaryText}>La identidad y evidencia se validan al retirar físicamente el equipo.</Text>
  </View>
  <PmpButton title={busy?'Procesando…':'Crear requerimiento'} disabled={busy||!selected||!selected.terminal_id||!selected.pst_codigo||!fault.trim()} onPress={submit}/>
 </ScrollView>;
}
