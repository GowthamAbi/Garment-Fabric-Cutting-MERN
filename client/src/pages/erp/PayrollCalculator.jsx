import { useEffect, useState } from 'react';
import { api } from '../../api.js';
const amount=n=>'₹'+(Number(n||0)/100).toFixed(2);
export default function PayrollCalculator({admin,write,rules,employees,period,onSaved}) {
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>setPreview(null),[period]);
  async function run(fn){setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
  function values(form){return {...Object.fromEntries(new FormData(form)),period};}
  return <section><h3>Payroll calculation from reviewed rules</h3><p>Calendar-day proration supports half days. Enter reviewed paid days. Rule versions explicitly specify contribution rates, caps and wage basis; no statutory rates are assumed. Professional/income tax and other deductions remain reviewed inputs.</p>
    {error&&<p className="erp-error">{error}</p>}
    {admin&&<details><summary>Add approved payroll rule version</summary><form className="erp-grid" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,v=Object.fromEntries(new FormData(f));run(async()=>{await api('/erp/workforce/payroll-rules',{method:'POST',body:JSON.stringify({...v,pfCap:v.pfCap===''?null:v.pfCap,esiEligibilityCeiling:v.esiEligibilityCeiling===''?null:v.esiEligibilityCeiling})});f.reset();await onSaved();});}}>
      {['key','reviewReference'].map(k=><label key={k}>{k}<input name={k} required/></label>)}
      {['effectiveFrom','effectiveTo'].map(k=><label key={k}>{k}<input type="month" name={k} required/></label>)}
      <label>PF basis<select name="pfBasis"><option>BASIC</option><option>BASIC_ALLOWANCE</option></select></label>
      {['employeePfBps','employerPfBps','employeeEsiBps','employerEsiBps'].map(k=><label key={k}>{k} (100 = 1%)<input name={k} type="number" min="0" max="10000" step="1" required/></label>)}
      {['pfCap','esiEligibilityCeiling'].map(k=><label key={k}>{k} INR (blank = no cap)<input name={k} type="number" min="0" step="0.01"/></label>)}<button disabled={busy}>Save reviewed rule version</button>
    </form></details>}
    {write&&<form className="erp-grid" onChange={e=>{delete e.currentTarget.dataset.key;setPreview(null);}} onSubmit={e=>{e.preventDefault();const f=e.currentTarget,v=values(f),key=f.dataset.key||(f.dataset.key=crypto.randomUUID());run(async()=>{if(preview?.previewInput!==JSON.stringify(v))throw new Error('Preview the current inputs before posting');await api('/erp/workforce/payslips',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(v)});delete f.dataset.key;setPreview(null);f.reset();await onSaved();});}}>
      <label>Employee<select name="employeeCode" required><option value="">Select</option>{employees.map(e=><option key={e.code} value={e.code}>{e.code} · {e.name}</option>)}</select></label>
      <label>Approved rule<select name="payrollRuleKey" required><option value="">Select</option>{rules.filter(r=>period>=r.effectiveFrom&&period<=r.effectiveTo).map(r=><option key={r.key}>{r.key}</option>)}</select></label>
      {['monthlyBasic','monthlyAllowance','overtime','tax','otherDeduction'].map(k=><label key={k}>{k} INR<input name={k} type="number" min="0" step="0.01" required defaultValue="0"/></label>)}
      <label>Reviewed paid days<input name="paidDays" type="number" min="0" max="31" step="0.5" required/></label><label>Payroll review notes<input name="notes" required/></label>
      <button type="button" disabled={busy} onClick={e=>{const f=e.currentTarget.form;if(!f.reportValidity())return;const v=values(f);run(async()=>setPreview({...await api('/erp/workforce/payroll-preview',{method:'POST',body:JSON.stringify(v)}),previewInput:JSON.stringify(v)}));}}>Preview calculation</button>
      <button disabled={busy||!preview}>Create reviewed payslip</button>
    </form>}
    {preview&&<p>Gross: {amount(preview.gross)} · Employee deductions: {amount(preview.deductions)} · Net: {amount(preview.net)}<br/>Employer PF: {amount(preview.calculation?.employerPf)} · Employer ESI: {amount(preview.calculation?.employerEsi)}<br/>PF base: {amount(preview.calculation?.pfBase)} · Paid days: {preview.calculation?.paidDays} / {preview.calculation?.calendarDays}</p>}
  </section>;
}
