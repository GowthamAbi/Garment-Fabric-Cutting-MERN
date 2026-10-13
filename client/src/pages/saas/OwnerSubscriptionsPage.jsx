import { useEffect, useState } from "react";
import { api } from "../../api.js";
import PageTitle from "../../components/common/PageTitle.jsx";
import DataTable from "../../components/DataTable.jsx";

export default function OwnerSubscriptionsPage() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [billing, setBilling] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError("");
    api("/companies").then(rows => {
      if (!current) return;
      setCompanies(rows);
      setCompanyId(id => rows.some(row => row._id === id) ? id : rows[0]?._id || "");
    }).catch(e => { if (current) setError(e.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [revision]);
  useEffect(() => {
    let current = true;
    setBilling(null); setError("");
    if (companyId) api(`/saas/owner-companies/${companyId}/billing`)
      .then(value => { if (current) setBilling(value); })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [companyId, revision]);
  const company = companies.find(row => row._id === companyId);
  return <section className="classic-page">
    <PageTitle title="Company subscriptions" subtitle="Review registered company plans, expiry dates and billing history." />
    <div className="classic-card">
      <div className="table-toolbar">
        <label>Company<select value={companyId} onChange={e => setCompanyId(e.target.value)} disabled={loading || !companies.length}>
          {!companies.length && <option value="">No companies available</option>}
          {companies.map(row => <option key={row._id} value={row._id}>{row.companyName} · {row.companyKey}</option>)}
        </select></label>
        <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading}>Refresh</button>
      </div>
      {loading && <p role="status">Loading companies…</p>}
      {error && <p role="alert">{error}</p>}
      {company && <dl className="owner-subscription-details">
        <div><dt>Workspace status</dt><dd>{company.status}</dd></div>
        <div><dt>Assigned plan</dt><dd>{company.subscriptionPlan || "—"}</dd></div>
        <div><dt>Subscription expiry</dt><dd>{company.subscriptionEndsAt ? new Date(company.subscriptionEndsAt).toLocaleDateString("en-IN") : "Not recorded"}</dd></div>
        <div><dt>Licensed departments</dt><dd>{company.enabledDepartments?.join(", ") || "None selected"}</dd></div>
      </dl>}
      <p>Workspace provisioning is managed through Companies; renewal payment approvals are managed through Payments &amp; Sales. Company administrators submit renewal requests from their own workspace.</p>
    </div>
    {company && <div className="classic-card"><h3>Payment history · {company.companyName}</h3>
      <DataTable loading={!billing && !error} rows={billing?.payments || []} columns={[
        {key:"referenceNo",label:"Reference"},{key:"plan",label:"Plan"},
        {key:"amount",label:"Amount ₹"},{key:"paymentMethod",label:"Method"},
        {key:"status",label:"Status"},
        {key:"createdAt",label:"Requested",render:row => new Date(row.createdAt).toLocaleDateString("en-IN")}
      ]} />
      <h3>Invoices</h3><DataTable loading={!billing && !error} rows={billing?.invoices || []} columns={[
        {key:"invoiceNumber",label:"Invoice"},{key:"invoiceDate",label:"Date",render:row => new Date(row.invoiceDate).toLocaleDateString("en-IN")},
        {key:"grandTotal",label:"Total ₹"},{key:"status",label:"Status"}
      ]} />
    </div>}
  </section>;
}
