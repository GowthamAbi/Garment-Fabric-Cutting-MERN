import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function CustomerDatabaseSetup() {
  const [status, setStatus] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ databaseName: "", connectionString: "", consent: false });
  async function load() {
    try { setStatus(await api("/saas/customer-database")); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/saas/customer-database", { method: "POST", body: JSON.stringify(form) });
      setNotice(result.message); await load();
    } catch (e) { setError(e.message); }
    finally {
      // The connection string is never stored in localStorage or rendered back.
      setForm(previous => ({ ...previous, connectionString: "" })); setBusy(false);
    }
  }
  async function transfer() {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/saas/customer-database/transfer", { method: "POST", body: JSON.stringify({ confirmTransfer: true }) });
      setNotice(result.message); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const candidate = status?.candidate;
  const locked = status?.routing === "CUSTOMER" || status?.routing === "MIGRATING" || candidate?.state === "VALIDATING";
  return <article className="classic-card">
    <h3>Your company database</h3>
    <p>Use your own MongoDB Atlas account and a dedicated database user with read/write access to this database. Operational ERP data will move to your database. Login accounts and subscription billing stay with UG SaaS.</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {status ? <>
      <p><strong>Storage:</strong> {status.routing === "CUSTOMER" ? "Customer Atlas" : status.routing === "MIGRATING" ? "Transfer in progress — ERP maintenance" : "Platform trial database"}</p>
      {!status.eligible && <p>Transfer becomes available after your 7-day trial period, on {new Date(status.trialEndsAt).toLocaleString()}. You can validate your connection now.</p>}
      {candidate && <p><strong>Database:</strong> {candidate.databaseName} · {candidate.state.replaceAll("_", " ")}</p>}
      {candidate?.lastError && <p className="error-text" role="alert">{candidate.lastError}</p>}
      {status.routing !== "CUSTOMER" && <>
        {!status.encryptionConfigured && <p className="error-text">Database encryption must be configured by the platform administrator before saving a connection.</p>}
        <form className="pending-form" onSubmit={save} autoComplete="off">
          <label><span>Dedicated database name</span><input required minLength={3} maxLength={63} pattern="[a-z][a-z0-9_]{2,62}" value={form.databaseName} disabled={locked || busy} onChange={e => setForm({ ...form, databaseName: e.target.value })} placeholder="my_company_erp" /></label>
          <label><span>MongoDB Atlas connection string</span><input type="password" autoComplete="new-password" required maxLength={4000} value={form.connectionString} disabled={locked || busy} onChange={e => setForm({ ...form, connectionString: e.target.value })} placeholder="mongodb+srv://..." /></label>
          <label style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", alignItems: "flex-start" }}><input style={{ width: "auto", flexShrink: 0 }} type="checkbox" checked={form.consent} disabled={locked || busy} onChange={e => setForm({ ...form, consent: e.target.checked })} /> I control this empty database and authorize UG SaaS to connect, store ERP data and transfer existing trial records. I will keep external writes paused during transfer and maintain my Atlas access and backups.</label>
          <button className="primary" disabled={locked || busy || !form.consent || !status.encryptionConfigured}>{busy ? "Please wait..." : "Validate & save securely"}</button>
        </form>
        {candidate?.state === "VALIDATED_PENDING_MIGRATION" && <div>
          <p>Close other ERP screens before transferring. ERP will pause during the copy. Original records will be retained. Database setup does not extend your subscription; paid access still requires successful payment.</p>
          <button type="button" className="primary" disabled={busy || !status.eligible || !form.consent} onClick={transfer}>Transfer trial data & use my database</button>
        </div>}
      </>}
      {status.routing === "CUSTOMER" && <p>New ERP records use your database. If Atlas becomes unavailable, ERP pauses instead of saving records to a different database. Keep independent Atlas backups enabled.</p>}
    </> : <p>Loading database status...</p>}
  </article>;
}
