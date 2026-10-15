import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { FlowError, requireText, optionalText } from './bridgeFlow.js';

export const POD_CATEGORIES = ['GOLPE','ROTURA','VANDALISMO','LIQUIDO','OTRO'];
export const MANUAL_REASONS = ['QR_ILEGIBLE','QR_INEXISTENTE','ETIQUETA_DANADA','CAMARA_NO_DISPONIBLE','OTRO'];
export async function withdrawalEvidence(body, {allowedOrigins=['CAMARA']} = {}) {
  if(typeof body.pod!=='boolean')throw new FlowError(422,'POD_DECISION_REQUIRED','Indica explícitamente si detectaste daño atribuible a tercero (PoD)');
  const observation=(body.pod?requireText:optionalText)(body.evidencia,'observación del retiro',{max:4000});
  if(body.pod&&!POD_CATEGORIES.includes(body.categoria_pod))throw new FlowError(422,'POD_CATEGORY_REQUIRED','Selecciona el tipo de daño PoD');
  const photos=body.fotografias??[];
  if(!Array.isArray(photos)||photos.length>3)throw new FlowError(422,'INVALID_PHOTOS','Adjunta hasta tres fotografías');
  if(body.pod&&!photos.length)throw new FlowError(422,'POD_PHOTO_REQUIRED','PoD requiere al menos una fotografía válida');
  const evidence=[];
  for(const photo of photos){
    if(!allowedOrigins.includes(photo?.origen)||typeof photo.base64!=='string'||photo.base64.length>1400000||photo.base64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64))
      throw new FlowError(422,'INVALID_PHOTO','La fotografía debe provenir de cámara y pesar como máximo 1 MB');
    try{
      const input=Buffer.from(photo.base64,'base64');
      if(!input.length||input.length>1024*1024||input.toString('base64')!==photo.base64)throw Error('size');
      const decoder=sharp(input,{failOn:'warning',limitInputPixels:20000000});
      const info=await decoder.metadata();
      if(!['jpeg','png','webp'].includes(info.format)||info.pages>1||!info.width||!info.height)throw Error('format');
      const {data,info:output}=await decoder.rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toBuffer({resolveWithObject:true});
      evidence.push({origen:photo.origen,mime:'image/jpeg',base64:data.toString('base64'),sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,width:output.width,height:output.height});
    }catch{throw new FlowError(422,'INVALID_PHOTO','No se pudo validar la fotografía. Tómala nuevamente.');}
  }
  return {pod:body.pod,categoria_pod:body.pod?body.categoria_pod:null,observacion:observation,fotografias:evidence};
}
