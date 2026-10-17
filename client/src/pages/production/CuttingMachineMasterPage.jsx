import {useEffect,useMemo,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {useAuth} from "../../context/AuthContext.jsx";
import {exportCsv} from "../../api.js";
import {getCuttingMachines,saveCuttingMachine} from "../../api/productionApi.js";

const empty={machineType:"Spreader",machineCode:"",machineName:"",capacityPerHour:0,active:true};
export default function CuttingMachineMasterPage({notify}){
  const {user}=useAuth();
  const readonly=user?.role==="department_incharge";
  const [rows,setRows]=useState([]);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState("");
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState("");
  async function load(){
    try{setRows(await getCuttingMachines());}
    catch(e){notify?.(e.message);}
  }
  useEffect(()=>{load();},[]);
  const shown=useMemo(()=>rows.filter(r=>`${r.machineCode} ${r.machineName} ${r.machineType} ${r.status}`.toLowerCase().includes(search.toLowerCase())),[rows,search]);
  async function submit(event){
    event.preventDefault();
    if(readonly)return;
    setSaving(true);
    try{
      await saveCuttingMachine(form,editing);
      notify?.("Cutting machine saved");
      setForm(empty);setEditing("");await load();
    }catch(e){notify?.(e.message);}
    finally{setSaving(false);}
  }
  return <section className="classic-page">
    <header className="classic-title"><div>
      <small>CUTTING DEPARTMENT</small><h2>Machine Master – Spreader & Cutter</h2>
      <p>Register cutting machines and maintain capacity. Machine running/breakdown state is maintained through machine assignments.</p>
    </div><div className="page-actions">
      <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
      <button type="button" onClick={()=>exportCsv("cutting-machines.csv",shown)} disabled={!shown.length}><Download size={16}/> Excel</button>
      <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    </div></header>
    {!readonly&&<form className="classic-card" onSubmit={submit}>
      <h3>{editing?"Update Machine":"New Cutting Machine"}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:12}}>
        <label>Machine Type
          <select value={form.machineType} onChange={e=>setForm({...form,machineType:e.target.value})}>
            <option value="Spreader">Spreader</option><option value="Cutter">Cutter</option>
          </select>
        </label>
        <label>Machine Code
          <input required maxLength={35} value={form.machineCode} readOnly={Boolean(editing)}
            onChange={e=>setForm({...form,machineCode:e.target.value.toUpperCase()})} placeholder="SPR-01"/>
        </label>
        <label>Machine Name
          <input required maxLength={120} value={form.machineName}
            onChange={e=>setForm({...form,machineName:e.target.value})} placeholder="Spreader Line 01"/>
        </label>
        <label>Capacity / Hour
          <input type="number" min="0" max="100000" step="any" value={form.capacityPerHour}
            onChange={e=>setForm({...form,capacityPerHour:e.target.value})}/>
        </label>
      </div>
      <div className="page-actions">
        <button type="submit" disabled={saving}><Save size={16}/> {saving?"Saving…":"Save Machine"}</button>
        {editing&&<button type="button" onClick={()=>{setEditing("");setForm(empty);}}>Cancel Edit</button>}
      </div>
    </form>}
    <div className="classic-card">
      <label>Search Machines <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Code, machine name, status"/></label>
      <div style={{overflowX:"auto"}}>
        <table className="classic-table" style={{minWidth:690,width:"100%"}}>
          <thead><tr><th>Machine Code</th><th>Type</th><th>Name</th><th>Capacity / Hour</th><th>Status</th><th>Active</th>{!readonly&&<th>Action</th>}</tr></thead>
          <tbody>{shown.map(m=><tr key={m._id}>
            <td><strong>{m.machineCode}</strong></td><td>{m.machineType}</td><td>{m.machineName}</td>
            <td>{m.capacityPerHour}</td><td>{m.status}</td><td>{m.active===false?"Inactive":"Active"}</td>
            {!readonly&&<td><button type="button" onClick={()=>{setEditing(m._id);setForm({machineType:m.machineType,machineCode:m.machineCode,machineName:m.machineName,capacityPerHour:m.capacityPerHour||0,active:m.active!==false});}}>Edit</button></td>}
          </tr>)}</tbody>
        </table>
      </div>
      {!shown.length&&<p>No registered Cutting machines. Create Spreader or Cutter machine above.</p>}
    </div>
  </section>;
}
