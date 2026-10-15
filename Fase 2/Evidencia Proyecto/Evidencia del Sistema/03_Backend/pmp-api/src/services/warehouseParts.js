import {FlowError,requirePositiveInteger,withTransaction,addFlowEvent} from './bridgeFlow.js';
const fail=(message,code='PART_DELIVERY_CONFLICT',status=409)=>{throw new FlowError(status,code,message);};
export async function deliverPart(pool,id,body,user){
 if(!['logistica'].includes(user.rol))fail('Solo Bodega puede entregar repuestos','FORBIDDEN',403);
 return withTransaction(pool,async c=>{
  const initial=(await c.query('SELECT * FROM pmp.solicitudes_repuestos WHERE id=$1',[requirePositiveInteger(id,'Solicitud')])).rows[0];
  if(!initial)fail('Solicitud no encontrada','REQUEST_NOT_FOUND',404);
  // Every writer locks OS first, then request and inventory.
  const order=(await c.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1 FOR UPDATE',[initial.codigo_os])).rows[0];
  const request=(await c.query('SELECT * FROM pmp.solicitudes_repuestos WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(request.estado==='DESPACHADA'){
   const movement=(await c.query("SELECT metadata,usuario_id FROM pmp.flujo_eventos WHERE tipo='LOGISTICA_ENTREGA_REPUESTO' AND codigo_os=$1 AND metadata->>'solicitud_id'=$2 ORDER BY id DESC LIMIT 1",[order.codigo_os,String(id)])).rows[0];
   if(!movement||movement.metadata.version!==2||String(movement.usuario_id)!==String(user.id)||movement.metadata.repuesto_id!==Number(body.repuesto_id)||movement.metadata.cantidad!==Number(body.cantidad))fail('La solicitud ya fue entregada con otra pieza o cantidad');
   return {success:true,duplicado:true,legacy:false};
  }
  if(request.estado==='RECHAZADA'||order.estado_id!==9)fail('La solicitud ya no está pendiente de entrega');
  const partId=requirePositiveInteger(body.repuesto_id,'Repuesto'),quantity=requirePositiveInteger(body.cantidad,'Cantidad');
  if(quantity>10000)fail('Cantidad fuera de rango','INVALID_QUANTITY',422);
  const part=(await c.query('SELECT * FROM pmp.repuestos WHERE id=$1 FOR UPDATE',[partId])).rows[0];
  if(!part||part.categoria!==order.tipo_equipo)fail('Repuesto no aplicable al equipo','INVALID_PART',422);
  if(part.stock<quantity)fail('Stock insuficiente para confirmar la entrega','INSUFFICIENT_STOCK');
  await c.query('UPDATE pmp.repuestos SET stock=stock-$2 WHERE id=$1',[partId,quantity]);
  await c.query("UPDATE pmp.solicitudes_repuestos SET estado='DESPACHADA',fecha_despacho=now() WHERE id=$1",[id]);
  await addFlowEvent(c,{os:order.codigo_os,type:'LOGISTICA_ENTREGA_REPUESTO',user,asset:{tipo_equipo:order.tipo_equipo,serie:order.validador_serie||order.consola_serie},
   comment:`Entrega física confirmada: ${part.nombre} × ${quantity}. Salida de inventario desde Bodega.`,
   metadata:{version:2,solicitud_id:String(id),repuesto_id:partId,nombre:part.nombre,cantidad:quantity,stock_anterior:part.stock,stock_final:part.stock-quantity}});
  const pending=(await c.query("SELECT 1 FROM pmp.solicitudes_repuestos WHERE codigo_os=$1 AND estado NOT IN ('DESPACHADA','RECHAZADA') LIMIT 1",[order.codigo_os])).rowCount;
  if(!pending)await c.query('UPDATE pmp.ordenes_servicio SET estado_id=5,actualizado_en=now() WHERE codigo_os=$1',[order.codigo_os]);
  return {success:true,estado_id:pending?9:5};
 });
}
