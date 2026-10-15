import {AssetIdentitySummary,PmpButton,PmpFeedback,StatusBadge,EmptyState,SectionHeader} from '../components/PmpUi';
import React, { useEffect, useState } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { getGlobalStyles, usePmpTheme, colors } from '../constants/styles';
import { useNavigation } from '@react-navigation/native';

export default function MyOrdersScreen() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('abiertas'); // 'abiertas' o 'historial'
    const [error, setError] = useState('');
    const [installation,setInstallation]=useState(null);
    const [message,setMessage]=useState('');

    const theme = usePmpTheme();
    const styles = getGlobalStyles(theme);
    const navigation = useNavigation();

    const fetchOrders = async () => {
        setError('');
        try {
            const response = await api.get('/os/mis-ordenes');
            setOrders(response.data);
        } catch (error) {
            console.error('Error fetching orders:', error);
            setError(error.response?.data?.message || 'No se pudieron cargar tus órdenes. Desliza para reintentar.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        return navigation.addListener('focus',fetchOrders);
    }, [navigation]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    // Estados finales del catálogo existente.
    const openedOrders = orders.filter(o => ![8, 12, 13].includes(o.estado_id));
    const historyOrders = orders.filter(o => [8, 12, 13].includes(o.estado_id));

    const displayedOrders = activeTab === 'abiertas' ? openedOrders : historyOrders;

    const processInstallation = async (codigo_os, operativo, bus_ppu) => {
        try {
            setLoading(true);
            await api.post('/os/completar-instalacion', { 
                codigo_os, 
                operativo,
                bus_ppu: bus_ppu || null 
            });
            setMessage(operativo ? 'Equipo instalado correctamente' : 'Equipo devuelto a bodega'); setInstallation(null);
            fetchOrders();
        } catch (error) {
            console.error('Error al procesar instalación:', error);
            setError(error.response?.data?.message || error.response?.data?.error || 'No se pudo procesar la acción');
            setLoading(false);
        }
    };

    const handlePressAction = (item) => {
        if(item.estado_nombre==='PENDIENTE_RETIRO'){
            navigation.navigate('TerrainWithdrawal',{codigo_os:item.codigo_os});return;
        }
        if (!item.es_instalacion || item.estado_nombre !== 'EN_RUTA') return;
        setInstallation(item);
    };

    const renderOrderCard = ({ item }) => {
        const isHistory = [8, 12, 13].includes(item.estado_id);
        const canInstall = !isHistory && item.es_instalacion === true && item.estado_nombre === 'EN_RUTA';
        const canWithdraw=item.estado_nombre==='PENDIENTE_RETIRO';
        return <View style={styles.card}>
          <View style={styles.row}><Text selectable style={[styles.label,{color:theme.link,marginBottom:0}]}>{item.codigo_os}</Text><StatusBadge status={item.estado_nombre} tone={item.estado_id===8?'danger':undefined}/></View>
          <AssetIdentitySummary asset={item}/>
          <Text style={styles.bodyText}><Ionicons name="bus-outline" size={16} color={theme.muted}/> {item.bus_ppu||'Sin PPU'}</Text>
          <Text style={styles.secondaryText}>{[item.terminal,item.operador].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.secondaryText}>{item.tecnico_nombre||item.tecnico_terreno||'Técnico asignado'}</Text>
          {!!item.os_origen&&<Text style={styles.secondaryText}>OS origen: {item.os_origen}</Text>}
          {!!item.referencia_externa&&<Text style={styles.secondaryText}>Referencia externa: {item.referencia_externa}</Text>}
          {!item.es_instalacion&&<Text style={[styles.bodyText,{marginTop:8}]}>{item.falla}</Text>}
          {canInstall&&<PmpButton title="Instalar / devolver equipo" icon="construct-outline" onPress={()=>handlePressAction(item)}/>}
          {canWithdraw&&<PmpButton title="Confirmar retiro físico hacia Bodega" icon="scan-outline" onPress={()=>handlePressAction(item)}/>}
          {!!item.caso_id&&<TouchableOpacity accessibilityRole="button" style={styles.link} onPress={()=>navigation.navigate('AssetHistory',{caso_id:item.caso_id})}><Text style={styles.linkText}>Ver caso {item.codigo_caso||item.caso_id}</Text></TouchableOpacity>}
          <View style={[styles.row,{borderTopWidth:1,borderColor:theme.border,marginTop:12}]}>
           <TouchableOpacity accessibilityRole="button" style={styles.link} onPress={()=>navigation.navigate('AssetHistory',{serie:item.serie,tipo_equipo:item.tipo_equipo})}><Text style={styles.linkText}>Historial del activo</Text></TouchableOpacity>
           <Text style={styles.secondaryText}>{new Date(item.fecha).toLocaleDateString()}</Text>
          </View>
        </View>;
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator accessibilityLabel="Cargando órdenes" size="large" color={theme.link} />
            </View>
        );
    }

    return <View style={styles.screen}>
      <FlatList data={displayedOrders} keyExtractor={item=>item.codigo_os} renderItem={renderOrderCard}
        contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.link}/>}
        ListHeaderComponent={<>
          {!!message&&<PmpFeedback tone="success">{message}</PmpFeedback>}
          {!!error&&<PmpFeedback tone="danger">{error}</PmpFeedback>}
          {!!error&&<PmpButton title="Reintentar" secondary onPress={onRefresh}/>}
          {installation&&<View style={styles.card}>
            <SectionHeader title={`Instalación ${installation.codigo_os}`} description="Confirma el resultado del equipo asignado."/>
            <AssetIdentitySummary asset={installation}/>
            <Text style={styles.bodyText}>Bus {installation.bus_ppu} · ¿El equipo quedó operativo?</Text>
            <PmpButton title="Confirmar instalado OK" tone="success" icon="checkmark-circle-outline" onPress={()=>processInstallation(installation.codigo_os,true,installation.bus_ppu)}/>
            <PmpButton title="Confirmar con falla" tone="danger" icon="return-down-back-outline" onPress={()=>processInstallation(installation.codigo_os,false)}/>
            <PmpButton title="Cancelar" secondary onPress={()=>setInstallation(null)}/>
          </View>}
          <View style={[styles.card,{flexDirection:'row',padding:4,gap:4}]}>
           {[['abiertas','Abiertas',openedOrders.length],['historial','Historial',historyOrders.length]].map(([id,label,count])=><TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{selected:activeTab===id}} onPress={()=>setActiveTab(id)} style={{flex:1,minHeight:48,justifyContent:'center',alignItems:'center',padding:8,borderRadius:8,backgroundColor:activeTab===id?colors.primary:theme.panel}}><Text style={[styles.label,{marginBottom:0,color:activeTab===id?colors.white:theme.muted}]}>{label} ({count})</Text></TouchableOpacity>)}
          </View>
        </>}
        ListEmptyComponent={!error?<EmptyState title={activeTab==='abiertas'?'Sin órdenes abiertas':'Sin intervenciones cerradas'} description={activeTab==='abiertas'?'Tus tareas asignadas aparecerán aquí. Desliza para actualizar.':'Las órdenes finalizadas aparecerán en esta sección.'}/>:null}
      />
    </View>;
}
