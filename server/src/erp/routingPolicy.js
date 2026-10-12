import {fail} from './policy.js';
import {enabledDepartment} from './departmentPolicy.js';
const order=['STITCHING','INWARD','CHECKING','IRONING','PACKING','DISPATCH'];
export function validateRouting(stages,company){
 if(!Array.isArray(stages)||stages.length<2||stages.at(-1)!=='DISPATCH'||new Set(stages).size!==stages.length)fail('Select unique ordered stages ending in Dispatch');
 let last=-1;for(const s of stages){const i=order.indexOf(s);if(i<=last||i<0||!enabledDepartment(company,s))fail('Route stages must be ordered and subscribed');last=i;}return [...stages];
}
export function readyStage(department){const value={CHECKING:'CHECKING',IRONING:'GOOD',PACKING:'IRONED',DISPATCH:'PACKED'}[department];if(!value)fail('Route has no receiving stage');return value;}
export function routedNext(stages,completed){const i=stages.indexOf(completed);if(i<0||i===stages.length-1)fail('Completed department not in approved route');const next=stages[i+1];return next==='INWARD'?'STITCHED':readyStage(next);}
export function routeAdvance(lot,stage,fallback){
 const stages=lot.routeSnapshot?.stages;if(!stages)return fallback;
 if(stage==='STITCHED')return routedNext(stages,stages.includes('INWARD')?'INWARD':'STITCHING');
 if(stage==='GOOD')return 'IRONING';
 if(stage==='IRONING')return routedNext(stages,'IRONING');
 return fallback;
}
export function routeActor(lot,stage,fallback){return ['STITCHED','REWORK_DONE'].includes(stage)&&lot?.routeSnapshot&&!lot.routeSnapshot.stages.includes('INWARD')?'STITCHING':fallback;}
export function bomUsable(bom){return !bom?.approvalVersion||bom.approvalStatus==='APPROVED';}
