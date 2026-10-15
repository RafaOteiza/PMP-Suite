import {PmpFeedback,AppInput,PmpButton,AppCard} from '../components/PmpUi';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getGlobalStyles, usePmpTheme } from '../constants/styles';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [notice,setNotice]=useState('');
    const notify=(title,message)=>setNotice(title+': '+message);
    const insets=useSafeAreaInsets();
    const theme = usePmpTheme();
    const styles = getGlobalStyles(theme);

    const handleLogin = async () => {
        if (!email || !password) {
            notify('Error', 'Por favor ingrese correo y contraseña');
            return;
        }

        setLoading(true);
        try {
            await login(email, password);
        } catch (error) {
            notify('Error de Autenticación', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { flexGrow:1,justifyContent: 'center',paddingTop:insets.top+24 }]} keyboardShouldPersistTaps="handled">
                
                {!!notice&&<PmpFeedback tone="danger">{notice}</PmpFeedback>}
                <View style={localStyles.logoContainer}>
                    <Image
                        source={theme.isDark ? require('../../assets/logo-stacked-white.png') : require('../../assets/logo-stacked-color.png')}
                        style={localStyles.brandLogo}
                        resizeMode="contain"
                        accessibilityLabel="PMP Suite"
                    />
                    <Text style={[styles.label, { textAlign: 'center', color: theme.muted }]}>Operación en terreno</Text>
                </View>

                <AppCard>
                    <Text accessibilityRole="header" style={[styles.sectionTitle, { marginBottom: 16 }]}>Bienvenido a PMP Suite</Text>
                    
                    <AppInput
                        label="Correo institucional"
                        accessibilityLabel="Correo institucional" placeholder="Correo institucional" autoComplete="email"
                        placeholderTextColor={theme.muted}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <AppInput
                        label="Contraseña"
                        accessibilityLabel="Contraseña" placeholder="Contraseña" autoComplete="current-password"
                        placeholderTextColor={theme.muted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <PmpButton title={loading?'Validando…':'Iniciar sesión'} loading={loading} onPress={handleLogin}/>
                </AppCard>

                <Text style={{ textAlign: 'center', color: theme.muted, marginTop: 16, fontSize: 12 }}>
                    Versión 3.0.0 - © 2026 Duoc UC Taller de Tesis
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const localStyles = StyleSheet.create({
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    brandLogo: {
        width: 180,
        height: 110,
        marginBottom: 12,
    }
});
