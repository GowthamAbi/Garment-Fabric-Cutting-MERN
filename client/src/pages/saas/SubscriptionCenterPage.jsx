import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, FileText, Gauge, PauseCircle, ReceiptText, Trash2 } from "lucide-react";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";

const content = {
  "Subscription Plan": [CreditCard, "Current Plan", "Plan status, renewal date and company-level controls."],
  "Subscription Purchase": [FileText, "Purchase Subscription", "Create a renewal or upgrade request."],
  "Subscription Bills": [ReceiptText, "Bills & Payments", "Subscription request and payment history."],
  "Subscription Usage": [Gauge, "Usage", "Users, factories and subscription validity."],
};
export default function SubscriptionCenterPage({ mode }) {
  const [data,setData]=useState(null),[error,setError]=useState(""),[form,setForm]=useState({plan:"Professional",paymentMethod:"MANUAL",notes:""});
  const load=()=>api("/saas/subscription").then(setData).catch(e=>setError(e.message));
  useEffect(load,[]);
  const [Icon,title,subtitle]=content[mode]||content["Subscription Plan"];
  async function status(action){try{await api("/saas/subscription/status",{method:"PATCH",body:JSON.stringify({action})});await load();}catch(e){setError(e.message)}}
  async function purchase(e){e.preventDefault();try{const result=await api("/saas/subscription",{method:"POST",body:JSON.stringify(form)});if(form.paymentMethod==="RAZORPAY"){await openRazorpay(result,data.razorpayKeyId,async payload=>{await api("/saas/subscription/verify-razorpay",{method:"POST",body:JSON.stringify(payload)});await load()})}else await load();setForm({...form,notes:""});}catch(x){setError(x.message)}}
  if(error&&!data)return <div className="classic-card"><h3>Subscription unavailable</h3><p className="error-text">{error}</p><button onClick={()=>{setError("");load()}}>Try Again</button></div>;
  if(!data)return <div className="loading">Loading subscription...</div>;
  const company=data.company||{};
  return <section className="classic-page"><div className="classic-title"><div><small>COMPANY ADMIN · SUBSCRIPTION</small><h2>{title}</h2><p>{subtitle}</p></div></div>{error&&<p className="error-text">{error}</p>}
    <div className="overview-metrics"><article><i><CreditCard/></i><div><span>Plan</span><b>{company.subscriptionPlan||"—"}</b><small>Current subscription</small></div></article><article><i><CheckCircle2/></i><div><span>Status</span><b>{company.subscriptionStatus||"—"}</b><small>Company access status</small></div></article><article><i><Gauge/></i><div><span>Factories</span><b>{company.factories?.length||0}</b><small>Configured factories</small></div></article><article><i><ReceiptText/></i><div><span>Expires</span><b>{company.subscriptionEndsAt?new Date(company.subscriptionEndsAt).toLocaleDateString():"—"}</b><small>Renewal date</small></div></article></div>
    {mode==="Subscription Plan"&&<div className="classic-card"><h3>Subscription Controls</h3><p>Company Admin can activate, pause or remove company subscription access.</p><div className="row-actions"><button className="primary" onClick={()=>status("ACTIVATE")}><CheckCircle2/> Activate</button><button onClick={()=>status("PAUSE")}><PauseCircle/> Pause</button><button className="danger" onClick={()=>status("REMOVE")}><Trash2/> Remove</button></div></div>}
    {mode==="Subscription Purchase"&&<div className="classic-card"><form className="pending-form" onSubmit={purchase}><label><span>Plan</span><select value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})}>{(data.plans||[]).map(x=><option key={x._id} value={x.name}>{x.name} · ₹{x.price}</option>)}</select></label><label><span>Payment</span><select value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})}><option value="MANUAL">Manual Approval</option><option value="RAZORPAY" disabled={!data.razorpayEnabled}>Razorpay {data.razorpayEnabled?"":"(not configured)"}</option></select></label><label><span>Reference / Notes</span><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><button className="primary">{form.paymentMethod==="RAZORPAY"?"Pay with Razorpay":"Create Manual Request"}</button></form></div>}
    {mode==="Subscription Bills"&&<div className="classic-card"><DataTable rows={data.payments||[]} columns={[{key:"referenceNo",label:"Reference"},{key:"plan",label:"Plan"},{key:"amount",label:"Amount ₹"},{key:"paymentMethod",label:"Method"},{key:"status",label:"Status"},{key:"createdAt",label:"Date",render:r=>new Date(r.createdAt).toLocaleDateString()}]}/></div>}
    {mode==="Subscription Usage"&&<div className="classic-card"><h3>Company Usage</h3><div className="summary-grid"><div><small>Company</small><b>{company.companyName}</b></div><div><small>Plan</small><b>{company.subscriptionPlan}</b></div><div><small>Status</small><b>{company.subscriptionStatus}</b></div><div><small>Factories</small><b>{company.factories?.length||0}</b></div></div></div>}
  </section>;
}

async function openRazorpay(order,key,verified){if(!window.Razorpay){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=resolve;s.onerror=()=>reject(new Error("Razorpay checkout could not load"));document.body.appendChild(s)})}await new Promise((resolve,reject)=>{const checkout=new window.Razorpay({key,amount:Math.round(Number(order.amount)*100),currency:order.currency||"INR",name:"UG SaaS",description:`${order.plan} subscription`,order_id:order.providerOrderId,handler:async payload=>{try{await verified(payload);resolve()}catch(e){reject(e)}},modal:{ondismiss:()=>reject(new Error("Payment cancelled"))}});checkout.open()})}
