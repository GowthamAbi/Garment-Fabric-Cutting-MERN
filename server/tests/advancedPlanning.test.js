import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { scenarioForecast } from '../src/erp/forecastPolicy.js';
import { statutoryReport } from '../src/erp/statutoryReport.js';
import { provisionalReceipt } from '../../client/src/utils/offlineReceipt.js';
import { saleDraft,encryptOfflineCatalog,decryptOfflineCatalog } from '../../client/src/utils/offlinePos.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
test('offline device catalog rejects wrong passphrase, workspace, tampering and expiry',async()=>{
 const now=new Date('2026-10-11T12:00:00Z'),pass='reviewed device passphrase 123!',scope='company-factory-user';
 const record=await encryptOfflineCatalog(scope,[{_id:'a'.repeat(24),code:'B1',qty:10,stage:'SHOP:A',customerEmail:'never store'},{_id:'b'.repeat(24),qty:5,stage:'WAREHOUSE'}],pass,now);
 const catalog=await decryptOfflineCatalog(record,scope,pass,now);assert.equal(catalog.bundles.length,1);assert.equal(catalog.bundles[0].customerEmail,undefined);
 await assert.rejects(decryptOfflineCatalog(record,scope,'wrong passphrase value',now));
 await assert.rejects(decryptOfflineCatalog(record,'other-company',pass,now));
 await assert.rejects(decryptOfflineCatalog({...record,data:record.data.map((n,i)=>i===0?n^1:n)},scope,pass,now));
 await assert.rejects(decryptOfflineCatalog(record,scope,pass,new Date('2026-10-12T12:00:00Z')));
});
test('forecast applies reviewed season/promotion and only explicit stockout imputation',()=>{
 const now=new Date('2026-10-11T12:00:00Z'),daily=Array(35).fill(10);daily[34]=0;
 const normal=scenarioForecast(daily,{leadDays:7},now);
 const scenario=scenarioForecast(daily,{leadDays:7,stockoutDates:['2026-10-11'],promotionMultiplier:2,seasonalMultiplier:1.5,stock:20,inTransit:10},now);
 assert.equal(normal.stockoutDays,0);assert.equal(scenario.stockoutDays,1);assert.equal(scenario.weekdaySeasonality,true);
 assert.equal(scenario.expected,210);assert.equal(scenario.suggested,180);assert.equal(scenario.horizon[0].date,'2026-10-12');
 assert.throws(()=>scenarioForecast(daily,{stockoutDates:['2026-02-30']},now));
 assert.throws(()=>scenarioForecast(daily,{promotionMultiplier:Infinity},now));
});
test('weekday forecast preserves weekly level and flags insufficient observed weeks',()=>{
 const now=new Date('2026-10-11T12:00:00Z'),daily=Array.from({length:35},(_,i)=>i%7===6?70:7);
 const report=scenarioForecast(daily,{leadDays:7},now);
 assert.equal(report.weekdaySeasonality,true);assert.ok(report.horizon[6].expected>report.horizon[0].expected);
 assert.equal(scenarioForecast(Array(14).fill(4),{leadDays:7},now).weekdaySeasonality,false);
});
test('provisional receipts retain retry key and integer paise totals without pretending final invoice',()=>{
 const draft=saleDraft('company|user',{bundleId:'a'.repeat(24),quantity:3,unitPrice:10.01,discount:0.02,taxPercent:5,taxType:'IGST',paymentMode:'CASH'});
 const receipt=provisionalReceipt(draft);assert.equal(receipt.reference,draft.key);assert.equal(receipt.net,3001);assert.equal(receipt.tax,150);assert.equal(receipt.total,3151);assert.equal(receipt.status,'PROVISIONAL_PENDING_SYNC');
});
test('statutory review pack rejects unposted/manual rules and sums employee/employer shares',()=>{
 const slip={_id:'s',employeeCode:'E1',period:'2026-10',status:'POSTED',accountingDocumentId:'doc',gross:100000,
  amounts:{pf:1200,esi:750,tax:500},calculation:{pfBase:10000,ruleKey:'reviewed',ruleSnapshot:{key:'reviewed'},employerPf:1200,employerEsi:3250}};
 assert.deepEqual(statutoryReport([slip],'2026-10').totals,{PF:2400,ESI:4000,TDS:500});
 assert.throws(()=>statutoryReport([{...slip,accountingDocumentId:null}],'2026-10'));
 assert.throws(()=>statutoryReport([{...slip,calculation:null}],'2026-10'));
 assert.equal(statutoryReport([{...slip,status:'VOID'}],'2026-10').rows.length,0);
});
