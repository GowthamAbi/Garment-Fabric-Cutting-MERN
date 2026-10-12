import { departmentSelection, licensedDepartments, ERP_MODULES } from '../../../shared/departmentCatalogue.js';
export const PRICING_MODELS = ['FIXED', 'PER_USER', 'PER_DEPARTMENT', 'COMBINED'];
const money = value => {
  const n=Number(value ?? 0);
  if(!Number.isFinite(n)||n<0||n>100000000||Math.abs(n*100-Math.round(n*100))>0.00001)throw new Error('Prices must be nonnegative INR amounts with at most two decimals');
  return Math.round(n*100);
};
export function subscriptionQuote(plan, selection={}) {
  const model=plan.pricingModel||'FIXED';
  if(!PRICING_MODELS.includes(model))throw new Error('Unsupported pricing model');
  const seats=Number(selection.seats ?? plan.maxUsers);
  if(!Number.isSafeInteger(seats)||seats<1||seats>plan.maxUsers)throw new Error('Seats must fit the package user limit');
  const departments=departmentSelection(selection.departments);
  const licensed=licensedDepartments(plan.modules);
  if(departments.length>plan.maxDepartments||departments.some(d=>!licensed.includes(d)))throw new Error('Selected departments must fit the licensed package');
  const days=Number(plan.validityDays);
  if(!Number.isSafeInteger(days)||days<1||days>3660)throw new Error('Invalid package validity');
  const rate=Number(plan.taxPercent||0);
  if(!Number.isFinite(rate)||rate<0||rate>28)throw new Error('Invalid configured tax rate');
  const base=money(plan.price), user=money(plan.perUserPrice), department=money(plan.perDepartmentPrice), setup=money(plan.setupFee);
  const subtotalPaise=(model==='FIXED'?base:model==='PER_USER'?user*seats:model==='PER_DEPARTMENT'?department*departments.length:base+user*seats+department*departments.length)+setup;
  const taxPaise=Math.round(subtotalPaise*rate/100),totalPaise=subtotalPaise+taxPaise;
  if(!Number.isSafeInteger(totalPaise)||totalPaise<=0)throw new Error('Configure a positive package price');
  if(!plan.modules?.includes('ERP_CORE'))throw new Error('Configure explicit ERP_CORE and purchased features');
  return {version:1,pricingModel:model,seats,departments,validityDays:days,subtotalPaise,taxPaise,totalPaise,total:totalPaise/100,taxAmount:taxPaise/100,setupFee:setup/100,taxPercent:rate,
    entitlements:{maxUsers:seats,maxDepartments:departments.length,modules:[...departments,...ERP_MODULES.filter(m=>plan.modules.includes(m))]}};
}
export function assertQuoteFitsUsers(quote, users) {
  if(users.length>quote.entitlements.maxUsers)throw new Error('Purchased seats cannot be below active user count');
  if(users.some(u=>u.department&&!['MANAGEMENT','ADMIN'].includes(u.department)&&!quote.departments.includes(u.department)))throw new Error('Reassign active users before removing their department');
}
export function provisioningAccess(plan) { return plan==='Trial'?'Active':'PaymentPending'; }
