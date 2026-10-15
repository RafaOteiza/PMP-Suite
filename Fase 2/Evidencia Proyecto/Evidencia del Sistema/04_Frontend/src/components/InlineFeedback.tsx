import {useEffect,useRef} from 'react';
import FeedbackBanner from './ui/FeedbackBanner';
export type FeedbackType = 'confirm' | 'error' | 'success' | 'info';
export default function InlineFeedback({isOpen,type,title,message,onConfirm,onCancel,confirmText,cancelText}:{isOpen:boolean;type:FeedbackType;title:string;message:string;onConfirm:()=>void;onCancel:()=>void;confirmText?:string;cancelText?:string}) {
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{if(isOpen)ref.current?.scrollIntoView({block:'nearest'});},[isOpen,title,message]);
 if(!isOpen)return null;
 return <section ref={ref} className="operation-feedback" aria-label={title}>
  <FeedbackBanner tone={type==='error'?'danger':type==='confirm'?'warning':type}><strong>{title}</strong><p>{message}</p></FeedbackBanner>
  <div className="page-actions">{type==='confirm'?<><button className="btn ghost" onClick={onCancel}>{cancelText||'Cancelar'}</button><button className="btn" onClick={onConfirm}>{confirmText||'Confirmar'}</button></>:<button className="btn ghost" onClick={()=>{onConfirm();onCancel();}}>Cerrar mensaje</button>}</div>
 </section>;
}
