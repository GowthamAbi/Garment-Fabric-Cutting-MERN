import { useEffect, useState } from "react";
import { getEmployees, getMachines, saveEmployee, saveMachine } from "../../api/productionApi.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import { downloadMasterQrPdf, printMasterQrPdf } from "../../services/printService.js";

const emptyMachine = { machineCode: "", machineName: "", machineType: "Elastic", section: "Elastic Production", capacityPerHour: 0, maintenanceStatus: "Good" };
const emptyEmployee = { employeeCode: "", employeeName: "", department: "Production", section: "Elastic Production", skill: "", shift: "General" };

export default function ProductionSetupPage({ notify, mode = "both" }) {
  const [machines, setMachines] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [machine, setMachine] = useState(emptyMachine);
  const [employee, setEmployee] = useState(emptyEmployee);
  async function load() { const [machineData, employeeData] = await Promise.all([getMachines(), getEmployees()]); setMachines(machineData); setEmployees(employeeData); }
  useEffect(() => { load(); }, []);
  async function submitMachine(event) { event.preventDefault(); await saveMachine(machine); setMachine(emptyMachine); await load(); notify("Machine saved and QR code ready"); }
  async function submitEmployee(event) { event.preventDefault(); await saveEmployee(employee); setEmployee(emptyEmployee); await load(); notify("Employee saved and QR code ready"); }
  return <>
    <PageTitle title={mode === "machine" ? "Machine Register" : mode === "employee" ? "Employee Register" : "Production Setup"} subtitle={mode === "machine" ? "Register machines and print their QR cards" : mode === "employee" ? "Register employees and print their QR cards" : "Machine and employee QR masters"} />
    <div className="production-two-column">
      {mode !== "employee" && <Card title="Add Machine"><form className="compact-form" onSubmit={submitMachine}>{Object.keys(emptyMachine).map((key) => <label key={key}><span>{key}</span><input required={["machineCode", "machineName"].includes(key)} type={key === "capacityPerHour" ? "number" : "text"} value={machine[key]} onChange={(event) => setMachine({ ...machine, [key]: event.target.value })} /></label>)}<button className="primary">Save Machine</button></form></Card>}
      {mode !== "machine" && <Card title="Add Employee"><form className="compact-form" onSubmit={submitEmployee}>{Object.keys(emptyEmployee).map((key) => <label key={key}><span>{key}</span><input required={["employeeCode", "employeeName"].includes(key)} value={employee[key]} onChange={(event) => setEmployee({ ...employee, [key]: event.target.value })} /></label>)}<button className="primary">Save Employee</button></form></Card>}
    </div>
    {mode !== "employee" && <Card title="Machines"><DataTable rows={machines} columns={[{key:"machineQr",label:"Machine QR",render:(row)=><QRGenerator size={72} value={`${window.location.origin}/production?machineCode=${encodeURIComponent(row.machineCode)}`}/>},{key:"machineCode",label:"Code"},{key:"machineName",label:"Machine"},{key:"status",label:"Status"},{key:"actions",label:"QR Card",render:(row)=><div className="table-actions"><button type="button" onClick={()=>printMasterQrPdf("machine",row)}>Print</button><button type="button" className="primary" onClick={()=>downloadMasterQrPdf("machine",row)}>Download</button></div>}]} /></Card>}
    {mode !== "machine" && <Card title="Employees"><DataTable rows={employees} columns={[{key:"employeeQr",label:"Employee QR",render:(row)=><QRGenerator size={72} value={`${window.location.origin}/production?employeeCode=${encodeURIComponent(row.employeeCode)}`}/>},{key:"employeeCode",label:"Employee No."},{key:"employeeName",label:"Employee Name"},{key:"section",label:"Section"},{key:"shift",label:"Shift"},{key:"actions",label:"QR Card",render:(row)=><div className="table-actions"><button type="button" onClick={()=>printMasterQrPdf("employee",row)}>Print</button><button type="button" className="primary" onClick={()=>downloadMasterQrPdf("employee",row)}>Download</button></div>}]} /></Card>}
  </>;
}
