import { fail, safeInteger } from './policy.js';
export function statutoryReport(slips, period) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))fail('Valid payroll month required');
  const rows=slips.filter(s=>s.status==='POSTED'&&s.period===period).map(s=>{
    if(!s.accountingDocumentId||s.accountingReversedBy)fail('Post all reviewed salary accruals before preparing statutory report');
    if(!s.calculation?.ruleSnapshot)fail('Statutory report requires reviewed rule-based payslips');
    return {id:String(s._id),employeeCode:s.employeeCode,period,rule:s.calculation.ruleKey,
      pfWage:s.calculation.pfBase,employeePf:s.amounts.pf,employerPf:s.calculation.employerPf||0,
      employeeEsi:s.amounts.esi,employerEsi:s.calculation.employerEsi||0,tds:s.amounts.tax,gross:s.gross};
  }).sort((a,b)=>a.employeeCode.localeCompare(b.employeeCode));
  const total=keys=>rows.reduce((sum,row)=>safeInteger(sum+keys.reduce((n,key)=>safeInteger(n+row[key]),0)),0);
  return {period,rows,totals:{PF:total(['employeePf','employerPf']),ESI:total(['employeeEsi','employerEsi']),TDS:total(['tds'])},
    notice:'Review pack in paise. Not an official ECR, ESIC return or TDS filing. Portal identities, eligibility, EPS/EDLI/administration charges and tax review must be verified before filing.'};
}
