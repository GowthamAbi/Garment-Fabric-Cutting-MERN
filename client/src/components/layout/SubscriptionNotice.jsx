import {useEffect,useState} from 'react';
import {api} from '../../api.js';
export default function SubscriptionNotice({user,onUpgrade}){
 const [status,setStatus]=useState(null);
 useEffect(()=>{if(user?.role==='saas_super_admin')return;let alive=true;const load=()=>api('/saas/access-status').then(v=>{if(alive)setStatus(v);}).catch(()=>{});load();const timer=setInterval(load,60000);return()=>{alive=false;clearInterval(timer);};},[user?.id,user?.role]);
 if(!status||(status.kind!=='TRIAL'&&status.alert==='ACTIVE'))return null;
 return <div role="status" style={{padding:'12px',border:'1px solid #d97706',marginBottom:'12px',borderRadius:'8px',background:'#fffbeb',color:'#78350f'}}>{status.expired?'Access expired. Your company data is retained.':`${status.kind==='TRIAL'?'Trial':'Subscription'}: ${status.daysRemaining} day(s) remaining.`} {status.expiresAt&&<span>Expires {new Date(status.expiresAt).toLocaleString()}.</span>} {['company_admin','admin'].includes(user?.role)&&<button onClick={onUpgrade}>Upgrade / Renew</button>}</div>;
}
