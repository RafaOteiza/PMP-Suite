import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {PmpFeedback,PmpButton} from './src/components/PmpUi';
import TerrainWithdrawalScreen from './src/screens/TerrainWithdrawalScreen';
import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext'; // Ajusta rutas si es necesario
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewOrderScreen from './src/screens/NewOrderScreen';
import MyOrdersScreen from './src/screens/MyOrdersScreen';
import AssetHistoryScreen from './src/screens/AssetHistoryScreen';
import { View, ActivityIndicator } from 'react-native';
import { colors, usePmpTheme } from './src/constants/styles';
import {AppearanceProvider,useAppearance} from './src/context/AppearanceContext';
import {SettingsScreen,ProfileScreen,AppearanceScreen,ChangePasswordScreen} from './src/screens/SettingsScreens';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, loading, sessionError, retrySession } = useAuth();
  const theme = usePmpTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{flex:1,backgroundColor:theme.bg}}>
    {!!sessionError&&<PmpFeedback tone="danger">{sessionError}</PmpFeedback>}
    {!!sessionError&&<PmpButton title="Revisar sesión" onPress={retrySession} secondary/>}
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: theme.navBg },
      headerTintColor: theme.link,
      headerTitleStyle: { fontWeight: '700', fontSize:18, color:theme.text },
      headerTitleAlign: 'center',
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible:false,
      contentStyle: { backgroundColor: theme.bg }
    }}>
      {user ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio', headerShown: false }} />
          {user.rol === 'tecnico_terreno' && <Stack.Screen name="NewOrder" component={NewOrderScreen} options={{ title: 'Reportar falla' }} />}
          {user.rol === 'tecnico_terreno' && <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: 'Mis órdenes' }} />}
          {user.rol === 'tecnico_terreno' && <Stack.Screen name="TerrainWithdrawal" component={TerrainWithdrawalScreen} options={{title:'Retiro físico'}} />}
          <Stack.Screen name="AssetHistory" component={AssetHistoryScreen} options={{ title: 'Historial del activo' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{title:'Configuración'}}/>
          <Stack.Screen name="MyProfile" component={ProfileScreen} options={{title:'Mi perfil'}}/>
          <Stack.Screen name="Appearance" component={AppearanceScreen} options={{title:'Apariencia'}}/>
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{title:'Cambiar contraseña'}}/>
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator></View>
  );
};

function ThemedApp() {
  const theme=usePmpTheme();
  const {ready}=useAppearance();
  const base=theme.isDark?DarkTheme:DefaultTheme;
  const navigationTheme={...base,colors:{...base.colors,primary:theme.link,background:theme.bg,card:theme.navBg,text:theme.text,border:theme.border}};
  return (
    <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:theme.bg}} edges={['left','right','bottom']}><StatusBar style={theme.isDark?'light':'dark'}/>{!ready?<View style={{flex:1,justifyContent:'center',alignItems:'center'}}><ActivityIndicator accessibilityLabel="Cargando preferencias" color={theme.link}/></View>:<NavigationContainer theme={navigationTheme}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </NavigationContainer>}</SafeAreaView></SafeAreaProvider>
  );
}

export default function App(){return <AppearanceProvider><ThemedApp/></AppearanceProvider>;}
