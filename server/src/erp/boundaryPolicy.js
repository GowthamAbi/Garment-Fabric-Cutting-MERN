import {DEPARTMENTS} from '../../../shared/departmentCatalogue.js';
import {enabledDepartment} from './departmentPolicy.js';
import {fail} from './policy.js';
const peers={FABRIC:[null,'CUTTING'],CUTTING:['FABRIC','DELIVERY'],ELASTIC:[null,null],ACCESSORIES:[null,null],DELIVERY:['CUTTING','STITCHING'],STITCHING:['DELIVERY','INWARD'],INWARD:['STITCHING','CHECKING'],CHECKING:['INWARD','IRONING'],IRONING:['CHECKING','PACKING'],PACKING:['IRONING','DISPATCH'],DISPATCH:['PACKING','WAREHOUSE'],WAREHOUSE:['DISPATCH','SHOP'],SHOP:['WAREHOUSE',null],MARKETING:['SHOP',null],HR:[null,null],ACCOUNTS:[null,null]};
export function boundaryOptions(company,department){
 if(!DEPARTMENTS.includes(department)||!enabledDepartment(company,department))fail('Department not subscribed');
 const [upstream,downstream]=peers[department];if(['HR','ACCOUNTS'].includes(department))return {department,upstream,downstream,externalInward:false,externalOutward:false,externalRework:false};return {department,upstream,downstream,externalInward:!upstream||!enabledDepartment(company,upstream),externalRework:department==='CHECKING'&&!enabledDepartment(company,'STITCHING'),externalOutward:department!=='SHOP'&&department!=='MARKETING'&&(!downstream||!enabledDepartment(company,downstream))};
}
export function assertBoundary(company,department,direction){if(!['IN','OUT'].includes(direction))fail('Invalid boundary direction');const b=boundaryOptions(company,department);if(!b[direction==='IN'?'externalInward':'externalOutward'])fail('Use the integrated handoff; adjacent department is subscribed');return b;}
export function inwardStage(department,destination=''){
 const stages={STITCHING:'STITCHING_READY',INWARD:'STITCHED',CHECKING:'CHECKING',IRONING:'GOOD',PACKING:'IRONED',DISPATCH:'PACKED',WAREHOUSE:`WAREHOUSE:${destination}`,SHOP:`SHOP:${destination}`};
 if(!stages[department])fail('Use core stock or marketing observations for this department');if(['WAREHOUSE','SHOP'].includes(department)&&!destination)fail('Location master required');return stages[department];
}
export function outwardAllowed(department,stage){return ({STITCHING:['STITCHED','REWORK_DONE'],INWARD:['INWARD_READY'],CHECKING:['GOOD','REWORK'],IRONING:['IRONED'],PACKING:['PACKED'],DISPATCH:['PACKED'],WAREHOUSE:[]}[department]||[]).includes(stage)||(department==='WAREHOUSE'&&stage.startsWith('WAREHOUSE:'));}

export function assertOutwardBoundary(company,department,stage){if(department==='CHECKING'&&stage==='REWORK'){if(enabledDepartment(company,'STITCHING'))fail('Use integrated stitching rework');return;}assertBoundary(company,department,'OUT');}
