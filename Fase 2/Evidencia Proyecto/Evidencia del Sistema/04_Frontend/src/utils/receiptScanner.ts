export type ScannerProof={tipo:'KEYBOARD_WEDGE';intervalos_ms:number[]};
export function scannerProof(code:string,times:number[],entered:number):ScannerProof|null{
 const intervals=times.slice(1).map((time,i)=>time-times[i]).concat(entered-(times.at(-1)??entered));
 if(code.length<4||code.length>64||times.length!==code.length||intervals.some(n=>!Number.isFinite(n)||n<0||n>80)||intervals.reduce((a,b)=>a+b,0)/intervals.length>35)return null;
 return {tipo:'KEYBOARD_WEDGE',intervalos_ms:intervals};
}
