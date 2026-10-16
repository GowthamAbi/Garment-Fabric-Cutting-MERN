import {useState} from "react";
import {getDepartmentSidebar,PROPOSED_DEPARTMENTS,isDepartmentWorkspaceReady} from "../../config/departmentRoleSidebars.js";
import {requirementsForRole,EXCEL_REQUIREMENT_COUNT} from "../../../../shared/excelRequirementCatalogue.js";
import {useAuth} from "../../context/AuthContext.jsx";

// Administrator-only workbook traceability; does not simulate missing ERP functions.
export default function DepartmentRolePreview(){
 const {user}=useAuth();
 const [department,setDepartment]=useState("FABRIC");
 const [role,setRole]=useState("HEAD");
 if(!["company_owner","company_admin","admin"].includes(user?.role))return <p role="alert">Not authorized.</p>;
 const adminMode=role==="COMPANY_ADMIN"||role==="FACTORY_MANAGER";
 const ready=adminMode||isDepartmentWorkspaceReady(department);
 const items=adminMode?requirementsForRole(role==="COMPANY_ADMIN"?"Company Admin":"Factory Manager"):
   getDepartmentSidebar(department,role,{experimentalDepartments:true});
 return <section className="department-role-preview" style={{maxWidth:1100,margin:"0 auto",padding:"1rem"}}>
  <h2>Excel Requirement Coverage — {EXCEL_REQUIREMENT_COUNT} Options</h2>
  <p>This screen tracks requested options from Book1.xlsx. An option being listed does <strong>not</strong> mean that its screen, API, permissions, print, save or data workflow is complete.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
   <label>Role
    <select value={role} onChange={event=>setRole(event.target.value)}>
     <option value="COMPANY_ADMIN">Company Admin — 58 options</option>
     <option value="FACTORY_MANAGER">Factory Manager — 74 options</option>
     <option value="HEAD">Department Head</option>
     <option value="STAFF">Department Staff</option>
    </select>
   </label>
   {!adminMode&&<label>Department
    <select value={department} onChange={event=>setDepartment(event.target.value)}>
     {PROPOSED_DEPARTMENTS.map(code=><option key={code} value={code}>{code}</option>)}
    </select>
   </label>}
  </div>
  {!ready&&<p role="status">This department is not licensed. Server authorization, operational screens, and the full ERP workflow have not been implemented.</p>}
  <p role="status"><strong>{items.length} requested options.</strong> All are awaiting evidence-based screen/API and end-to-end acceptance checks.</p>
  <div className="table-wrap" style={{overflowX:"auto"}}>
   <table><thead><tr><th>Excel Cell</th><th>Requested Option</th><th>Review Status</th></tr></thead>
    <tbody>{items.map(item=><tr key={item.id}>
     <td>{item.excelSourceCell||item.id}</td>
     <td>{item.label}</td>
     <td>Unverified — acceptance pending</td>
    </tr>)}</tbody>
   </table>
  </div>
  <p>Existing Fabric, Cutting, Accessories, Elastic and Delivery workflows remain separate. Owner approval is required before merging new modules into production.</p>
 </section>;
}
