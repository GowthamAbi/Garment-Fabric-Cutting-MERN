import 'dotenv/config';
import mongoose from 'mongoose';
import {tenantDatabaseName} from '../src/config/tenantDatabase.js';
import {departmentCode,DEPARTMENTS} from '../../shared/departmentCatalogue.js';
// Metadata-only compatibility checkpoint. It never activates strict licensing,
// changes a purchased plan, moves stock or connects to customer-owned Atlas.
const apply=process.argv.includes('--apply');
if(!process.env.MONGODB_URI)throw new Error('Configure private MONGODB_URI');
if(apply&&process.env.CATALOGUE_MIGRATION_CONFIRMED!=='YES')throw new Error('Apply requires CATALOGUE_MIGRATION_CONFIRMED=YES');
await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
try{
 const control=mongoose.connection.useDb(process.env.CONTROL_DB_NAME||'ugs_control',{useCache:true});
 const registries=await control.db.collection('tenantregistries').find({status:{$in:['ACTIVE','SUSPENDED','PROVISIONING']}}).limit(10001).toArray();
 if(registries.length>10000)throw new Error('Limit migration to a reviewed batch');
 for(const registry of registries){
  if(registry.databaseName!==tenantDatabaseName(registry.companyKey))throw new Error('Unexpected platform metadata database name');
  const db=mongoose.connection.useDb(registry.databaseName,{useCache:true}).db;
  const companies=await db.collection('companies').find({}).limit(2).toArray();
  if(companies.length!==1){console.log(JSON.stringify({companyKey:registry.companyKey,status:'MANUAL_REVIEW',reason:'Expected one company metadata record'}));continue;}
  const company=companies[0],legacy=!(company.departmentCatalogueVersion>=1),raw=company.enabledDepartments||[],suggested=raw.map(departmentCode);
  console.log(JSON.stringify({companyKey:registry.companyKey,status:legacy?'LEGACY_COMPATIBILITY':'CANONICAL',selected:raw,suggested,
   unsupported:suggested.filter(d=>!DEPARTMENTS.includes(d)),maxDepartments:company.entitlements?.maxDepartments,apply,
   note:'Review licensed modules and purchased limits before explicitly saving canonical selection. No access changes are applied.'}));
  if(apply&&legacy){const session=await mongoose.startSession();try{await session.withTransaction(async()=>{
   await db.collection('companies').updateOne({_id:company._id,departmentCatalogueVersion:{$exists:false}},{$set:{departmentCatalogueVersion:0}},{session});
   await control.db.collection('tenantregistries').updateOne({_id:registry._id,departmentCatalogueVersion:{$exists:false}},{$set:{departmentCatalogueVersion:0}},{session});
  });}finally{await session.endSession();}}
 }
}finally{await mongoose.disconnect();}
