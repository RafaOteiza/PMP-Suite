import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const APPEARANCE_KEY='pmp.appearance.v1';
export const APPEARANCE_OPTIONS=[
 {value:'system',label:'Automático',description:'Seguir la apariencia del dispositivo.',icon:'phone-portrait-outline'},
 {value:'light',label:'Claro',description:'Superficies claras y colores PMP.',icon:'sunny-outline'},
 {value:'dark',label:'Oscuro',description:'Superficies oscuras y contraste PMP.',icon:'moon-outline'},
];
const valid=value=>APPEARANCE_OPTIONS.some(option=>option.value===value);
const AppearanceContext=createContext(null);

export function AppearanceProvider({children}){
 const [preference,setPreference]=useState('system'),[ready,setReady]=useState(false);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const writing=useRef(false),mounted=useRef(false);
 useEffect(()=>{
  mounted.current=true;let active=true;
  AsyncStorage.getItem(APPEARANCE_KEY).then(value=>{if(active&&valid(value))setPreference(value);})
   .catch(()=>{if(active)setError('No se pudo leer la preferencia guardada. Se está usando la apariencia del dispositivo.');})
   .finally(()=>{if(active)setReady(true);});
  return()=>{active=false;mounted.current=false;};
 },[]);
 const select=async value=>{
  if(!ready||writing.current||!valid(value))return;
  writing.current=true;setPreference(value);setSaving(true);setError('');
  try{await AsyncStorage.setItem(APPEARANCE_KEY,value);}
  catch{if(mounted.current)setError('La apariencia se aplicó en esta sesión, pero no se pudo guardar. Selecciónala nuevamente para reintentar.');}
  finally{writing.current=false;if(mounted.current)setSaving(false);}
 };
 return <AppearanceContext.Provider value={{preference,ready,saving,error,select}}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(){
 const context=useContext(AppearanceContext),system=useColorScheme();
 const preference=context?.preference||'system';
 return {...context,preference,scheme:preference==='system'?(system==='dark'?'dark':'light'):preference};
}
