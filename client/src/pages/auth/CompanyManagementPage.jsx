import { useEffect, useState } from "react";
import "./company-management.css";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const departmentChoices=["STITCHING","INWARD","CHECKING","IRONING","PACKING","DISPATCH","WAREHOUSE","SHOP","MARKETING"];
const blank = {
  companyName: "",
  factoryName: "",
  factoryCode: "MAIN",
  address: "",
  subscriptionPlan: "Trial",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};
export default function CompanyManagementPage({ notify }) {
  const { user } = useAuth();
  const [form, setForm] = useState({...blank,enabledDepartments:[]});
  const [rows, setRows] = useState([]);
  const [plans,setPlans]=useState([]);
  const [created, setCreated] = useState(null);
  const [selected,setSelected]=useState(null);
  async function load() {
    try {
      setRows(await api("/companies"));if(user?.role==="saas_super_admin")setPlans(await api("/saas/plans"));
    } catch (error) {
      notify?.(error.message);
      setRows([]);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function submit(event) {
    event.preventDefault();
    try {
      const result = await api("/companies", { method: "POST", body: JSON.stringify(form) });
      setCreated(result);
      setForm({...blank,enabledDepartments:[]});
      await load();
      notify?.(result.activationEmailStatus==="ACCEPTED"?"Company created; activation email accepted by provider":"Company created; activation email failed. Use Resend activation after checking mail configuration.");
    } catch (error) {
      notify?.(error.message);
    }
  }
  async function resend(row){try{const result=await api(`/companies/${row._id}/resend-activation`,{method:"POST",body:"{}"});notify?.(result.message);await load();}catch(e){notify?.(e.message);}}
  async function configure(row){const value=window.prompt("Enabled departments, comma-separated: STITCHING,INWARD,CHECKING,IRONING,PACKING,DISPATCH,WAREHOUSE,SHOP,MARKETING",(row.enabledDepartments||[]).join(","));if(value===null)return;try{await api(`/companies/${row._id}/departments`,{method:"PATCH",body:JSON.stringify({enabledDepartments:value.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean)})});await load();notify?.("Departments updated; existing data retained");}catch(e){notify?.(e.message);}}
  async function control(row, action) {
    const label =
      action === "ARCHIVE"
        ? "archive this company"
        : "change subscription status";
    if (!window.confirm(`Confirm ${label}?`)) return;
    try {
      await api(`/companies/${row._id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ action, validityDays: 30 }),
      });
      await load();
      notify?.(`Company ${action.toLowerCase()} completed`);
    } catch (error) {
      notify?.(error.message);
    }
  }
  const fieldLabels = {
    companyName: "Company name",
    factoryName: "Factory name",
    factoryCode: "Factory code",
    address: "Address",
    subscriptionPlan: "Subscription plan",
    adminName: "Administrator name",
    adminEmail: "Administrator email",
    adminPassword: "Administrator password",
  };

  return (
    <div className="company-management-page">
      <PageTitle
        title="SaaS Companies"
        subtitle="Manage workspaces, factories, subscriptions and company administrators."
      />

      {user?.role === "saas_super_admin" && (
        <Card title="Department configuration">
          <div className="company-department-list">
            {rows.map((row) => (
              <div className="company-department-item" key={row._id}>
                <div className="company-department-copy">
                  <strong>{row.companyName}</strong>
                  <span>
                    {(row.enabledDepartments || []).length
                      ? (row.enabledDepartments || []).join(" · ")
                      : "No departments configured"}
                  </span>
                </div>
                <button type="button" className="company-button company-button-secondary" onClick={() => configure(row)}>
                  Configure
                </button>
              </div>
            ))}
            {!rows.length && <p className="company-muted">No companies available yet.</p>}
          </div>
        </Card>
      )}

      {user?.role === "saas_super_admin" && (
        <Card title="Create company">
          <div className="company-form-intro">
            <span className="company-section-mark">＋</span>
            <div>
              <strong>Set up a new workspace</strong>
              <p>Enter company details and create the first administrator account.</p>
            </div>
          </div>
          <form className="company-create-form" onSubmit={submit}>
            <div className="company-form-grid">
              {Object.keys(blank).map((key) => (
                <label className={`company-field ${key === "address" ? "company-field-wide" : ""}`} key={key}>
                  <span>{fieldLabels[key] || key}</span>
                  {key === "subscriptionPlan" ? (
                    <select
                      required
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    >
                      {plans.filter((plan) => plan.active).map((plan) => (
                        <option key={plan.name} value={plan.name}>{plan.name}</option>
                      ))}
                      {!plans.some((plan) => plan.active) && <option value="Trial">Trial</option>}
                    </select>
                  ) : (
                    <input
                      type={key === "adminEmail" ? "email" : key === "adminPassword" ? "password" : "text"}
                      autoComplete={key === "adminPassword" ? "new-password" : key === "adminEmail" ? "email" : "off"}
                      required={key !== "address"}
                      minLength={key === "adminPassword" ? 12 : undefined}
                      value={form[key]}
                      placeholder={key === "factoryCode" ? "MAIN" : key === "address" ? "Street, city, state" : `Enter ${fieldLabels[key]?.toLowerCase() || key}`}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>

            <fieldset className="company-departments-fieldset">
              <legend>Enabled departments</legend>
              <p className="company-field-hint">Choose the departments this workspace can access. Selection must fit the chosen plan.</p>
              <div className="company-department-options">
                {departmentChoices.map((department) => (
                  <label className={`company-department-option ${form.enabledDepartments.includes(department) ? "is-selected" : ""}`} key={department}>
                    <input
                      type="checkbox"
                      checked={form.enabledDepartments.includes(department)}
                      onChange={(e) => setForm({
                        ...form,
                        enabledDepartments: e.target.checked
                          ? [...form.enabledDepartments, department]
                          : form.enabledDepartments.filter((value) => value !== department),
                      })}
                    />
                    <span>{department}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="company-form-footer">
              <p><strong>Password requirement:</strong> 12+ characters with uppercase, lowercase, number and symbol.</p>
              <button type="submit" className="company-button company-button-primary">Create company <span aria-hidden="true">→</span></button>
            </div>
          </form>

          {created && (
            <div className="company-created-message" role="status">
              <div className="company-created-icon">✓</div>
              <div className="company-created-content">
                <strong>Workspace created successfully</strong>
                <p><span>Login URL</span> {window.location.origin}{created.company.loginPath}</p>
                <p><span>Admin user ID</span> {created.admin.userId}</p>
                <p><span>Activation email</span> {created.admin.email} · {created.activationEmailStatus === "ACCEPTED" ? "Accepted by provider" : "Failed — resend from the company list"}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {selected && (
        <Card title={`${selected.companyName} — department access`}>
          <div className="company-selected-details">
            <div><span>Admin user ID</span><strong>{selected.adminUserId || "Not available"}</strong></div>
            <div><span>Admin email</span><strong>{selected.adminEmail || "—"}</strong></div>
            <div><span>Subscription plan</span><strong>{selected.subscriptionPlan || "—"}</strong></div>
            <div><span>Activation email</span><strong>{selected.activationEmailStatus || "Not recorded"}</strong></div>
          </div>
          <div className="company-selected-departments">
            {(selected.enabledDepartments || []).map((department) => <span key={department}>{department}</span>)}
          </div>
          {!selected.enabledDepartments?.length && <p className="company-muted">Legacy department selection is not recorded. Configure departments within the plan limit.</p>}
          <button type="button" className="company-button company-button-secondary" onClick={() => setSelected(null)}>Close details</button>
        </Card>
      )}

      <Card title="Companies">
        <div className="company-table-heading">
          <p>Review each workspace and manage access or subscription status.</p>
          <span className="company-count-pill">{rows.length} {rows.length === 1 ? "company" : "companies"}</span>
        </div>
        <div className="company-table-container">
          <DataTable
            rows={rows}
            columns={[
              { key: "companyName", label: "Company", render: (row) => <button type="button" className="company-name-link" onClick={() => setSelected(row)}>{row.companyName}</button> },
              { key: "adminUserId", label: "Admin User ID" },
              { key: "adminEmail", label: "Admin email" },
              { key: "activationEmailStatus", label: "Activation mail", render: (row) => <span className={`company-status-pill ${row.activationEmailStatus === "ACCEPTED" ? "is-success" : "is-muted"}`}>{row.activationEmailStatus || "Not recorded"}</span> },
              { key: "subscriptionPlan", label: "Plan" },
              { key: "companyKey", label: "Company ID" },
              { key: "loginPath", label: "Unique login URL" },
              { key: "status", label: "Subscription", render: (row) => <span className={`company-status-pill ${String(row.status || "").toUpperCase() === "ACTIVE" ? "is-success" : "is-muted"}`}>{row.status || "Unknown"}</span> },
              { key: "dataOwner", label: "Data owner" },
              {
                key: "actions",
                label: "Owner actions",
                render: (row) => (
                  <div className="company-row-actions">
                    <button type="button" onClick={() => setSelected(row)}>Details</button>
                    <button type="button" onClick={() => resend(row)}>Resend email</button>
                    <button type="button" onClick={() => control(row, "ACTIVATE")}>Activate</button>
                    <button type="button" onClick={() => control(row, "PAUSE")}>Pause</button>
                    <button type="button" onClick={() => control(row, "REVOKE")}>Revoke</button>
                    <button type="button" className="is-danger" onClick={() => control(row, "ARCHIVE")}>Archive</button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
