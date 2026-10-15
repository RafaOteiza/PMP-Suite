import {PmpButton,PmpFeedback,StatusBadge,AppInput} from '../components/PmpUi';
﻿import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Image, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { colors, getGlobalStyles, usePmpTheme } from '../constants/styles';

const reasons=[['QR_ILEGIBLE','QR ilegible'],['QR_INEXISTENTE','QR inexistente'],['ETIQUETA_DANADA','Etiqueta dañada'],['CAMARA_NO_DISPONIBLE','Cámara no disponible'],['OTRO','Otro']];
const categories=[['GOLPE','Golpe'],['ROTURA','Rotura'],['VANDALISMO','Vandalismo'],['LIQUIDO','Líquido'],['OTRO','Otro']];
export default function TerrainWithdrawalForm({order,onClose,onSuccess}){
  const theme=usePmpTheme(),styles=getGlobalStyles(theme);
  const [permission,requestPermission]=useCameraPermissions();
  const [camera,setCamera]=useState(false),[manual,setManual]=useState(false),[reading,setReading]=useState('');
  const [reason,setReason]=useState(''),[manualNote,setManualNote]=useState(''),[validation,setValidation]=useState(null);
  const [pod,setPod]=useState(null),[category,setCategory]=useState(''),[note,setNote]=useState(''),[photos,setPhotos]=useState([]);
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const working=useRef(false),scanHandled=useRef(false);
  const resetIdentity=()=>{setValidation(null);setConfirmed(false);setPod(null);setMessage('');setError('');};
  const run=async task=>{if(working.current)return;working.current=true;setBusy(true);setError('');setMessage('');try{await task();}catch(e){setError(e.response?.data?.message||e.message||'No se pudo completar la operación. Intenta nuevamente.');}finally{working.current=false;setBusy(false);}};
  const validate=(code,method)=>run(async()=>{
    resetIdentity();
    const {data}=await api.post('/os/validar-identidad-retiro',{codigo_os:order.codigo_os,codigo_leido:code,metodo_validacion:method,
      ...(method==='MANUAL'?{motivo_manual:reason,observacion_manual:manualNote}:{})});
    setValidation(data);
  });
  const scan=()=>run(async()=>{
    resetIdentity();setManual(false);
    const grant=permission?.granted?permission:await requestPermission();
    if(!grant.granted){setError('No hay permiso de cámara. Habilítalo en ajustes o usa «No puedo escanear el código».');return;}
    scanHandled.current=false;setCamera(true);
  });
  const photograph=()=>run(async()=>{
    setConfirmed(false);
    const grant=await ImagePicker.requestCameraPermissionsAsync();
    if(!grant.granted){setError('Se necesita permiso de cámara para tomar la evidencia. Habilítalo en los ajustes del teléfono.');return;}
    const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:0.45,base64:true,exif:false});
    if(result.canceled)return;
    const photo=result.assets?.[0];
    if(!photo?.base64||photo.base64.length>1398104){setError('La fotografía supera 1 MB o no se pudo leer. Tómala nuevamente con menor resolución.');return;}
    setPhotos(current=>[...current,{base64:photo.base64,uri:photo.uri,origen:'CAMARA'}].slice(0,3));
  });
  const ready=validation?.coincide===true&&(pod===false||(pod===true&&!!category&&!!note.trim()&&photos.length>0));
  const confirm=()=>run(async()=>{
    if(!ready||!confirmed)return;
    await api.post('/os/confirmar-retiro',{codigo_os:order.codigo_os,tipo_equipo:order.tipo_equipo,serie:order.serie,bus_ppu:order.bus_ppu,
      validacion_id:validation.validacion_id,retiro_confirmado:true,pod,categoria_pod:pod?category:null,evidencia:note,
      fotografias:photos.map(({base64,origen})=>({base64,origen}))});
    await onSuccess();
  });
  const action=(label,onPress,{disabled=false,secondary=false,icon}={})=><PmpButton title={label} onPress={onPress} disabled={busy||disabled} secondary={secondary} icon={icon}/>;
  const choices=(items,value,change,label)=><View accessibilityLabel={label} style={local.choices}>{items.map(([id,title])=><TouchableOpacity key={id} accessibilityRole="radio" accessibilityState={{checked:value===id,disabled:busy}} accessibilityLabel={title} disabled={busy} onPress={()=>{change(id);setConfirmed(false);}}
    style={[local.choice,{borderColor:value===id?colors.primary:theme.border,backgroundColor:value===id?colors.primary:theme.panel}]}><Text style={{color:value===id?colors.white:theme.text}}>{title}</Text></TouchableOpacity>)}</View>;
  const field=(label,value,onChange,max=4000)=><AppInput label={label} editable={!busy} style={local.input} value={value} onChangeText={onChange} multiline={max>64} maxLength={max} autoCapitalize={max<=64?'characters':'sentences'}/>;
  const datum=(label,value)=><View style={local.datum}><Text style={[styles.label,local.caption]}>{label}</Text><Text selectable style={{color:theme.text,fontWeight:'600'}}>{value||'Sin registro'}</Text></View>;
  return <View style={[local.screen,{backgroundColor:theme.bg}]}>
      <ScrollView contentContainerStyle={[styles.content,local.body]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={{color:theme.text,fontWeight:'700'}}>{order.codigo_os} · {order.tipo_equipo}</Text>
        <Text style={{color:theme.muted}}>{order.bus_ppu} · {order.terminal}</Text>
        <StatusBadge status="PENDIENTE_RETIRO"/>
        {!!error&&<PmpFeedback tone="danger">{error}</PmpFeedback>}
        {!!message&&<PmpFeedback tone="success">{message}</PmpFeedback>}
        {camera?<>
          <Text style={{color:theme.text}}>Apunta al QR o código de barras del equipo.</Text>
          <CameraView style={local.camera} facing="back" barcodeScannerSettings={{barcodeTypes:['qr','code128','code39','ean13','ean8','upc_a','upc_e','pdf417','datamatrix']}}
            onMountError={()=>{setCamera(false);setError('La cámara no está disponible. Puedes usar la contingencia manual.');}}
            onBarcodeScanned={({data})=>{if(scanHandled.current||working.current)return;scanHandled.current=true;setCamera(false);void validate(data,'SCAN');}}/>
          {action('Cancelar escaneo',()=>setCamera(false),{secondary:true})}
        </>:<>
          <Text style={styles.label}>Equipo esperado</Text><View style={local.context}>
            {datum('Serie',order.serie)}{datum('Bus / PPU',order.bus_ppu)}{datum('Modelo',order.modelo)}{datum('Marca',order.marca)}
            {datum('Terminal',order.terminal)}{datum('Operador',order.operador)}{datum('Caso / referencia AR',order.referencia_ar||order.referencia_externa||order.codigo_caso)}{datum('Técnico',order.tecnico||order.tecnico_nombre)}
          </View><Text style={styles.label}>Falla reportada</Text><Text style={{color:theme.text}}>{order.falla}</Text>
          {action('Escanear equipo',scan,{icon:'scan-outline'})}
          {action('No puedo escanear el código',()=>{resetIdentity();setManual(true);setReading('');},{secondary:true})}
          {manual&&<>
            <PmpFeedback>Contingencia manual: quedará registrado que no hubo escaneo físico.</PmpFeedback>
            {field('Serie manual',reading,value=>{setReading(value);resetIdentity();},64)}
            <Text style={styles.label}>Motivo de contingencia</Text>{choices(reasons,reason,value=>{setReason(value);resetIdentity();},'Motivo de contingencia')}
            {field('Observación de contingencia',manualNote,value=>{setManualNote(value);resetIdentity();},1000)}
            {action('Validar serie manual',()=>validate(reading,'MANUAL'),{disabled:!reading||!reason||!manualNote.trim(),secondary:true})}
          </>}
          {validation&&!validation.coincide&&<>
            <Text accessibilityRole="alert" style={{color:theme.tones?.warning.text,fontWeight:'700'}}>Equipo distinto al esperado</Text>
            <Text style={{color:theme.text}}>Esperado: {order.tipo_equipo} {order.serie}{'\n'}Encontrado: {validation.encontrado?.tipo_equipo} {validation.encontrado?.serie||'Identificador no resuelto'}{'\n'}Bus: {order.bus_ppu}{'\n'}Código leído: {validation.codigo_leido}</Text>
            {field('Observación de discrepancia',note,setNote)}
            {action('Registrar discrepancia',()=>run(async()=>{await api.post('/os/discrepancia-retiro',{codigo_os:order.codigo_os,validacion_id:validation.validacion_id,observacion:note});setMessage('Discrepancia registrada. No se confirmó el retiro.');}),{disabled:!note.trim(),secondary:true})}
          </>}
          {validation?.coincide&&<>
            <Text accessibilityRole="alert" style={{color:theme.tones?.success.text,fontWeight:'700'}}>✓ Equipo validado</Text>
            <Text style={{color:theme.text}}>Serie detectada: {validation.encontrado.serie}. Coincide con el activo esperado para {order.bus_ppu}.</Text>
            <Text style={{color:theme.muted}}>{validation.metodo_validacion==='SCAN'?'Escaneo con cámara':'Validación manual de contingencia, sin escaneo'}</Text>
            <Text style={styles.label}>¿Se detecta daño atribuible a tercero (PoD)?</Text>
            {choices([[false,'No'],[true,'Sí']],pod,setPod,'Condición PoD')}
            {pod===false&&<Text style={{color:theme.muted}}>La observación y las fotografías son opcionales para este retiro sin PoD.</Text>}
            {pod===true&&<><Text style={styles.label}>Evidencia PoD</Text><Text style={{color:theme.muted}}>Registra vista general, detalle del daño o etiqueta. La OS conserva su identificador.</Text>{choices(categories,category,setCategory,'Tipo de daño PoD')}</>}
            {field(pod?'Observación técnica':'Observación del retiro',note,value=>{setNote(value);setConfirmed(false);})}
          </>}
          {(validation?.coincide||manual)&&<>
            {action(pod?'Tomar fotografía PoD':'Agregar evidencia fotográfica',photograph,{disabled:photos.length>=3,secondary:true,icon:'camera-outline'})}
            <Text style={{color:theme.muted}}>{photos.length} fotografías adjuntas · máximo 3 de 1 MB · cámara</Text>
            <View style={local.choices}>{photos.map((photo,i)=><View key={photo.uri||i}><Image source={{uri:photo.uri}} accessibilityLabel={`Fotografía ${i+1}`} style={local.thumbnail}/>{action(`Eliminar foto ${i+1}`,()=>{setPhotos(current=>current.filter((_,index)=>index!==i));setConfirmed(false);},{secondary:true})}</View>)}</View>
          </>}
          {pod===true&&!photos.length&&<Text style={{color:theme.tones?.warning.text}}>Agrega al menos una fotografía válida para confirmar PoD.</Text>}
          <View style={[local.confirmation,{borderColor:theme.border}]}><Text style={{color:theme.text,flex:1}}>Confirmo que retiré físicamente este equipo del bus {order.bus_ppu}</Text><Switch trackColor={{true:theme.link}} accessibilityLabel="Confirmar retiro físico" disabled={busy||!ready} value={confirmed} onValueChange={setConfirmed}/></View>
          {action(busy?'Procesando…':'Confirmar retiro hacia Bodega',confirm,{disabled:!ready||!confirmed})}
        </>}
        {action('Volver a Mis Órdenes',onClose,{secondary:true})}
      </ScrollView>
  </View>;
}
const local=StyleSheet.create({screen:{flex:1},body:{padding:16,gap:12},context:{flexDirection:'row',flexWrap:'wrap',gap:12},datum:{flexBasis:'46%',flexGrow:1},caption:{fontSize:12,marginBottom:4},input:{padding:12,borderRadius:12,marginBottom:0},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{borderWidth:1,borderRadius:12,padding:12,minHeight:48},camera:{height:300,borderRadius:12},thumbnail:{width:110,height:110,borderRadius:8},confirmation:{borderTopWidth:1,paddingTop:12,flexDirection:'row',alignItems:'center',gap:8}});

