// One business definition used by API, web and Mobile. Input must be a resolved series, never raw QR/AMID.
export const ASSET_IDENTITIES = Object.freeze({
 VALIDADOR: Object.freeze({brand:'Mikroelektronika',prefixes:Object.freeze({'72':'CVB35','74':'CVB45','75':'CVB45'})}),
 CONSOLA: Object.freeze({brand:'Waysion',model:'N9715'})
});
export function assetIdentity(type,series) {
 const text=typeof series==='string'?series.trim():'';
 if(!text) return {status:'pending',modelo:'',marca:'',message:'Ingresa la serie del equipo'};
 if(type==='CONSOLA') return {status:'valid',modelo:ASSET_IDENTITIES.CONSOLA.model,marca:ASSET_IDENTITIES.CONSOLA.brand,message:''};
 if(type!=='VALIDADOR') return {status:'invalid',modelo:'',marca:'',message:'Tipo de equipo no válido'};
 if(text.length<2) return {status:'pending',modelo:'',marca:'',message:'Completa el prefijo de la serie'};
 const model=ASSET_IDENTITIES.VALIDADOR.prefixes[text.slice(0,2)];
 return model?{status:'valid',modelo:model,marca:ASSET_IDENTITIES.VALIDADOR.brand,message:''}:
  {status:'invalid',modelo:'',marca:'',message:'Prefijo de serie no reconocido'};
}
