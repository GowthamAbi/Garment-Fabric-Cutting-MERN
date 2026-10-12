import {ErpApprovalAudit} from './models.js';
import {requestHash} from './service.js';
export async function appendApprovalAudit(scope,session,data){const previous=await ErpApprovalAudit.findOne(scope).sort({sequence:-1}).session(session).lean();const row={...scope,sequence:(previous?.sequence||0)+1,previousHash:previous?.hash||'GENESIS',data:{...data,companyId:String(scope.companyId),factoryId:String(scope.factoryId),recordedAt:new Date().toISOString()}};row.hash=requestHash({sequence:row.sequence,previousHash:row.previousHash,data:row.data});await ErpApprovalAudit.create([row],{session});}
export function auditHashValid(row){return row.hash===requestHash({sequence:row.sequence,previousHash:row.previousHash,data:row.data});}
