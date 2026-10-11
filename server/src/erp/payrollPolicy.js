import { fail, money, ratio, safeInteger } from './policy.js';

export function payrollRule(input) {
  const key=String(input.key||'').trim(),reviewReference=String(input.reviewReference||'').trim();
  if(!/^[A-Za-z0-9_-]{2,60}$/.test(key)||!reviewReference||reviewReference.length>500)fail('Rule version key and payroll review reference required');
  const effectiveFrom=String(input.effectiveFrom||''),effectiveTo=String(input.effectiveTo||'');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveTo)||effectiveTo<effectiveFrom)fail('Rule requires valid effective months');
  const rates={};
  for(const k of ['employeePfBps','employerPfBps','employeeEsiBps','employerEsiBps']) {
    const n=Number(input[k]);if(input[k]==null||input[k]===''||typeof input[k]==='boolean'||!Number.isInteger(n)||n<0||n>10000)fail('Enter each reviewed contribution rate in basis points (100 = 1%)');rates[k]=n;
  }
  if(!['BASIC','BASIC_ALLOWANCE'].includes(input.pfBasis))fail('Select PF wage basis');
  const cap=k=>input[k]===null?null:money(input[k]);
  if(input.pfCap===undefined||input.esiEligibilityCeiling===undefined)fail('Specify contribution caps or explicit null for no cap');
  return {key,reviewReference,effectiveFrom,effectiveTo,pfBasis:input.pfBasis,pfCap:cap('pfCap'),esiEligibilityCeiling:cap('esiEligibilityCeiling'),...rates};
}

export function calculateRulePay(input, rule, period) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||period<rule.effectiveFrom||period>rule.effectiveTo)fail('Payroll rule is not effective for this month');
  const [year,month]=period.split('-').map(Number),calendarDays=new Date(Date.UTC(year,month,0)).getUTCDate(),paidDays=Number(input.paidDays);
  if(input.paidDays==null||input.paidDays===''||typeof input.paidDays==='boolean'||!Number.isFinite(paidDays)||paidDays<0||paidDays>calendarDays||paidDays*2%1)fail('Reviewed paid days must be whole or half days within the calendar month');
  const monthlyBasic=money(input.monthlyBasic),monthlyAllowance=money(input.monthlyAllowance||0);
  const basic=ratio(monthlyBasic,paidDays*2,calendarDays*2),allowance=ratio(monthlyAllowance,paidDays*2,calendarDays*2),overtime=money(input.overtime||0);
  const gross=safeInteger(basic+allowance+overtime);
  const pfWage=rule.pfBasis==='BASIC'?basic:safeInteger(basic+allowance);
  const pfBase=rule.pfCap===null?pfWage:Math.min(pfWage,rule.pfCap);
  const esiEligible=rule.esiEligibilityCeiling===null||safeInteger(monthlyBasic+monthlyAllowance)<=rule.esiEligibilityCeiling;
  const amounts={basic,allowance,overtime,pf:ratio(pfBase,rule.employeePfBps,10000),esi:esiEligible?ratio(gross,rule.employeeEsiBps,10000):0,tax:money(input.tax||0),otherDeduction:money(input.otherDeduction||0)};
  const deductions=safeInteger(amounts.pf+amounts.esi+amounts.tax+amounts.otherDeduction);
  if(deductions>gross)fail('Deductions exceed gross earnings');
  return {amounts,gross,deductions,net:gross-deductions,calculation:{ruleKey:rule.key,ruleSnapshot:rule,calendarDays,paidDays,monthlyBasic,monthlyAllowance,pfBase,esiEligible,
    employerPf:ratio(pfBase,rule.employerPfBps,10000),employerEsi:esiEligible?ratio(gross,rule.employerEsiBps,10000):0,
    method:'CALENDAR_PRORATION_REVIEWED_RULE',note:'Company-configured rules; paid days, wage components and eligibility must be reviewed. No filing or payment is performed.'}};
}

export function payrollAccrual(pay) {
  const employer=safeInteger((pay.calculation?.employerPf||0)+(pay.calculation?.employerEsi||0));
  if (![pay.gross,pay.deductions,pay.net].every(n=>Number.isSafeInteger(n)&&n>=0) || pay.gross-pay.deductions!==pay.net) fail('Invalid reviewed payslip totals');
  return [{account:'SALARY_EXPENSE',debit:safeInteger(pay.gross+employer),credit:0},
    {account:'PAYROLL_PAYABLE',debit:0,credit:pay.net},
    {account:'PAYROLL_CONTRIBUTIONS_PAYABLE',debit:0,credit:safeInteger(pay.deductions+employer)}];
}
