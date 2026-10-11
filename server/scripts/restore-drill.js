import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {EJSON} from 'bson';
import {decryptBackup} from '../src/utils/backupCrypto.js';
import {canonicalDatabaseRecord} from '../src/utils/customerDatabasePolicy.js';
import {tenantDatabaseName} from '../src/config/tenantDatabase.js';

// Staging-only drill. No production URI fallback, data deletion or registry switch.
const file=process.argv[2],destination=process.env.DRILL_DATABASE_NAME;
if(!file||!process.env.DRILL_MONGODB_URI||process.env.DRILL_CONFIRMED!=='YES'||!/^ugs_restore_drill_[a-z0-9_]{4,35}$/.test(destination||''))throw new Error('Specify backup FILE, private DRILL_MONGODB_URI, DRILL_DATABASE_NAME (ugs_restore_drill_ prefix) and DRILL_CONFIRMED=YES');
const snapshot=EJSON.parse(decryptBackup(await readFile(file,'utf8'),process.env.BACKUP_PASSPHRASE));
if(snapshot.formatVersion!==1||snapshot.companyKey!==process.env.BACKUP_COMPANY_KEY||snapshot.databaseName!==tenantDatabaseName(process.env.BACKUP_COMPANY_KEY))throw new Error('Backup identity does not match the selected company');
if(!Array.isArray(snapshot.collections)||new Set(snapshot.collections.map(c=>c.name)).size!==snapshot.collections.length||snapshot.collections.some(c=>!/^[a-z][a-z0-9_]{0,100}$/.test(c.name)||!Array.isArray(c.rows)||!Array.isArray(c.indexes)))throw new Error('Invalid backup collection manifest');
const digest=rows=>{const h=crypto.createHash('sha256');for(const row of rows.map(canonicalDatabaseRecord).sort())h.update(row+'\n');return h.digest('hex');};
const connection=mongoose.createConnection(process.env.DRILL_MONGODB_URI,{autoCreate:false,autoIndex:false,serverSelectionTimeoutMS:10000});
connection.on('error',()=>{});
try{
 await connection.asPromise();const db=connection.useDb(destination,{useCache:true}).db;
 if((await db.listCollections().toArray()).length)throw new Error('Drill destination must be empty');
 const report={drillDatabase:destination,companyKey:snapshot.companyKey,startedAt:new Date().toISOString(),collections:[],passed:false,ttlNote:'TTL indexes are not enabled in the isolated drill; production retention behavior needs separate verification.'};
 for(const c of snapshot.collections){
  await db.createCollection(c.name);const target=db.collection(c.name);
  for(let i=0;i<c.rows.length;i+=200)await target.insertMany(c.rows.slice(i,i+200));
  let indexes=0;
  for(const index of c.indexes){if(index.name==='_id_'||index.expireAfterSeconds!==undefined)continue;const {key,name,unique,sparse,partialFilterExpression,collation}=index;await target.createIndex(key,Object.fromEntries(Object.entries({name,unique,sparse,partialFilterExpression,collation}).filter(([,v])=>v!==undefined)));indexes++;}
  const restored=await target.find({}).toArray(),expectedHash=digest(c.rows),restoredHash=digest(restored);
  if(restored.length!==c.rows.length||expectedHash!==restoredHash)throw new Error('Restored collection content mismatch');
  report.collections.push({collection:c.name,rows:restored.length,sha256:restoredHash,nonTtlIndexes:indexes});
 }
 report.passed=true;report.finishedAt=new Date().toISOString();
 if(process.env.DRILL_REPORT_FILE)await writeFile(process.env.DRILL_REPORT_FILE,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify(report));
}catch(_error){console.error('Restore drill failed. Isolated target is retained for operator inspection; production data and routing are unchanged.');process.exitCode=1;}finally{await connection.close();}
