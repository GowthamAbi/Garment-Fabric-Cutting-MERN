import { useEffect, useState } from "react";
import { changePendingStatus, deletePendingIssue, getPendingIssues, savePendingIssue } from "../../api/productionApi.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import { downloadExcel } from "../../services/csvService.js";

const blank = { outwardNo: "", section: "", itemCode: "", itemName: "", colour: "", size: "", requiredPcs: 0, requiredMtr: 0, availableMtr: 0, issueType: "Material Shortage", reason: "", priority: "Medium", neededDate: "", expectedMaterialDate: "", rejectedMtr: 0, affectedPcs: 0, remarks: "" };

export default function PendingPage({ notify }) {
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState("");
  async function load() { setIssues(await getPendingIssues()); }
  useEffect(() => { load(); }, []);
  async function submit(event) { event.preventDefault(); await savePendingIssue(form, editingId); setForm(blank); setEditingId(""); await load(); notify("Pending colour saved"); }
  function edit(issue) { setEditingId(issue._id); setForm({ ...blank, ...issue, neededDate: issue.neededDate?.slice(0,10) || "" }); window.scrollTo({top:0,behavior:"smooth"}); }
  async function status(id, value) { await changePendingStatus(id, value); await load(); notify(`Issue changed to ${value}`); }
  async function remove(id) { await deletePendingIssue(id); await load(); notify("Received material request deleted"); }
  const columns = [
    {key:"issueNo",label:"Pending No."},{key:"section",label:"Section"},{key:"colour",label:"Colour"},{key:"size",label:"Size"},
    {key:"requiredPcs",label:"Required Pcs"},{key:"shortageMtr",label:"Shortage Mtr"},{key:"issueType",label:"Issue"},{key:"reason",label:"Reason"},{key:"priority",label:"Priority"},{key:"status",label:"Status"},
    {key:"material",label:"Material",render:(issue)=><b className={issue.status === "Material Received" ? "status-green" : "status-red"}>{issue.status === "Material Received" ? "INWARD RECEIVED" : "NO INWARD"}</b>},
    {key:"actions",label:"Actions",render:(issue)=><div className="row-actions"><button onClick={()=>edit(issue)}>Edit</button><button onClick={()=>status(issue._id,"Requested")}>Request Material</button><button onClick={()=>status(issue._id,"Reopened")}>Reopen</button><button className="primary" onClick={()=>status(issue._id,"Resolved")}>Resolve</button>{issue.status === "Material Received" && <button className="danger" onClick={()=>remove(issue._id)}>Delete</button>}</div>},
  ];
  return <><PageTitle title="Section Pending & Issues" subtitle="Colour shortage, rejection, production and sewing hold" />
    <Card title={editingId ? "Edit Pending Colour" : "Add Pending Colour Manually"}><form className="pending-form" onSubmit={submit}>{Object.keys(blank).map((key) => <label key={key}><span>{key}</span>{key === "issueType" ? <select value={form[key]} onChange={(event)=>setForm({...form,[key]:event.target.value})}>{["Material Shortage","Colour Pending","Elastic Rejected","Production Hold","Rework Pending","Machine Breakdown","Sewing Hold","Delivery Pending","Overdue Requirement","Other"].map(value=><option key={value}>{value}</option>)}</select> : key === "priority" ? <select value={form[key]} onChange={(event)=>setForm({...form,[key]:event.target.value})}>{["Low","Medium","High","Critical"].map(value=><option key={value}>{value}</option>)}</select> : <input required={["section","colour","reason"].includes(key)} type={["neededDate","expectedMaterialDate"].includes(key) ? "date" : ["requiredPcs","requiredMtr","availableMtr","rejectedMtr","affectedPcs"].includes(key) ? "number" : "text"} value={form[key] ?? ""} onChange={(event)=>setForm({...form,[key]:event.target.value})}/>}</label>)}<button className="primary">{editingId ? "Update Pending" : "Add Pending"}</button></form></Card>
    <Card title="Wanted Elastic / Pending"><div className="row-actions report-download"><button onClick={()=>downloadExcel("wanted-elastic.xls",issues)}>Download Excel</button></div><DataTable rows={issues} columns={columns}/></Card></>;
}
