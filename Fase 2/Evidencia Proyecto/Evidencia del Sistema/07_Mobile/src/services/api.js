import axios from 'axios';
import {auth} from './firebase';
import {createSessionToken,sessionErrorKind} from '../../../shared/sessionToken.js';
const configuredApiUrl=process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_URL=(configuredApiUrl||'http://127.0.0.1:4000/api').replace(/\/+$/,'');
const api=axios.create({baseURL:API_URL,timeout:30000,headers:{'Content-Type':'application/json'}});
const currentToken=createSessionToken(()=>auth.currentUser);
const listeners=new Set();
export const onSessionIssue=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
const publish=error=>{for(const listener of listeners)listener(error);};
export function apiErrorMessage(error,fallback='No fue posible completar la operación.') {
 const kind=sessionErrorKind(error);
 if(kind==='network')return 'Sin conexión. Conservamos tus datos; comprueba la red y reintenta.';
 if(kind==='permission')return error.response?.data?.message||'No tienes permiso para esta operación.';
 if(kind==='session')return 'La sesión ya no está habilitada. Inicia sesión nuevamente.';
 if(kind==='expired')return 'Revisa tu sesión y vuelve a confirmar. La operación no se repetirá automáticamente.';
 return error.response?.data?.message||error.response?.data?.error||fallback;
}
api.interceptors.request.use(async config=>{
 const token=await currentToken();
 if(token)config.headers.Authorization=`Bearer ${token}`;else delete config.headers.Authorization;
 return config;
});
let refresh=null;
api.interceptors.response.use(response=>response,async error=>{
 const config=error.config,code=error.response?.data?.code;
 if(code==='TOKEN_EXPIRED'&&!config?._sessionRetried){
  try {
   if(!refresh)refresh=currentToken(true).finally(()=>{refresh=null;});
   await refresh;
   // Writes retain their draft and operation key for explicit retry; never replay them here.
   if(config&&['get','head'].includes((config.method||'get').toLowerCase())){config._sessionRetried=true;return api(config);}
  }catch(refreshError){publish(refreshError);throw refreshError;}
 }
 if(sessionErrorKind(error)==='session')publish(error);
 throw error;
});
export default api;
