import {Router} from "express";
import {asyncHandler} from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {workspaceFilter,postDocument} from "./service.js";
import {ErpEntry,ErpDocument,ErpParty,ErpBalance} from "./models.js";
import {ErpBankRow} from "./bankRoutes.js";
import {accountsOverview} from "./accountsOverviewPolicy.js";
import {allowedDepartment,enabledDepartment} from "./departmentPolicy.js";
import {authorizeErp} from "./policy.js";
import {featureAllowed} from "./featurePolicy.js";
const router=Router();
function accountAccess(req,write=false,type=""){
 const company=req.departmentCompany;
 if(!company||!enabledDepartment(company,"ACCOUNTS")||
  !allowedDepartment(req.user,"ACCOUNTS",write)||
  !featureAllowed(company.entitlements?.modules,"ERP_FINANCE"))
  throw new ApiError(403,"Licensed Accounts department/Finance permission required");
 if(!authorizeErp(req.user,"finance"))
  throw new ApiError(403,"Separate ERP Finance read permission required");
 if(write&&!authorizeErp(req.user,"post",type))
  throw new ApiError(403,"Separate ERP posting permission required");
}
router.get("/overview",asyncHandler(async(req,res)=>{
 accountAccess(req);
 const days=Number(req.query.days||30);
 if(!Number.isInteger(days)||days<1||days>366)
  throw new ApiError(400,"Choose 1–366 reporting days");
 const scope=workspaceFilter();
 const [entries,balances,documents,parties,bank]=await Promise.all([
  ErpEntry.find({...scope,kind:"JOURNAL"}).sort({date:-1}).limit(20001).lean(),
  ErpBalance.find(scope).limit(20001).lean(),
  ErpDocument.find(scope).sort({createdAt:-1}).limit(10001).lean(),
  ErpParty.find(scope).limit(2001).lean(),
  ErpBankRow.find(scope).sort({date:-1}).limit(2001).lean()
 ]);
 if(entries.length>20000||balances.length>20000||documents.length>10000||
  parties.length>2000||bank.length>2000)
  throw new ApiError(409,"Accounts report exceeds capacity; filter/archive before totals");
 res.json(accountsOverview(entries,balances,documents,parties,bank,new Date(),days));
}));
router.post("/post",asyncHandler(async(req,res)=>{
 const type=String(req.body.type||"").trim().toUpperCase();
 if(!["PURCHASE_INVOICE","JOURNAL","RECEIPT","PAYMENT"].includes(type))
  throw new ApiError(400,"Accounts entry type unsupported; use Integrated ERP");
 accountAccess(req,true,type);
 const key=String(req.get("Idempotency-Key")||"").trim();
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))
  throw new ApiError(400,"Stable 16–100 character posting idempotency key required");
 // Exact ERP posting service and independent finance approval gate.
 res.status(201).json(await postDocument({...req.body,type},key,req.user.userId));
}));
export default router;
