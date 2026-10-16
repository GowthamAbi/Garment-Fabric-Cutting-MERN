import {useEffect,useMemo,useState} from "react";
import {api} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {DEPARTMENT_CATALOGUE,departmentCode} from "../../../../shared/departmentCatalogue.js";
import {ClipboardList,RefreshCw,CheckCircle2,Clock3,UserRound} from "lucide-react";

const base="/erp/departments/tasks";
const initial={title:"",notes:"",reference:"",priority:"NORMAL",dueAt:"",assigneeId:""};
const dateLabel=value=>value?new Date(value).toLocaleDateString("en-IN"):"—";
const assigneeLabel=user=>user?.name+" ("+user?.userId+")";
export default function DepartmentTasksPage(){
 const {user}=useAuth();
 const deptUser=["department_incharge","department_entry"].includes(user?.role);
 const mayManage=["company_owner","company_admin","admin","management"].includes(user?.role);
 const [department,setDepartment]=useState(deptUser?departmentCode(user?.department):"FABRIC");
 const [items,setItems]=useState([]);
 const [assignees,setAssignees]=useState([]);
 const [form,setForm]=useState(initial);
 const [filter,setFilter]=useState("ALL");
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const departmentCodeValue=deptUser?departmentCode(user?.department):department;
 const isStaff=user?.role==="department_entry";
 const isHead=user?.role==="department_incharge";
 const canAccess=mayManage||isStaff||isHead;
 async function reload(){
  if(!canAccess)return;
  setLoading(true);setError("");
  try{
   const query="?department="+encodeURIComponent(departmentCodeValue);
   const [tasks,people]=await Promise.all([
    api(base+query),
    mayManage?api(base+"/assignees"+query):Promise.resolve({items:[]})
   ]);
   setItems(tasks.items||[]);
   setAssignees(people.items||[]);
  }catch(e){setItems([]);setAssignees([]);setError(e.message||"Unable to fetch tasks")}
  finally{setLoading(false)}
 }
 useEffect(()=>{setForm(initial);setItems([]);setMessage("");reload()},[departmentCodeValue,user?.role]);
 const visible=useMemo(()=>filter==="ALL"?items:items.filter(x=>x.status===filter),[items,filter]);
 const counts=useMemo(()=>({pending:items.filter(t=>t.status==="PENDING").length,progress:items.filter(t=>t.status==="IN_PROGRESS").length,done:items.filter(t=>t.status==="DONE").length}),[items]);
 async function createTask(event){
  event.preventDefault();setSaving(true);setError("");setMessage("");
  try{
   await api(base,{method:"POST",body:JSON.stringify({...form,department:departmentCodeValue,dueAt:form.dueAt||null})});
   setForm(initial);await reload();setMessage("Task assigned successfully");
  }catch(e){setError(e.message||"Task assignment failed")}
  finally{setSaving(false)}
 }
 async function changeStatus(item,status){
  setSaving(true);setMessage("");setError("");
  try{
   await api(base+"/"+encodeURIComponent(item._id)+"/status",{method:"PATCH",body:JSON.stringify({status})});
   await reload();setMessage("Status updated successfully");
  }catch(e){setError(e.message||"Status update failed")}
  finally{setSaving(false)}
 }
 if(!canAccess)return <p role="alert">Department task access is restricted to company managers and assigned department users.</p>;
 return <section className="department-tasks-page">
  <header className="department-task-header">
   <div><small>UG SAAS · ASSIGNED WORK</small><h2>{departmentCodeValue} — Tasks & Follow-ups</h2>
    <p>{isStaff?"Only your assigned tasks are shown.":isHead?"Review progress for your assigned department.":"Assign tasks to an active Department Staff member with entry permission."}</p>
   </div>
   <button type="button" onClick={reload} disabled={loading}><RefreshCw size={17}/> Refresh</button>
  </header>
  {mayManage&&<label className="erp-field department-task-filter">Department
   <select value={department} onChange={e=>setDepartment(e.target.value)}>
    {DEPARTMENT_CATALOGUE.map(d=><option key={d.code} value={d.code}>{d.label}</option>)}
   </select>
  </label>}
  <div className="department-task-cards" aria-label="Task counts">
   <article className="erp-card"><Clock3 aria-hidden="true"/><span>Pending</span><strong>{counts.pending}</strong></article>
   <article className="erp-card"><ClipboardList aria-hidden="true"/><span>In progress</span><strong>{counts.progress}</strong></article>
   <article className="erp-card"><CheckCircle2 aria-hidden="true"/><span>Completed</span><strong>{counts.done}</strong></article>
  </div>
  {error&&<p role="alert" className="erp-error">{error}</p>}
  {message&&<p role="status" className="erp-success">{message}</p>}
  {mayManage&&<form className="erp-card department-task-form" onSubmit={createTask}>
   <h3>Assign new task</h3>
   <div className="department-task-form-grid">
    <label>Task title <input required maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Verify today's plan"/></label>
    <label>Assign to staff <select required value={form.assigneeId} onChange={e=>setForm({...form,assigneeId:e.target.value})}>
      <option value="">Select active staff…</option>{assignees.map(u=><option key={u.id} value={u.id}>{assigneeLabel(u)}</option>)}
     </select></label>
    <label>Priority <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
      <option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
     </select></label>
    <label>Due date <input type="date" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/></label>
    <label>Plan / DC / Reference <input maxLength={100} value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></label>
    <label className="department-task-wide">Instructions <textarea maxLength={1000} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   </div>
   {!assignees.length&&<p>No active staff with entry permission in this department.</p>}
   <button type="submit" disabled={saving||!assignees.length}>{saving?"Saving…":"Assign Task"}</button>
  </form>}
  <section className="erp-card">
   <div className="department-task-header">
    <h3>Department task register</h3>
    <label>Show <select value={filter} onChange={e=>setFilter(e.target.value)}>
      <option value="ALL">All</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Completed</option>
     </select></label>
   </div>
   <div className="erp-table department-task-table"><table>
    <thead><tr><th>Created</th><th>Task / Reference</th><th>Assigned staff</th><th>Priority</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>{visible.map(task=><tr key={task._id}>
      <td>{dateLabel(task.createdAt)}</td>
      <td><strong>{task.title}</strong>{task.reference&&<div>{task.reference}</div>}{task.notes&&<small>{task.notes}</small>}</td>
      <td><UserRound size={13} aria-hidden="true"/> {task.assigneeName}</td>
      <td>{task.priority}</td><td>{dateLabel(task.dueAt)}</td><td>{task.status.replaceAll("_"," ")}</td>
      <td>{isStaff&&task.status!=="DONE"?
       <button type="button" disabled={saving} onClick={()=>changeStatus(task,task.status==="PENDING"?"IN_PROGRESS":"DONE")}>{task.status==="PENDING"?"Start":"Complete"}</button>
       :<span>—</span>}</td>
    </tr>)}</tbody>
   </table></div>
   {loading&&<p role="status">Refreshing tasks…</p>}
   {!loading&&!visible.length&&<p>No tasks for this filter.</p>}
   <small>Task status is tracked separately from production quantities. Completing a task does not modify stock, approvals, payroll or invoice balances.</small>
  </section>
 </section>;
}
