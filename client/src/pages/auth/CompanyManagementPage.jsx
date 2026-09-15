import { useEffect, useState } from "react";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

const blank = { companyName: "", factoryName: "", factoryCode: "MAIN", address: "", subscriptionPlan: "Trial", adminName: "", adminEmail: "", adminPassword: "" };
export default function CompanyManagementPage({ notify }) {
  const [form, setForm] = useState(blank);
  const [rows, setRows] = useState([]);
  async function load() { setRows(await api("/companies")); }
  useEffect(() => { load(); }, []);
  async function submit(event) { event.preventDefault(); await api("/companies", { method: "POST", body: JSON.stringify(form) }); setForm(blank); await load(); notify("Company and administrator created"); }
  return <><PageTitle title="SaaS Companies" subtitle="Secure company, factory, subscription and administrator setup" />
    <Card title="Create Company"><form className="pending-form" onSubmit={submit}>{Object.keys(blank).map((key) => <label key={key}><span>{key}</span>{key === "subscriptionPlan" ? <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>{["Trial", "Basic", "Professional", "Enterprise"].map((v) => <option key={v}>{v}</option>)}</select> : <input type={key === "adminEmail" ? "email" : key === "adminPassword" ? "password" : "text"} required={!['address'].includes(key)} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}</label>)}<button className="primary">Create Company</button></form></Card>
    <Card title="Companies"><DataTable rows={rows} columns={[{ key: "companyName", label: "Company" }, { key: "subscriptionPlan", label: "Plan" }, { key: "subscriptionStatus", label: "Subscription" }, { key: "factories", label: "Factories", render: (row) => row.factories?.map((f) => f.name).join(", ") }, { key: "active", label: "Active", render: (row) => row.active ? "Yes" : "No" }]} /></Card></>;
}
