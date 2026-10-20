import {useRef,type KeyboardEvent} from 'react';
import {scannerProof,type ScannerProof} from '../utils/receiptScanner';
// Keyboard-wedge timing is a capture heuristic, not cryptographic hardware attestation.
export function useScannerInput(onRead:(code:string,proof:ScannerProof)=>void,onInvalid:()=>void){
 const buffer=useRef({code:'',times:[] as number[]});
 const reset=()=>{buffer.current={code:'',times:[]};};
 const onKeyDown=(e:KeyboardEvent<HTMLInputElement>)=>{
  if(e.key==='Tab'||e.key==='Escape'){reset();return;}
  if(e.key==='Shift')return;
  e.preventDefault();
  if(!e.nativeEvent.isTrusted||e.ctrlKey||e.metaKey||e.altKey||e.repeat){reset();onInvalid();return;}
  const b=buffer.current;
  if(e.key==='Enter'){const proof=scannerProof(b.code,b.times,e.timeStamp),code=b.code;reset();if(proof)onRead(code,proof);else onInvalid();return;}
  if(e.key.length!==1){reset();return;}
  if(b.times.length&&(e.timeStamp-b.times.at(-1)!>80||b.code.length>=64))reset();
  buffer.current.code+=e.key;buffer.current.times.push(e.timeStamp);
 };
 return {onKeyDown,reset};
}
