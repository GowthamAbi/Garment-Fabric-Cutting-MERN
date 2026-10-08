import { useEffect, useState } from "react";
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
  return (
    <>
      {user?.role === "saas_super_admin" && <Card title="Department configuration">{rows.map(row=><p key={row._id}>{row.companyName} · {(row.enabledDepartments||[]).join(", ")} <button onClick={()=>configure(row)}>Configure departments</button></p>)}</Card>}
      <PageTitle
        title="SaaS Companies"
        subtitle="Secure company, factory, subscription and administrator setup"
      />
      {user?.role === "saas_super_admin" && (
        <Card title="Create Company">
          <form className="pending-form" onSubmit={submit}>
            {Object.keys(blank).map((key) => (
              <label key={key}>
                <span>{key}</span>
                {key === "subscriptionPlan" ? (
                  <select
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  >
                    {(plans.filter(p=>p.active).map(p=>p.name)).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      key === "adminEmail"
                        ? "email"
                        : key === "adminPassword"
                          ? "password"
                          : "text"
                    }
                    required={!["address"].includes(key)}
                    minLength={key === "adminPassword" ? 12 : undefined}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <fieldset><legend>Enabled departments (must fit selected plan)</legend>{departmentChoices.map(d=><label key={d}><input type="checkbox" checked={form.enabledDepartments.includes(d)} onChange={e=>setForm({...form,enabledDepartments:e.target.checked?[...form.enabledDepartments,d]:form.enabledDepartments.filter(v=>v!==d)})}/>{d}</label>)}</fieldset><button className="primary">Create Company</button>
            <small>Administrator password must contain 12+ characters, uppercase, lowercase, number and symbol.</small>
          </form>
          {created && (
            <div className="success-message">
              <b>Workspace created</b><br />
              URL: {window.location.origin}{created.company.loginPath}<br />
              Admin User ID: {created.admin.userId}<br />
              Activation email: {created.admin.email} · {created.activationEmailStatus === "ACCEPTED" ? "Accepted by provider" : "Failed — resend from company list"}
            </div>
          )}
        </Card>
      )}
      {selected&&<Card title={selected.companyName+" — department access"}><p>Admin User ID: <b>{selected.adminUserId||"Not available"}</b><br/>Admin email: {selected.adminEmail}<br/>Plan: {selected.subscriptionPlan}<br/>Activation mail: {selected.activationEmailStatus||"Not recorded"}</p><ul>{(selected.enabledDepartments||[]).map(d=><li key={d}>{d}</li>)}</ul>{!selected.enabledDepartments?.length&&<p>Legacy department selection not recorded. Configure departments within the plan limit.</p>}<button onClick={()=>setSelected(null)}>Close</button></Card>}
      <Card title="Companies">
        <DataTable
          rows={rows}
          columns={[
            { key: "companyName", label: "Company",render:row=><button onClick={()=>setSelected(row)}>{row.companyName}</button> },
            {key:"adminUserId",label:"Admin User ID"},
            {key:"adminEmail",label:"Admin email"},
            {key:"activationEmailStatus",label:"Activation mail"},
            { key: "subscriptionPlan", label: "Plan" },
            { key: "companyKey", label: "Company ID" },
            { key: "loginPath", label: "Unique Login URL" },
            { key: "status", label: "Subscription" },
            { key: "dataOwner", label: "Data Owner" },
            {
              key: "actions",
              label: "Owner Actions",
              render: (row) => (
                <div className="row-actions">
                  <button onClick={()=>setSelected(row)}>Departments</button>
                  <button onClick={()=>resend(row)}>Resend activation</button>
                  <button onClick={() => control(row, "ACTIVATE")}>
                    Activate
                  </button>
                  <button onClick={() => control(row, "PAUSE")}>Pause</button>
                  <button onClick={() => control(row, "REVOKE")}>Revoke</button>
                  <button
                    className="danger"
                    onClick={() => control(row, "ARCHIVE")}
                  >
                    Archive
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
