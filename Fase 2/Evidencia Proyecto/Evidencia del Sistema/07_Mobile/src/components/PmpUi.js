import React from 'react';
import {View,Text,TouchableOpacity,TextInput,ActivityIndicator} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {getGlobalStyles,usePmpTheme,colors} from '../constants/styles';
import {assetIdentity} from '../../../shared/assetIdentity.js';

export function PmpButton({title,onPress,disabled=false,secondary=false,accessibilityLabel,tone='info',icon,loading=false}) {
 const theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const semantic=theme.tones?.[tone];
 return <TouchableOpacity activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={accessibilityLabel||title} accessibilityState={{disabled:disabled||loading,busy:loading}} disabled={disabled||loading} onPress={onPress}
  style={[styles.button,{flexDirection:'row',gap:8},tone!=='info'&&{backgroundColor:semantic?.bg,borderWidth:1,borderColor:semantic?.text},secondary&&{backgroundColor:theme.panel,borderWidth:1,borderColor:theme.border},(disabled||loading)&&{opacity:0.55}]}>
  {loading?<ActivityIndicator color={secondary?theme.link:colors.white}/>:icon?<Ionicons name={icon} size={20} color={secondary?theme.link:tone==='info'?colors.white:semantic?.text}/>:null}
  <Text style={[styles.buttonText,tone!=='info'&&{color:semantic?.text},secondary&&{color:theme.text}]}>{title}</Text>
 </TouchableOpacity>;
}
export function PmpFeedback({children,tone='warning'}) {
 const theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const semantic=theme.tones?.[tone];
 return <View style={[styles.feedback,{borderLeftColor:semantic?.text,backgroundColor:semantic?.bg,flexDirection:'row',gap:8}]}>
  <Ionicons name={tone==='success'?'checkmark-circle-outline':tone==='danger'?'alert-circle-outline':'information-circle-outline'} size={20} color={semantic?.text}/>
  <Text accessibilityRole={tone==='danger'?'alert':'text'} accessibilityLiveRegion="polite" style={[styles.secondaryText,{color:semantic?.text||theme.text,flex:1}]}>{children}</Text>
 </View>;
}
export function AssetIdentitySummary({asset}){
 const theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const type=asset.tipo_equipo||asset.tipo,series=asset.serie||asset.validador_serie||asset.consola_serie;
 const identity=assetIdentity(type,series);
 // Historical stored values remain visible. New masters are validated by the API.
 return <View style={styles.identity}><Text selectable style={[styles.bodyText,{fontWeight:'700'}]}>{type==='VALIDADOR'?'Validador':type==='CONSOLA'?'Consola':type} · {series}</Text>
  <Text style={styles.secondaryText}>{asset.modelo||identity.modelo||'Modelo no registrado'} · {asset.marca||identity.marca||'Marca no registrada'}</Text>
  {(asset.modelo&&identity.modelo&&asset.modelo!==identity.modelo||asset.marca&&identity.marca&&asset.marca!==identity.marca)&&<Text style={styles.secondaryText}>Datos históricos: identidad pendiente de revisión.</Text>}
 </View>;
}

// Presentation only: these labels never participate in FSM decisions.
export const statusLabel=value=>({PENDIENTE_RETIRO:'Pendiente de retiro',EN_TRANSITO:'En tránsito hacia Bodega',EN_RUTA:'En ruta',EN_OPERACION:'En operación',EN_DIAGNOSTICO:'En diagnóstico',EN_REPARACION:'En reparación',EN_QA:'En QA',CERRADO:'Cerrado',CANCELADO:'Cancelado',RECHAZADO:'Rechazado',INSTALADO:'Instalado',OPERATIVO:'Operativo',ASIGNADO_TECNICO:'Asignado a técnico',PENDIENTE_SALIDA:'Pendiente de salida',DISPONIBLE_INSTALACION:'Disponible para instalación',PENDIENTE_VERIFICACION_BODEGA:'Pendiente de validación'}[value]||String(value||'Sin estado').replaceAll('_',' ').toLocaleLowerCase('es').replace(/^./,c=>c.toUpperCase()));
export function StatusBadge({status,label,tone}){
 const theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const semantic=tone||(/RECHAZ|FALL|BLOQUE|CANCEL/.test(status)?'danger':/CERRADO|OPERATIVO|INSTALADO|APROBADO|DISPONIBLE_INSTALACION/.test(status)?'success':/PENDIENTE|ESPERA/.test(status)?'warning':status?'info':'neutral');
 const palette=theme.tones?.[semantic];
 return <View style={[styles.badge,{backgroundColor:palette?.bg}]}><Text style={[styles.badgeText,{color:palette?.text}]}>{label||statusLabel(status)}</Text></View>;
}
export function AppCard({children,style}){const s=getGlobalStyles(usePmpTheme());return <View style={[s.card,style]}>{children}</View>;}
export function SectionHeader({title,description}){const s=getGlobalStyles(usePmpTheme());return <View style={{marginBottom:12}}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>{description&&<Text style={s.secondaryText}>{description}</Text>}</View>;}
export function EmptyState({title='Sin resultados',description,icon='document-text-outline'}){const theme=usePmpTheme(),s=getGlobalStyles(theme);return <View style={[s.card,{alignItems:'center',paddingVertical:24}]}><Ionicons name={icon} size={32} color={theme.muted}/><Text style={[s.sectionTitle,{marginTop:12,textAlign:'center'}]}>{title}</Text>{description&&<Text style={[s.secondaryText,{textAlign:'center'}]}>{description}</Text>}</View>;}
export function AppInput({label,style,...props}){const theme=usePmpTheme(),s=getGlobalStyles(theme);const [focused,setFocused]=React.useState(false);return <View><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={theme.muted} selectionColor={theme.link} {...props} onFocus={e=>{setFocused(true);props.onFocus?.(e);}} onBlur={e=>{setFocused(false);props.onBlur?.(e);}} style={[s.input,style,props.editable===false&&{backgroundColor:theme.bg},focused&&{borderColor:theme.link}]}/></View>;}
