import React,{createContext,useState,useEffect,useContext,useRef} from 'react';
import {onIdTokenChanged,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {auth} from '../services/firebase';
import api,{onSessionIssue,apiErrorMessage} from '../services/api';
import {sessionErrorKind} from '../../../shared/sessionToken.js';
const AuthContext=createContext({});
export const AuthProvider=({children})=>{
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[sessionError,setSessionError]=useState('');
 const generation=useRef(0),confirmedUid=useRef(null);
 const recover=async firebaseUser=>{
  const version=++generation.current;
  if(!firebaseUser){confirmedUid.current=null;setUser(null);setLoading(false);return;}
  if(confirmedUid.current!==firebaseUser.uid){setUser(null);setLoading(true);confirmedUid.current=null;}
  try{
   const {data}=await api.get('/auth/me');
   if(version!==generation.current||auth.currentUser!==firebaseUser)return;
   confirmedUid.current=firebaseUser.uid;setUser({...data.user,uid:firebaseUser.uid,email:data.user?.correo||firebaseUser.email});setSessionError('');
  }catch(error){
   if(version!==generation.current)return;
   setSessionError(apiErrorMessage(error));
   if(['session','permission'].includes(sessionErrorKind(error)))setUser(null);
   // A network/server failure retains the established session and screen draft.
  }finally{if(version===generation.current)setLoading(false);}
 };
 useEffect(()=>{
  const unsubscribe=onIdTokenChanged(auth,recover);
  const unlisten=onSessionIssue(error=>{setSessionError(apiErrorMessage(error));if(sessionErrorKind(error)==='session'){++generation.current;setUser(null);}});
  return()=>{++generation.current;unsubscribe();unlisten();};
 },[]);
 const login=(email,password)=>signInWithEmailAndPassword(auth,email,password);
 const logout=async()=>{++generation.current;confirmedUid.current=null;await signOut(auth);setUser(null);setSessionError('');};
 return <AuthContext.Provider value={{user,loading,login,logout,sessionError,retrySession:()=>recover(auth.currentUser)}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>useContext(AuthContext);
