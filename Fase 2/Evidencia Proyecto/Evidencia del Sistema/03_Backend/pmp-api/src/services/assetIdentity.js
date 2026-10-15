import {assetIdentity} from '../../../../shared/assetIdentity.js';
import {FlowError} from './bridgeFlow.js';

export function requireAssetIdentity(type,series,body={}) {
 const result=assetIdentity(type,series);
 if(result.status!=='valid')throw new FlowError(422,'ASSET_IDENTITY_UNRECOGNIZED',result.message);
 for(const field of ['modelo','marca']) {
  if(body[field]!==undefined&&body[field]!==null&&body[field]!==''&&body[field]!==result[field])
   throw new FlowError(422,'ASSET_IDENTITY_CONFLICT',`${field==='modelo'?'Modelo':'Marca'} no coincide con el tipo y serie del equipo`);
 }
 return {modelo:result.modelo,marca:result.marca};
}
