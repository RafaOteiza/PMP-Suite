import { StyleSheet, Appearance, Platform } from 'react-native';
import {useAppearance} from '../context/AppearanceContext';

const brandFont = Platform.select({ ios: 'Arial', android: 'sans-serif', default: 'Arial' });

export const colors = {
    // PMP Suite official BrandKit
    navy: '#0D1B2A',
    primary: '#1565C0',
    primarySoft: '#DCEEFF',
    technical: '#00B4B0',
    gray: '#6B7280',
    lightGray: '#E5E7EB',
    white: '#FFFFFF',
    success: '#078454',
    danger: '#C9323E',
    info: '#1565C0',
    warning: '#B45309',

    // Theme Aware Colors
    light: {
        isDark: false,
        bg: '#F5F7FA',
        panel: '#FFFFFF',
        card: '#FFFFFF',
        text: '#0D1B2A',
        border: '#E5E7EB',
        muted: '#6B7280',
        inputBg: '#FFFFFF',
        navBg: '#FFFFFF',
        surface: 'rgba(255, 255, 255, 0.92)',
    },
    dark: {
        isDark: true,
        bg: '#07111C',
        panel: '#0D1B2A',
        card: '#102033',
        text: '#F2F5F9',
        border: '#25364B',
        muted: '#A8B4C3',
        inputBg: '#071421',
        navBg: '#0D1B2A',
        surface: 'rgba(13, 27, 42, 0.94)',
    }
};

export const getTheme = () => {
    const scheme = Appearance.getColorScheme();
    return scheme === 'dark' ? colors.dark : colors.light;
};

export const usePmpTheme=()=>useAppearance().scheme==='dark'?colors.dark:colors.light;

// Semantic foregrounds/backgrounds mirror PMP Web tokens.css. Brand actions remain blue.
export const metrics = { space: { xs:4, sm:8, md:12, lg:16, xl:24 }, radius:12, touch:48, contentWidth:760 };
const semantic = {
 light: {success:['#05613f','#eef9f4'],warning:['#864006','#fff7e8'],danger:['#a52430','#fff1f2'],info:['#1565C0','#edf5ff'],neutral:['#4b5563','#f3f4f6']},
 dark: {success:['#75ddb0','rgba(16,163,106,0.15)'],warning:['#f4bb6d','rgba(224,138,24,0.15)'],danger:['#f4878e','rgba(224,75,85,0.15)'],info:['#82b8ef','rgba(21,101,192,0.17)'],neutral:['#b7c2cf','rgba(142,157,176,0.12)']}
};
for(const name of ['light','dark']) {
 colors[name].tones=Object.fromEntries(Object.entries(semantic[name]).map(([key,[text,bg]])=>[key,{text,bg}]));
 colors[name].link=colors[name].tones.info.text;
}
export const getGlobalStyles = theme => StyleSheet.create({
 bodyText:{fontSize:16,lineHeight:23,color:theme.text,fontFamily:brandFont},
 secondaryText:{fontSize:14,lineHeight:20,color:theme.muted,fontFamily:brandFont},
 identity:{gap:4,marginVertical:8},
 feedback:{padding:12,borderWidth:1,borderLeftWidth:3,borderColor:theme.border,borderRadius:10,backgroundColor:theme.panel,marginVertical:8},
 container:{flex:1,padding:16,backgroundColor:theme.bg},
 screen:{flex:1,backgroundColor:theme.bg},
 content:{padding:16,paddingBottom:32,width:'100%',maxWidth:metrics.contentWidth,alignSelf:'center'},
 title:{fontSize:22,lineHeight:28,fontWeight:'700',marginBottom:12,color:theme.text,fontFamily:brandFont},
 sectionTitle:{fontSize:17,lineHeight:23,fontWeight:'700',color:theme.text,marginBottom:8,fontFamily:brandFont},
 label:{fontSize:14,lineHeight:20,fontWeight:'600',color:theme.text,marginBottom:6,fontFamily:brandFont},
 input:{backgroundColor:theme.inputBg,minHeight:48,padding:12,borderRadius:10,marginBottom:12,borderWidth:1,borderColor:theme.border,color:theme.text,fontSize:16,fontFamily:brandFont},
 button:{backgroundColor:colors.primary,paddingVertical:12,paddingHorizontal:16,minHeight:48,justifyContent:'center',borderRadius:10,alignItems:'center',marginTop:8},
 buttonText:{color:colors.white,fontWeight:'700',fontSize:15,lineHeight:21,textAlign:'center',fontFamily:brandFont,flexShrink:1},
 card:{backgroundColor:theme.card,padding:16,borderRadius:12,marginBottom:12,borderWidth:1,borderColor:theme.border,shadowColor:colors.navy,shadowOffset:{width:0,height:2},shadowOpacity:theme.isDark?0:.04,shadowRadius:4,elevation:1},
 glassCard:{backgroundColor:theme.surface,borderRadius:12,padding:16,borderWidth:1,borderColor:theme.border},
 row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'},
 badge:{paddingHorizontal:8,paddingVertical:4,borderRadius:8,backgroundColor:theme.border,alignSelf:'flex-start',flexShrink:1},
 badgeText:{fontSize:12,lineHeight:18,fontWeight:'700',color:theme.text,fontFamily:brandFont},
 link:{minHeight:48,justifyContent:'center',paddingVertical:10},
 linkText:{color:theme.link,fontSize:14,lineHeight:20,fontWeight:'600'},
});
