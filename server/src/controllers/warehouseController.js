import WarehouseStock from "../models/WarehouseStock.js";
import {moveLegacyWarehouse} from "../services/legacyWarehouseMovementService.js";
const upper=v=>String(v??"").trim().toUpperCase();
export async function getWarehouse(req,res){
 const filter={};
 if(req.query.type)filter.warehouseType=upper(req.query.type);
 if(req.query.dcNo)filter.dcNo=upper(req.query.dcNo);
 const rows=await WarehouseStock.find(filter).sort({createdAt:-1}).limit(2001).lean();
 if(rows.length>2000)return res.status(409).json({message:"Legacy Warehouse report exceeds 2,000 rows; use ERP ledger"});
 res.json(rows);
}
const move=(req,res,mode)=>moveLegacyWarehouse({sourceId:req.params.id,mode,body:req.body,
 key:req.get("Idempotency-Key")||req.body?.key,actor:req.user?.userId}).then(x=>res.json(x));
export const transferRework=(req,res)=>move(req,res,"REWORK");
export const deliverToSection=(req,res)=>move(req,res,"DELIVER");
