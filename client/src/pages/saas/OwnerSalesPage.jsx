import { useEffect, useState } from "react";
import { Building2, CreditCard, IndianRupee, TrendingUp } from "lucide-react";
import { api } from "../../api.js";
import PageTitle from "../../components/common/PageTitle.jsx";

export default function OwnerSalesPage({ notify }) {
  const [overview, setOverview] = useState(null),
    [sub, setSub] = useState({ payments: [] });
  const [error, setError] = useState("");
  const [approving, setApproving] = useState("");
  const load = () =>
    Promise.all([api("/saas/owner-overview"), api("/saas/subscription")])
      .then(([a, b]) => {
        setOverview(a);
        setSub(b);
      })
      .catch((e) => {setError(e.message);notify?.(e.message);});
  useEffect(() => {
    load();
  }, []);
  async function approve(id) {
    if (approving) return;
    setApproving(id);
    try {
      await api(`/saas/subscription/${id}/approve`, { method: "PATCH" });
      await load();
      notify?.("Manual payment approved and subscription activated");
    } catch (e) {
      notify?.(e.message);
    } finally {setApproving("");}
  }
  if (!overview) return error ? <p role="alert">{error} <button onClick={() => {setError("");load();}}>Retry</button></p> : <p role="status">Loading sales...</p>;
  const m = overview.metrics;
  const max = Math.max(1, ...overview.planSales.map((x) => x.revenue));
  const companyName = (company) =>
    company?.companyName || company?.name || company?._id || company || "—";
  return (
    <section className="classic-page">
      <PageTitle
        title="Payments & Sales Analytics"
        subtitle="Manual approvals, Razorpay sales, revenue, plan mix and renewal risk"
      />
      <div className="overview-metrics">
        <Metric icon={<Building2 />} label="Trials expiring within 3 days" value={m.expiringTrials || 0} />
        <Metric icon={<Building2 />} label="Expired trials" value={m.expiredTrials || 0} />
        <Metric
          icon={<IndianRupee />}
          label="Total Revenue"
          value={`₹${m.revenue.toLocaleString("en-IN")}`}
        />
        <Metric
          icon={<CreditCard />}
          label="Pending Approval"
          value={`₹${m.pendingAmount.toLocaleString("en-IN")}`}
        />
        <Metric
          icon={<Building2 />}
          label="Active Workspaces"
          value={m.activeCompanies}
        />
        <Metric
          icon={<TrendingUp />}
          label="New Requests"
          value={m.newRequests}
        />
      </div>
      <div className="classic-two-column">
        <div className="classic-card">
          <h3>Plan-wise Revenue</h3>
          <div className="sales-bars">
            {overview.planSales.map((x) => (
              <div key={x.name}>
                <span>
                  <b>{x.name}</b>
                  <small>
                    {x.customers} customers · ₹
                    {x.revenue.toLocaleString("en-IN")}
                  </small>
                </span>
                <i>
                  <em style={{ width: `${(x.revenue / max) * 100}%` }} />
                </i>
              </div>
            ))}
          </div>
        </div>
        <div className="classic-card">
          <h3>Renewal Alerts</h3>
          {overview.expiring.length ? (
            overview.expiring.map((x) => (
              <p key={x._id}>
                <b>{x.companyName}</b> ·{" "}
                {x.subscriptionEndsAt
                  ? new Date(x.subscriptionEndsAt).toLocaleDateString()
                  : "No expiry"}
              </p>
            ))
          ) : (
            <p>No subscriptions expiring in 15 days.</p>
          )}
        </div>
      </div>
      <div className="classic-card">
        <h3>Payment Transactions</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Company</th>
                <th>Plan</th>
                <th>Method</th>
                <th>Base/Tax/Setup</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!sub.payments?.length && <tr><td colSpan={8}>No payment transactions found.</td></tr>}
              {(sub.payments || []).map((x) => (
                <tr key={x._id}>
                  <td>{x.referenceNo}</td>
                  <td>{companyName(x.companyId)}</td>
                  <td>{x.plan}</td>
                  <td>{x.paymentMethod}</td>
                  <td>
                    Base ₹{Math.max(0, Number(x.amount || 0) - Number(x.taxAmount || 0) - Number(x.setupFee || 0)).toLocaleString("en-IN")}
                    <br />
                    Tax ₹{x.taxAmount || 0}
                    <br />
                    Setup ₹{x.setupFee || 0}
                  </td>
                  <td>₹{x.amount}</td>
                  <td>{x.status}</td>
                  <td>
                    {x.status === "PENDING_APPROVAL" ? (
                      <button
                        className="primary"
                        disabled={Boolean(approving)}
                        onClick={() => approve(x._id)}
                      >
                        {approving === x._id ? "Approving…" : "Approve"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
function Metric({ icon, label, value }) {
  return (
    <article>
      <i>{icon}</i>
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
    </article>
  );
}
