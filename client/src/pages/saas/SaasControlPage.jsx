import { useEffect, useState } from "react";
import { api } from "../../api.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

export default function SaasControlPage({ notify }) {
  const [data, setData] = useState({ company: {}, payments: [] });
  const [form, setForm] = useState({ plan: "Professional", paymentMethod: "MANUAL", notes: "" });
  const load = async () => setData(await api("/saas/subscription"));
  useEffect(() => { load(); }, []);
  async function submit(event) { event.preventDefault(); const result = await api("/saas/subscription", { method: "POST", body: JSON.stringify(form) }); await load(); notify(result.paymentMethod === "MANUAL" ? "Payment submitted for approval" : "Razorpay order created"); }
  return <><PageTitle title="Subscription & Security" subtitle="Company plan, payment and access expiry control"/><div className="subscription-summary"><div><small>Plan</small><b>{data.company?.subscriptionPlan || "-"}</b></div><div><small>Status</small><b>{data.company?.subscriptionStatus || "-"}</b></div><div><small>Expires</small><b>{data.company?.subscriptionEndsAt ? new Date(data.company.subscriptionEndsAt).toLocaleDateString() : "Not set"}</b></div></div><Card title="Renew / Upgrade"><form className="pending-form" onSubmit={submit}><label><span>Plan</span><select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>{["Trial","Basic","Professional","Enterprise"].map((v) => <option key={v}>{v}</option>)}</select></label><label><span>Payment</span><select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option value="MANUAL">Manual Admin Approval</option><option value="RAZORPAY" disabled={!data.razorpayEnabled}>Razorpay {data.razorpayEnabled ? "" : "(not configured)"}</option></select></label><label><span>Notes / Payment Reference</span><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label><button className="primary">Create Subscription Request</button></form></Card><Card title="Payment History"><DataTable rows={data.payments || []} columns={[{key:"referenceNo",label:"Reference"},{key:"plan",label:"Plan"},{key:"amount",label:"Amount ₹"},{key:"paymentMethod",label:"Method"},{key:"status",label:"Status"},{key:"periodEnd",label:"Expiry",render:(row)=>row.periodEnd?new Date(row.periodEnd).toLocaleDateString():"-"}]}/></Card></>;
}
