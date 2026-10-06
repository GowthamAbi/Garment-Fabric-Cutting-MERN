import { useEffect, useState } from "react";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";

const availableScopes = ["dashboard", "reports", "fabric-cutting", "production", "delivery", "items", "pos", "transactions", "warehouse", "garments", "masters"];

export default function SupportAccessPage() {
  const [grants, setGrants] = useState([]);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ reason: "", durationHours: 1, scopes: ["reports"] });
  const load = () => api("/saas/support-grants").then(setGrants).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const toggle = (scope) => setForm({
    ...form,
    scopes: form.scopes.includes(scope) ? form.scopes.filter((x) => x !== scope) : [...form.scopes, scope],
  });
  async function create(event) {
    event.preventDefault();
    try {
      const result = await api("/saas/support-grants", { method: "POST", body: JSON.stringify(form) });
      setCreated(result);
      setForm({ reason: "", durationHours: 1, scopes: ["reports"] });
      await load();
    } catch (e) { setError(e.message); }
  }
  async function revoke(id) {
    await api(`/saas/support-grants/${id}/revoke`, { method: "PATCH" });
    await load();
  }
  return (
    <section className="classic-page">
      <div className="classic-title"><div><small>COMPANY DATA SECURITY</small><h2>Support Access</h2><p>UG SaaS Owner has no default access. Create a temporary read-only grant only when support is required.</p></div></div>
      {error && <p className="error-text">{error}</p>}
      <div className="classic-card">
        <form className="pending-form" onSubmit={create}>
          <label><span>Reason</span><input required maxLength="500" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
          <label><span>Duration</span><select value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}>{[1,2,4,8,12,24].map((v) => <option key={v} value={v}>{v} hour(s)</option>)}</select></label>
          <fieldset><legend>Read-only modules</legend><div className="row-actions">{availableScopes.map((scope) => <label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={() => toggle(scope)} /> {scope}</label>)}</div></fieldset>
          <button className="primary">Create Temporary Support Grant</button>
        </form>
        {created && <div className="success-message"><b>Copy now — shown only once</b><br /><code>{created.supportCode}</code><br />Expires: {new Date(created.expiresAt).toLocaleString()}</div>}
      </div>
      <div className="classic-card"><h3>Grant History</h3><DataTable rows={grants} columns={[
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" },
        { key: "scopes", label: "Scopes", render: (r) => r.scopes?.join(", ") },
        { key: "expiresAt", label: "Expires", render: (r) => new Date(r.expiresAt).toLocaleString() },
        { key: "action", label: "Action", render: (r) => r.status === "ACTIVE" ? <button className="danger" onClick={() => revoke(r._id)}>Revoke</button> : "—" },
      ]} /></div>
    </section>
  );
}

