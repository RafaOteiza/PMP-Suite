import {PmpFeedback,PmpButton} from '../components/PmpUi';
import React,{useEffect,useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import api from '../services/api';
import TerrainWithdrawalForm from '../components/TerrainWithdrawalForm';
import {usePmpTheme,getGlobalStyles} from '../constants/styles';
export default function TerrainWithdrawalScreen({route,navigation}){
 const [order,setOrder]=useState(null),[error,setError]=useState(''),[done,setDone]=useState(false);
 const theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const code=route.params?.codigo_os;
 useEffect(()=>{let active=true;setOrder(null);setDone(false);setError('');
  api.get('/os/mis-ordenes').then(({data})=>{if(!active)return;const found=data.find(o=>o.codigo_os===code&&o.estado_nombre==='PENDIENTE_RETIRO');if(found)setOrder(found);else setError('La OS no pertenece a tus retiros pendientes.');}).catch(()=>{if(active)setError('No fue posible consultar la OS.');});
  return()=>{active=false;};
 },[code]);
 if(order&&!done)return <TerrainWithdrawalForm key={code} order={order} onClose={()=>navigation.goBack()} onSuccess={()=>setDone(true)}/>;
 return <View style={styles.container}><PmpFeedback tone={done?'success':error?'danger':'info'}>{done?'Retiro físico confirmado. Equipo en tránsito hacia Bodega.':error||'Cargando retiro…'}</PmpFeedback><PmpButton title="Volver a Mis Órdenes" secondary onPress={()=>navigation.goBack()}/></View>;
}
