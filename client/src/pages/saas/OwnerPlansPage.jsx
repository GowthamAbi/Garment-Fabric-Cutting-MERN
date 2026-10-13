import {DEPARTMENTS,DEPARTMENT_CATALOGUE,ERP_MODULES,departmentCode} from '../../../../shared/departmentCatalogue.js';
import { useEffect, useState } from "react";
import { Check, Plus, Save } from "lucide-react";
import { api } from "../../api.js";
import PageTitle from "../../components/common/PageTitle.jsx";

const blank = {
  code: "",
  name: "",
  description: "",
  price: 0,
  pricingModel:"FIXED",perUserPrice:0,perDepartmentPrice:0,
  cost: 0,
  setupFee: 0,
  taxPercent: 0,
  validityDays: 30,
  maxUsers: 5,
  maxDepartments: 3,
  modules: ["FABRIC", "CUTTING", "ERP_CORE"],
  active: true,
  featured: false,
  sortOrder: 10,
};
export default function OwnerPlansPage({ notify }) {
  const [plans, setPlans] = useState([]),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(blank);
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const load = () => {setLoading(true);setLoadError("");return api("/saas/plans")
      .then(setPlans)
      .catch((e) => {setLoadError(e.message);notify?.(e.message);}).finally(()=>setLoading(false));};
  useEffect(() => {
    load();
  }, []);
  const field = (key, value) => setForm({ ...form, [key]: value });
  async function save(e) {
    e.preventDefault();
    try {
      await api(editing ? `/saas/plans/${editing}` : "/saas/plans", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setEditing(null);
      setForm(blank);
      await load();
      notify?.("Plan saved");
    } catch (x) {
      notify?.(x.message);
    }
  }
  function edit(p) {
    setEditing(p._id);
    setForm({ ...p, modules: (p.modules || []).map(departmentCode) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <section className="classic-page">
      {loading&&<p role="status">Loading plans…</p>}
      {loadError&&<p role="alert">{loadError} <button onClick={load}>Retry</button></p>}
      <PageTitle
        title="Plans & Pricing"
        subtitle="Set price, validity, user limits and modules. GST 0 creates a no-tax plan. Capacity limits and licensed coverage are separate. Select the specific departments below; existing plans are not automatically expanded."
      />
      <form className="classic-card saas-plan-form" onSubmit={save}>
        <div className="table-toolbar">
          <h3>{editing ? "Edit Plan" : "Create Plan"}</h3>
          <button type="button" onClick={()=>{const existing=plans.find(p=>p.code==="OWN_PLAN");setEditing(existing?._id||null);setForm({...blank,...existing,code:"OWN_PLAN",name:"Own Plan",pricingModel:"PER_DEPARTMENT",maxDepartments:14,modules:[...DEPARTMENTS,"ERP_CORE"]});}}>Configure Own Plan</button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(blank);
              }}
            >
              Cancel
            </button>
          )}
        </div>
        <div className="saas-form-grid"><label><span>Pricing model</span><select value={form.pricingModel||"FIXED"} onChange={e=>field("pricingModel",e.target.value)}>{["FIXED","PER_USER","PER_DEPARTMENT","COMBINED"].map(m=><option key={m}>{m}</option>)}</select></label>
          {[
            ["code", "Plan Code"],
            ["name", "Plan Name"],
            ["price", "Price ₹", "number"],
            ["perUserPrice", "Per user ₹", "number"],
            ["perDepartmentPrice", "Per department ₹", "number"],
            ["cost", "Internal Cost ₹", "number"],
            ["setupFee", "Setup Fee ₹", "number"],
            ["taxPercent", "GST % (0 = without GST)", "number"],
            ["validityDays", "Validity Days", "number"],
            ["maxUsers", "Maximum Users", "number"],
            ["maxDepartments", "Maximum Departments", "number"],
            ["sortOrder", "Display Order", "number"],
          ].map(([k, l, t]) => (
            <label key={k}>
              <span>{l}</span>
              <input
                required={!["setupFee", "price", "cost"].includes(k)}
                type={t || "text"}
                value={form[k]}
                onChange={(e) =>
                  field(
                    k,
                    t === "number" ? Number(e.target.value) : e.target.value,
                  )
                }
              />
            </label>
          ))}
          <label className="wide">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
            />
          </label>
          <fieldset className="wide"><legend>Licensed departments and ERP features</legend>{[...DEPARTMENT_CATALOGUE,...ERP_MODULES.map(code=>({code,label:code}))].map(({code,label})=><label className="check" key={code}><input type="checkbox" checked={(form.modules||[]).includes(code)} onChange={e=>{const modules=e.target.checked?[...form.modules,code]:form.modules.filter(m=>m!==code);setForm({...form,modules,maxDepartments:Math.max(1,modules.filter(m=>DEPARTMENTS.includes(m)).length)});}}/>{label}</label>)}</fieldset>
          <label className="check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => field("active", e.target.checked)}
            />
            Active
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => field("featured", e.target.checked)}
            />
            Recommended
          </label>
        </div>
        <button className="primary">
          <Save /> Save Plan
        </button>
      </form>
      <div className="saas-plan-grid">
        {plans.map((p) => (
          <article key={p._id} className={p.featured ? "featured" : ""}>
            <header>
              <div>
                <small>{p.code}</small>
                <h3>{p.name}</h3>
              </div>
              {p.featured && <b>RECOMMENDED</b>}
            </header>
            <strong>₹{Number(p.price).toLocaleString("en-IN")}</strong>
            <span>
              + ₹{p.setupFee || 0} setup · {p.taxPercent}% tax
            </span>
            <p>{p.description}</p>
            <ul>
              <li>
                <Check /> {p.validityDays} days
              </li>
              <li>
                <Check /> {p.maxUsers} users
              </li>
              <li>
                <Check /> {p.maxDepartments} departments
              </li>
              {(p.modules || []).map((x) => (
                <li key={x}>
                  <Check /> {x}
                </li>
              ))}
            </ul>
            <footer>
              <span className={p.active ? "status-green" : "status-red"}>
                {p.active ? "Active" : "Inactive"}
              </span>
              <button onClick={() => edit(p)}>Edit</button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
