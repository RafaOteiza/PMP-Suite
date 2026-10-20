import React,{useEffect,useRef,useState} from 'react';
import {View,Text,ScrollView,TouchableOpacity,KeyboardAvoidingView,Platform} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useHeaderHeight} from '@react-navigation/elements';
import {useAuth} from '../context/AuthContext';
import {useAppearance,APPEARANCE_OPTIONS} from '../context/AppearanceContext';
import {usePmpTheme,getGlobalStyles} from '../constants/styles';
import {AppCard,AppInput,PmpButton,PmpFeedback,SectionHeader,StatusBadge,EmptyState} from '../components/PmpUi';
import {changeOwnPassword,passwordErrorMessage,passwordProviderAvailable} from '../services/accountSecurity';

const roleLabels={admin:'Administrador',logistica:'Logística',qa:'Control QA',gerente:'Gerente',tecnico_terreno:'Técnico en terreno',tecnico_laboratorio:'Técnico de laboratorio'};

export function SettingsScreen({navigation}){
 const {user,logout}=useAuth(),theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const leave=async()=>{if(busy)return;setBusy(true);setError('');try{await logout();}catch{setError('No se pudo cerrar la sesión. Intenta nuevamente.');}finally{setBusy(false);}};
 if(!user)return null;
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <SectionHeader title="Tu cuenta PMP" description="Perfil, apariencia y seguridad de tu sesión."/>
  {!!error&&<PmpFeedback tone="danger">{error}</PmpFeedback>}
  {[
   ['MyProfile','Mi perfil','Consulta tus datos institucionales.','person-circle-outline'],
   ['Appearance','Apariencia','Automático, claro u oscuro.','contrast-outline'],
   ['ChangePassword','Cambiar contraseña','Seguridad de tu cuenta.','lock-closed-outline'],
  ].map(([route,title,description,icon])=><TouchableOpacity key={route} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled:busy}} disabled={busy} activeOpacity={0.7} style={[styles.card,{flexDirection:'row',alignItems:'center',gap:12,minHeight:72}]} onPress={()=>navigation.navigate(route)}>
    <Ionicons name={icon} size={24} color={theme.link}/><View style={{flex:1}}><Text style={styles.label}>{title}</Text><Text style={styles.secondaryText}>{description}</Text></View><Ionicons name="chevron-forward" size={20} color={theme.muted}/>
   </TouchableOpacity>)}
  <PmpButton title={busy?'Cerrando sesión…':'Cerrar sesión'} secondary icon="log-out-outline" loading={busy} onPress={leave}/>
 </ScrollView>;
}

export function ProfileScreen(){
 const {user}=useAuth(),theme=usePmpTheme(),styles=getGlobalStyles(theme);
 if(!user)return <EmptyState title="Sesión no disponible" description="Vuelve a iniciar sesión para consultar tu perfil."/>;
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <SectionHeader title="Datos institucionales" description="Información de tu cuenta PMP. Perfil de solo lectura."/>
  <AppCard>
   {[
    ['Nombre',user.nombre],['Apellido',user.apellido],['Correo institucional',user.correo||user.email],['Rol',roleLabels[user.rol]||'Rol no disponible'],
   ].map(([label,value],index)=><View key={label} style={{paddingVertical:12,borderTopWidth:index?1:0,borderColor:theme.border}}><Text style={styles.secondaryText}>{label}</Text><Text selectable style={styles.bodyText}>{value||'No disponible'}</Text></View>)}
   {typeof user.activo==='boolean'&&<View style={{paddingTop:12,borderTopWidth:1,borderColor:theme.border}}><Text style={styles.label}>Estado de cuenta</Text><StatusBadge label={user.activo?'Activa':'Inactiva'} tone={user.activo?'success':'neutral'}/></View>}
  </AppCard>
 </ScrollView>;
}

export function AppearanceScreen(){
 const theme=usePmpTheme(),styles=getGlobalStyles(theme),{preference,scheme,ready,saving,error,select}=useAppearance();
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <SectionHeader title="Elige cómo ver PMP" description="La preferencia se guarda en este dispositivo, también para la pantalla de acceso."/>
  {!!error&&<PmpFeedback tone="warning">{error}</PmpFeedback>}
  <View accessibilityRole="radiogroup" accessibilityLabel="Tema de PMP Suite">
   {APPEARANCE_OPTIONS.map(({value,label,description,icon})=><TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityHint={description} accessibilityState={{checked:preference===value,disabled:!ready||saving}} disabled={!ready||saving} activeOpacity={0.7} onPress={()=>select(value)} style={[styles.card,{flexDirection:'row',alignItems:'center',gap:12,minHeight:72,borderColor:preference===value?theme.link:theme.border,backgroundColor:preference===value?theme.tones.info.bg:theme.card}]}>
    <Ionicons name={icon} size={24} color={theme.link}/><View style={{flex:1}}><Text style={styles.label}>{label}</Text><Text style={styles.secondaryText}>{description}</Text></View><Ionicons name={preference===value?'radio-button-on-outline':'radio-button-off-outline'} size={22} color={preference===value?theme.link:theme.muted}/>
   </TouchableOpacity>)}
  </View>
  <Text accessibilityLiveRegion="polite" style={styles.secondaryText}>{saving?'Guardando preferencia…':`Apariencia actual: ${scheme==='dark'?'oscura':'clara'}.`}</Text>
 </ScrollView>;
}

function PasswordField({label,value,onChange,disabled,autoComplete,error}){
 const theme=usePmpTheme(),[visible,setVisible]=useState(false);
 useEffect(()=>{if(!value)setVisible(false);},[value]);
 return <View>
 <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
  <View style={{flex:1}}><AppInput label={label} value={value} onChangeText={onChange} editable={!disabled} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete={autoComplete} textContentType={autoComplete==='current-password'?'password':'newPassword'} accessibilityHint={error||undefined} style={error?{borderColor:theme.tones.danger.text}:undefined}/></View>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${visible?'Ocultar':'Mostrar'} ${label.toLocaleLowerCase('es')}`} accessibilityState={{disabled}} disabled={disabled} onPress={()=>setVisible(v=>!v)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',marginTop:12}}><Ionicons name={visible?'eye-off-outline':'eye-outline'} size={24} color={theme.link}/></TouchableOpacity>
 </View>
 {!!error&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[getGlobalStyles(theme).secondaryText,{color:theme.tones.danger.text,marginBottom:12}]}>{error}</Text>}
 </View>;
}

export function ChangePasswordScreen({navigation}){
 const {user}=useAuth(),theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const headerHeight=useHeaderHeight();
 const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
 const [fieldErrors,setFieldErrors]=useState({});
 const working=useRef(false),active=useRef(true),mounted=useRef(true),visit=useRef(0);
 const clear=()=>{setCurrent('');setPassword('');setConfirmation('');setFieldErrors({});};
 useEffect(()=>{
  active.current=true;mounted.current=true;
  const blur=navigation.addListener('blur',()=>{active.current=false;visit.current++;clear();setError('');setSuccess(false);});
  const focus=navigation.addListener('focus',()=>{active.current=true;});
  return()=>{active.current=false;mounted.current=false;visit.current++;blur();focus();};
 },[navigation]);
 const edit=(setter,field)=>value=>{setter(value);setFieldErrors(previous=>({...previous,[field]:''}));setError('');setSuccess(false);};
 const save=async()=>{
  if(working.current)return;
  const invalid={};
  if(!current)invalid.current='Ingresa tu contraseña actual.';
  if(!password)invalid.password='Ingresa una nueva contraseña.';
  if(!confirmation)invalid.confirmation='Confirma tu nueva contraseña.';
  else if(password!==confirmation)invalid.confirmation='Las contraseñas nuevas no coinciden.';
  setFieldErrors(invalid);setError('');setSuccess(false);
  if(Object.keys(invalid).length)return;
  const currentVisit=visit.current;
  working.current=true;setBusy(true);setError('');setSuccess(false);
  try{
   await changeOwnPassword({expectedUid:user?.uid,currentPassword:current,newPassword:password,confirmation});
   if(active.current&&visit.current===currentVisit){clear();setSuccess(true);}
  }catch(e){if(active.current&&visit.current===currentVisit){
   const message=passwordErrorMessage(e);
   const field=['auth/wrong-password','auth/invalid-credential','auth/invalid-login-credentials'].includes(e.code)?'current':['pmp/policy','auth/weak-password','auth/password-does-not-meet-requirements'].includes(e.code)?'password':e.code==='pmp/mismatch'?'confirmation':null;
   if(field)setFieldErrors({[field]:message});else setError(message);
  }}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 };
 const supported=passwordProviderAvailable(user?.uid);
 return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='ios'?headerHeight:0}>
  <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   <SectionHeader title="Protege tu cuenta" description="Verificaremos tu contraseña actual antes de guardar una nueva."/>
   {!!error&&<PmpFeedback tone="danger">{error}</PmpFeedback>}
   {success&&<PmpFeedback tone="success">Contraseña actualizada correctamente.</PmpFeedback>}
   {!supported&&<PmpFeedback>El cambio requiere una sesión vigente con correo y contraseña. Si tu cuenta usa otro proveedor, gestiona la contraseña con ese proveedor.</PmpFeedback>}
   <AppCard>
    <PasswordField label="Contraseña actual" value={current} onChange={edit(setCurrent,'current')} error={fieldErrors.current} disabled={busy||!supported} autoComplete="current-password"/>
    <PasswordField label="Nueva contraseña" value={password} onChange={edit(setPassword,'password')} error={fieldErrors.password} disabled={busy||!supported} autoComplete="new-password"/>
    <PasswordField label="Confirmar nueva contraseña" value={confirmation} onChange={edit(setConfirmation,'confirmation')} error={fieldErrors.confirmation} disabled={busy||!supported} autoComplete="new-password"/>
    <Text style={styles.secondaryText}>La nueva contraseña debe cumplir la política de seguridad vigente de tu cuenta.</Text>
    <PmpButton title={busy?'Verificando y guardando…':'Guardar contraseña'} icon="lock-closed-outline" loading={busy} disabled={!supported} onPress={save}/>
   </AppCard>
  </ScrollView>
 </KeyboardAvoidingView>;
}
