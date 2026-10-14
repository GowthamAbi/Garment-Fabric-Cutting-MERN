import {useState} from "react";
import {getDepartmentSidebar,PROPOSED_DEPARTMENTS,isDepartmentWorkspaceReady} from "../../config/departmentRoleSidebars.js";
import {useAuth} from "../../context/AuthContext.jsx";

// Administrator-only planning preview. Not a permission editor or live work screen.
export default function DepartmentRolePreview(){
 const {user}=useAuth();
 const [department,setDepartment]=useState("FABRIC");
 const [role,setRole]=useState("HEAD");
 if(!["company_owner","company_admin","admin"].includes(user?.role))return <p role="alert">Not authorized.</p>;
 const ready=isDepartmentWorkspaceReady(department);
 const items=getDepartmentSidebar(department,role,{experimentalDepartments:true});
 return <section className="department-role-preview" style={{maxWidth:850,margin:"0 auto",padding:"1rem"}}>
  <h2>Department Sidebar Planning</h2>
  <p>This is a design preview only. Menus here do not grant access or perform transactions.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
   <label>Department <select value={department} onChange={e=>setDepartment(e.target.value)}>{PROPOSED_DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
   <label>Role <select value={role} onChange={e=>setRole(e.target.value)}><option value="HEAD">Department Head</option><option value="STAFF">Inventory / Staff</option></select></label>
  </div>
  {!ready&&<p role="status">This department is proposed only. Subscription licensing, screens and server authorization are not yet available.</p>}
  <ol>{items.map(item=><li key={item.id} style={{padding:"0.4rem"}}><strong>{item.label}</strong> <small>({item.action}; server authorization required)</small></li>)}</ol>
  <p><strong>Existing workflow protection:</strong> Fabric, Cutting, Accessories, Elastic and Delivery entry menus remain unchanged.</p>
 </section>;
}
