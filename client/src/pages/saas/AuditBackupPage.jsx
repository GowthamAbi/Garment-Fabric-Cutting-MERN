import { useEffect, useState } from "react";
import { api } from "../../api.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import { tokenService } from "../../services/tokenService.js";

export default function AuditBackupPage({ notify }) {
  const today = new Date().toISOString().slice(0,10); const monthAgo = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const [range,setRange]=useState({from:monthAgo,to:today}); const [rows,setRows]=useState([]);
  const load=async()=>setRows(await api(`/saas/audit?${new URLSearchParams(range)}`)); useEffect(()=>{load();},[]);
  async function backup(){const base=(import.meta.env.VITE_API_URL||"http://localhost:5000/api").replace(/\/$/,"");const response=await fetch(`${base}/saas/backup`,{headers:{Authorization:`Bearer ${tokenService.getToken()}`}});if(!response.ok)throw new Error("Backup failed");const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`accessories-flow-backup-${today}.json`;link.click();URL.revokeObjectURL(url);notify("Encrypted-location backup downloaded; keep it private");}
  return <><PageTitle title="Audit & Backup" subtitle="Who changed what, when, and downloadable company backup"/><Card><div className="audit-toolbar"><label>From<input type="date" value={range.from} onChange={(e)=>setRange({...range,from:e.target.value})}/></label><label>To<input type="date" value={range.to} onChange={(e)=>setRange({...range,to:e.target.value})}/></label><button onClick={load}>Apply Date Range</button><button className="primary" onClick={backup}>Download Company Backup</button></div></Card><Card title="Audit History"><DataTable rows={rows} columns={[{key:"createdAt",label:"Date",render:(row)=>new Date(row.createdAt).toLocaleString()},{key:"actorName",label:"User"},{key:"actorRole",label:"Role"},{key:"method",label:"Action"},{key:"path",label:"API / Record"},{key:"statusCode",label:"Result"},{key:"ip",label:"IP"}]}/></Card></>;
}
