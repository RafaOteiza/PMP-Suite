import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React from 'react';
import {View,Text,TouchableOpacity,ScrollView,Image} from 'react-native';
import {useAuth} from '../context/AuthContext';
import {getGlobalStyles,usePmpTheme,colors} from '../constants/styles';
import {useNavigation} from '@react-navigation/native';
import {Ionicons} from '@expo/vector-icons';
import {SectionHeader,AppCard} from '../components/PmpUi';

export default function HomeScreen(){
 const {user}=useAuth(),navigation=useNavigation(),insets=useSafeAreaInsets();
 const theme=usePmpTheme(),styles=getGlobalStyles(theme);
 const name=[user?.nombre,user?.apellido].filter(Boolean).join(' ').trim()||user?.email?.split('@')[0]||'Usuario';
 const role={tecnico_terreno:'Técnico en terreno',tecnico_laboratorio:'Técnico de laboratorio',logistica:'Logística',qa:'Control QA',gerente:'Gerente',admin:'Administrador'}[user?.rol]||'Usuario';
 const action=(route,title,description,icon)=><TouchableOpacity key={route} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={description} activeOpacity={0.7} style={[styles.card,{flexDirection:'row',alignItems:'center',gap:12}]} onPress={()=>navigation.navigate(route)}>
  <View style={{width:44,height:44,borderRadius:12,backgroundColor:theme.tones.info.bg,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={24} color={theme.link}/></View>
  <View style={{flex:1}}><Text style={styles.label}>{title}</Text><Text style={styles.secondaryText}>{description}</Text></View><Ionicons name="chevron-forward" size={20} color={theme.muted}/>
 </TouchableOpacity>;
 return <ScrollView style={styles.screen} contentContainerStyle={[styles.content,{paddingTop:insets.top+16}]}>
  <Image source={theme.isDark?require('../../assets/logo-stacked-white.png'):require('../../assets/logo-stacked-color.png')} style={{width:112,height:64,marginBottom:16}} resizeMode="contain" accessibilityLabel="PMP Suite"/>
  <AppCard style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.navy,borderColor:colors.navy,marginBottom:16}}>
   <View style={{width:44,height:44,borderRadius:22,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:18,fontWeight:'700',color:colors.white}}>{name.charAt(0).toUpperCase()}</Text></View>
   <View style={{flex:1}}><Text style={[styles.secondaryText,{color:colors.lightGray}]}>{role}</Text><Text accessibilityRole="header" style={[styles.sectionTitle,{color:colors.white,marginBottom:0}]}>{name}</Text></View>
  </AppCard>
  <SectionHeader title="Tu jornada" description="Accede a tus tareas y consulta los equipos."/>
  {user?.rol==='tecnico_terreno'&&action('MyOrders','Mis órdenes','Pendientes e historial de intervenciones','list-outline')}
  {user?.rol==='tecnico_terreno'&&action('NewOrder','Reportar falla','Registrar una falla en un activo instalado','add-circle-outline')}
  {action('AssetHistory','Historial del activo','Buscar por serie, OS PMP u OS Aranda','search-outline')}
  {action('Settings','Configuración','Perfil, apariencia y seguridad','settings-outline')}
 </ScrollView>;
}
