import {licensedDepartments} from "../../../../shared/departmentCatalogue.js";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  PauseCircle,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";
import {downloadInvoice} from "../../utils/subscriptionInvoicePdf.js";
import CustomerDatabaseSetup from "../../components/CustomerDatabaseSetup.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const content = {
  "Subscription Plan": [
    CreditCard,
    "Current Plan",
    "Plan status, renewal date and company-level controls.",
  ],
  "Subscription Purchase": [
    FileText,
    "Purchase Subscription",
    "Create a renewal or upgrade request.",
  ],
  "Subscription Bills": [
    ReceiptText,
    "Bills & Payments",
    "Subscription request and payment history.",
  ],
  "Subscription Usage": [
    Gauge,
    "Usage",
    "Users, factories and subscription validity.",
  ],
};
export default function SubscriptionCenterPage({ mode }) {
  const { user } = useAuth();
  const [quote,setQuote]=useState(null);
  const [data, setData] = useState(null),
    [paymentNotice, setPaymentNotice] = useState(""),
    [error, setError] = useState(""),
    [purchasing,setPurchasing] = useState(false),
    [form, setForm] = useState({
      plan: "Professional",
      paymentMethod: "MANUAL",
      seats:1,departments:[],
      notes: "",
    });
  const load = () =>
    api("/saas/subscription")
      .then(value=>{setData(value);setForm(f=>{const plan=value.plans?.find(p=>p.name===f.plan&&p.code!=="TRIAL")||value.plans?.find(p=>p.code!=="TRIAL");return f.departments.length?f:{...f,plan:plan?.name||"",seats:plan?.maxUsers||1,departments:(value.company?.enabledDepartments||[]).filter(d=>licensedDepartments(plan?.modules).includes(d)).slice(0,plan?.maxDepartments||1)};});})
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(()=>{setQuote(null);if(mode!=="Subscription Purchase"||!form.plan||!form.departments.length)return;let alive=true;api("/saas/subscription/quote",{method:"POST",body:JSON.stringify(form)}).then(q=>{if(alive){setQuote(q);setError("");}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[mode,form.plan,form.seats,form.departments]);
  const [Icon, title, subtitle] = content[mode] || content["Subscription Plan"];
  async function status(action) {
    try {
      await api("/saas/subscription/status", {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function purchase(e) {
    e.preventDefault();
    if(purchasing)return;setPurchasing(true);setError("");
    try {
      const result = await api("/saas/subscription", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (form.paymentMethod === "RAZORPAY") {
        await openRazorpay(result, data.razorpayKeyId, async (payload) => {
          const verification = await api("/saas/subscription/verify-razorpay", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setPaymentNotice(verification.pending ? verification.message : "Payment confirmed. Subscription activated.");
          await load();
          if(verification.pending){
            let settled=false;
            for(let attempt=0;attempt<24;attempt++){
              await new Promise(resolve=>setTimeout(resolve,2500));
              const status=await api(`/saas/subscription/payments/${result._id}/status`);
              if(status.activated){settled=true;setPaymentNotice("Payment captured. Package features activated.");await load();break;}
              if(!status.pending){setPaymentNotice("Payment was not settled. No new paid access activated.");break;}
            }
            if(!settled)setPaymentNotice("Activation is not confirmed yet. Refresh payment history before paying again.");
          }
        });
      } else await load();
      setForm({ ...form, notes: "" });
    } catch (x) {
      setError(x.message);
    } finally {setPurchasing(false);}
  }
  async function sendInvoice(invoice) {
    try {
      await api(`/saas/invoices/${invoice._id}/email`, { method: "POST" });
      await load();
    } catch (e) { setError(e.message); }
  }
  if (error && !data)
    return (
      <div className="classic-card">
        <h3>Subscription unavailable</h3>
        <p className="error-text">{error}</p>
        <button
          onClick={() => {
            setError("");
            load();
          }}
        >
          Try Again
        </button>
      </div>
    );
  if (!data) return <div className="loading">Loading subscription...</div>;
  const company = data.company || {};
  return (
    <section className="classic-page">
      {paymentNotice && <p role="status">{paymentNotice}</p>}
      <div className="classic-title">
        <div>
          <small>COMPANY ADMIN · SUBSCRIPTION</small>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {mode === "Subscription Plan" && ["company_owner","company_admin"].includes(user?.role) && <CustomerDatabaseSetup />}
      <div className="overview-metrics">
        <article>
          <i>
            <CreditCard />
          </i>
          <div>
            <span>Plan</span>
            <b>{company.subscriptionPlan || "—"}</b>
            <small>Current subscription</small>
          </div>
        </article>
        <article>
          <i>
            <CheckCircle2 />
          </i>
          <div>
            <span>Status</span>
            <b>{company.subscriptionStatus || "—"}</b>
            <small>Company access status</small>
          </div>
        </article>
        <article>
          <i>
            <Gauge />
          </i>
          <div>
            <span>Factories</span>
            <b>{company.factories?.length || 0}</b>
            <small>Configured factories</small>
          </div>
        </article>
        <article>
          <i>
            <ReceiptText />
          </i>
          <div>
            <span>Expires</span>
            <b>
              {company.subscriptionEndsAt
                ? new Date(company.subscriptionEndsAt).toLocaleDateString()
                : "—"}
            </b>
            <small>Renewal date</small>
          </div>
        </article>
      </div>
      {mode === "Subscription Plan" && (
        <div className="classic-card">
          <h3>Subscription Controls</h3>
          <p>
            Company Admin can activate, pause or remove company subscription
            access.
          </p>
          <div className="row-actions">
            <button className="primary" onClick={() => status("ACTIVATE")}>
              <CheckCircle2 /> Activate
            </button>
            <button onClick={() => status("PAUSE")}>
              <PauseCircle /> Pause
            </button>
            <button className="danger" onClick={() => status("REMOVE")}>
              <Trash2 /> Remove
            </button>
          </div>
        </div>
      )}
      {mode === "Subscription Purchase" && (
        <div className="classic-card">
          <form className="pending-form" onSubmit={purchase}>
            <label>
              <span>Plan</span>
              <select
                value={form.plan}
                onChange={(e) => {const p=data.plans.find(p=>p.name===e.target.value);setForm({...form,plan:p.name,seats:p.maxUsers,departments:form.departments.filter(d=>licensedDepartments(p.modules).includes(d)).slice(0,p.maxDepartments)});}}
              >
                {(data.plans || []).filter(p=>p.code!=="TRIAL").map((x) => (
                  <option key={x._id} value={x.name}>
                    {x.name} · ₹{x.price}
                  </option>
                ))}
              </select>
            </label>
            <label><span>Purchased user seats (includes company owner)</span><input type="number" min="1" max={data.plans.find(p=>p.name===form.plan)?.maxUsers||1} value={form.seats} onChange={e=>setForm({...form,seats:Number(e.target.value)})}/></label>
            <fieldset><legend>Purchased departments</legend>{licensedDepartments(data.plans.find(p=>p.name===form.plan)?.modules).map(d=><label key={d}><input type="checkbox" checked={form.departments.includes(d)} disabled={!form.departments.includes(d)&&form.departments.length>=(data.plans.find(p=>p.name===form.plan)?.maxDepartments||1)} onChange={e=>setForm({...form,departments:e.target.checked?[...form.departments,d]:form.departments.filter(x=>x!==d)})}/>{d}</label>)}</fieldset>
            {quote&&<p role="status">Subtotal ₹{(quote.subtotalPaise/100).toFixed(2)} · Tax ₹{quote.taxAmount.toFixed(2)} · Total ₹{quote.total.toFixed(2)} · {quote.validityDays} days. Final amount is revalidated on the server when ordering.</p>}
            <label>
              <span>Payment</span>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value })
                }
              >
                <option value="MANUAL">Manual Approval</option>
                <option value="RAZORPAY" disabled={!data.razorpayEnabled}>
                  Razorpay {data.razorpayEnabled ? "" : "(not configured)"}
                </option>
              </select>
            </label>
            <label>
              <span>Reference / Notes</span>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <button className="primary" disabled={purchasing||!quote}>
              {form.paymentMethod === "RAZORPAY"
                ? "Pay with Razorpay"
                : "Create Manual Request"}
            </button>
          </form>
        </div>
      )}
      {mode === "Subscription Bills" && (
        <div className="classic-card">
          <h3>Tax Invoices</h3>
          <DataTable
            rows={data.invoices || []}
            columns={[
              { key: "invoiceNumber", label: "Invoice" },
              { key: "invoiceDate", label: "Date", render: (r) => new Date(r.invoiceDate).toLocaleDateString() },
              { key: "grandTotal", label: "Total ₹" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions", render: (r) => (
                <span className="row-actions">
                  <button type="button" onClick={() => downloadInvoice(r)}>PDF</button>
                  <button type="button" onClick={() => sendInvoice(r)}>Email</button>
                </span>
              ) },
            ]}
          />
          <h3>Payment History</h3>
          <DataTable
            rows={data.payments || []}
            columns={[
              { key: "referenceNo", label: "Reference" },
              { key: "plan", label: "Plan" },
              { key: "amount", label: "Amount ₹" },
              { key: "paymentMethod", label: "Method" },
              { key: "status", label: "Status" },
              {
                key: "createdAt",
                label: "Date",
                render: (r) => new Date(r.createdAt).toLocaleDateString(),
              },
            ]}
          />
        </div>
      )}
      {mode === "Subscription Usage" && (
        <div className="classic-card">
          <h3>Company Usage</h3>
          <div className="summary-grid">
            <div>
              <small>Company</small>
              <b>{company.companyName}</b>
            </div>
            <div>
              <small>Plan</small>
              <b>{company.subscriptionPlan}</b>
            </div>
            <div>
              <small>Status</small>
              <b>{company.subscriptionStatus}</b>
            </div>
            <div>
              <small>Factories</small>
              <b>{company.factories?.length || 0}</b>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

async function openRazorpay(order, key, verified) {
  if (!window.Razorpay) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Razorpay checkout could not load"));
      document.body.appendChild(s);
    });
  }
  await new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key,
      amount: Math.round(Number(order.amount) * 100),
      currency: order.currency || "INR",
      name: "UG SaaS",
      description: `${order.plan} subscription`,
      order_id: order.providerOrderId,
      handler: async (payload) => {
        try {
          await verified(payload);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
    });
    checkout.on("payment.failed",()=>reject(new Error("Payment failed. No new subscription access was activated.")));
    checkout.open();
  });
}
