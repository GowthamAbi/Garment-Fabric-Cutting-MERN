import { useEffect, useState } from "react";
import { getJobs, getProductionDc, getWarehouse, resumeProductionJob, startProductionJob, stopProductionJob } from "../../api/productionApi.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import QRScanInput from "../../components/qr/QRScanInput.jsx";
import WarehousePage from "./WarehousePage.jsx";

const blankStart = { dcNo: "", outwardNo: "", inwardNo: "", machineCode: "", employeeCode: "", section: "Elastic Production", colour: "", size: "", plannedPcs: "" };
const DRAFT_KEY = "elastic_production_scan_draft";

function initialScanForm() {
  const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") || blankStart;
  const params = new URLSearchParams(window.location.search);
  return {
    ...blankStart,
    ...saved,
    ...Object.fromEntries(["dcNo", "outwardNo", "inwardNo", "machineCode", "employeeCode", "colour", "size"].filter((key) => params.get(key)).map((key) => [key, params.get(key)])),
  };
}
const blankStop = { action: "Complete", okPcs: "", reworkPcs: "", rejectionPcs: "", reason: "", remarks: "", sizeResults: [] };

export default function ProductionControlPage({ notify }) {
  const [jobs, setJobs] = useState([]);
  const [startForm, setStartForm] = useState(initialScanForm);
  const [selectedJob, setSelectedJob] = useState(null);
  const [stopForm, setStopForm] = useState(blankStop);
  const [dcPlan, setDcPlan] = useState(null);
  const [machineWarning, setMachineWarning] = useState(null);
  const [readyRows, setReadyRows] = useState([]);
  const [showWarehouse, setShowWarehouse] = useState(false);
  async function load() { setJobs(await getJobs()); }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (startForm.dcNo) Promise.all([getProductionDc(startForm.dcNo), getWarehouse("PRODUCTION_READY", startForm.dcNo)]).then(([data, ready]) => {
      setDcPlan(data);
      setReadyRows(ready);
      setStartForm((current) => ({ ...current, section: data.section || current.section }));
    }).catch(() => setDcPlan(null));
  }, []);
  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(startForm)); }, [startForm]);
  useEffect(() => {
    if (!jobs.length || !startForm.machineCode || !(startForm.dcNo || startForm.outwardNo)) return;
    const runningJob = jobs.find((job) => job.machineCode === startForm.machineCode.toUpperCase() && ["Running", "Breakdown", "Thread Change", "Box Change", "Size Change", "Other Change"].includes(job.status));
    if (runningJob) {
      setMachineWarning(runningJob);
      setStartForm((current) => ({ ...current, machineCode: "" }));
    }
  }, [jobs, startForm.machineCode, startForm.dcNo, startForm.outwardNo]);
  async function start(event) {
    event.preventDefault();
    const sizes = startForm.size.split(",").map((value) => value.trim()).filter(Boolean);
    const pieces = String(startForm.plannedPcs).split(",").map((value) => value.trim()).filter(Boolean);
    if (sizes.length !== pieces.length) {
      notify("Each size must have one matching PCS quantity");
      return;
    }
    await startProductionJob(startForm);
    setStartForm(blankStart);
    localStorage.removeItem(DRAFT_KEY);
    await load();
    notify("Production started");
  }
  async function stop(event) { event.preventDefault(); await stopProductionJob(selectedJob._id, stopForm); setSelectedJob(null); setStopForm(blankStop); await load(); notify("Production status updated"); }
  async function resume(job) { await resumeProductionJob(job._id); await load(); notify("Production resumed"); }
  function openComplete(job) {
    const plans = job.sizePlan?.length ? job.sizePlan : [{ size: job.size, plannedPcs: job.balancePcs }];
    setSelectedJob(job);
    setStopForm({ ...blankStop, action: "Complete", sizeResults: plans.map((line) => ({ size: line.size, plannedPcs: line.plannedPcs, okPcs: "", reworkPcs: "", rejectionPcs: "" })) });
  }
  async function quickStop(job, action) {
    await stopProductionJob(job._id, { action });
    await load();
    notify(`${action} stopped`);
  }
  const eventStatuses = ["Breakdown", "Thread Change", "Bobbin Change", "Box Change", "Size Change", "Other Change"];
  const scannedMachineJob = jobs.find((job) => job.machineCode === startForm.machineCode.toUpperCase() && ["Running", ...eventStatuses].includes(job.status));
  function setMachineFromScan(scannedValue) {
    const machineCode = scannedValue.toUpperCase();
    const runningJob = jobs.find((job) => job.machineCode === machineCode && ["Running", ...eventStatuses].includes(job.status));
    if (runningJob && (startForm.dcNo || startForm.outwardNo)) {
      setMachineWarning(runningJob);
      setStartForm((current) => ({ ...current, machineCode: "" }));
      return;
    }
    setStartForm((current) => ({ ...current, machineCode }));
  }
  const columns = [
    { key: "jobNo", label: "Production No." }, { key: "dcNo", label: "Main DC" },
    { key: "colourQr", label: "Colour / Size QR", render: (job) => <div className="mini-qr"><QRGenerator value={`${window.location.origin}/production?dcNo=${encodeURIComponent(job.dcNo)}&colour=${encodeURIComponent(job.colour)}&size=${encodeURIComponent(job.size)}`} size={64}/><small>{job.colour}-{job.size}</small></div> },
    { key: "machineCode", label: "Machine QR" }, { key: "employeeCode", label: "Employee QR" },
    { key: "colour", label: "Colour" }, { key: "size", label: "Size / PCS Plan", render: (job) => job.sizePlan?.length ? job.sizePlan.map((line) => `${line.size}: ${line.plannedPcs}`).join(" | ") : job.size },
    { key: "plannedPcs", label: "Plan Pcs" }, { key: "okPcs", label: "OK Pcs" },
    { key: "balancePcs", label: "Balance" }, { key: "status", label: "Status" },
    { key: "control", label: "Control", render: (job) => eventStatuses.includes(job.status)
      ? <button onClick={() => resume(job)}>Complete Change / Resume</button>
      : job.status === "Running" ? <button className="danger" onClick={() => setSelectedJob(job)}>Stop</button> : "—" },
  ];
  if (showWarehouse) return <WarehousePage initialType="PRODUCTION_READY" initialDc={startForm.dcNo} notify={notify} />;
  if (scannedMachineJob && !startForm.dcNo) return <div className="machine-control-standalone">
    <PageTitle title={`Machine ${scannedMachineJob.machineCode}`} subtitle={`${scannedMachineJob.jobNo} · ${scannedMachineJob.itemName} · ${scannedMachineJob.colour}`} />
    <Card title={scannedMachineJob.status === "Running" ? "Stop Production" : "Machine Stopped"}>
      <div className="machine-live-summary"><div><small>Status</small><b>{scannedMachineJob.status}</b></div><div><small>Sizes</small><b>{scannedMachineJob.size}</b></div><div><small>Balance</small><b>{scannedMachineJob.balancePcs} PCS</b></div></div>
      {scannedMachineJob.status === "Running" ? <div className="machine-action-grid">
        <button className="complete-action" onClick={() => openComplete(scannedMachineJob)}>Complete</button>
        <button onClick={() => quickStop(scannedMachineJob, "Thread Change")}>Thread Cut</button>
        <button onClick={() => quickStop(scannedMachineJob, "Bobbin Change")}>Bobbin Change</button>
        <button onClick={() => quickStop(scannedMachineJob, "Box Change")}>Box Change</button>
        <button onClick={() => quickStop(scannedMachineJob, "Size Change")}>Size Change</button>
        <button onClick={() => quickStop(scannedMachineJob, "Other Change")}>Other Change</button>
      </div> : <button className="machine-resume-button" onClick={() => resume(scannedMachineJob)}>Start / Resume Production</button>}
    </Card>
    {selectedJob && <Card title="Complete · Size-wise Output"><form className="size-completion-form" onSubmit={stop}>
      {stopForm.sizeResults.map((row, index) => <div className="size-completion-row" key={row.size}><b>Size {row.size}</b><small>Plan: {row.plannedPcs} PCS</small>{["okPcs", "reworkPcs", "rejectionPcs"].map((key) => <label key={key}><span>{key === "okPcs" ? "OK PCS" : key === "reworkPcs" ? "Rework PCS" : "Rejection PCS"}</span><input type="number" min="0" value={row[key]} onChange={(event) => setStopForm((current) => ({ ...current, sizeResults: current.sizeResults.map((line, rowIndex) => rowIndex === index ? { ...line, [key]: event.target.value } : line) }))} /></label>)}</div>)}
      <label><span>Remarks</span><input value={stopForm.remarks} onChange={(event) => setStopForm({ ...stopForm, remarks: event.target.value })} /></label><div className="row-actions"><button type="button" onClick={() => setSelectedJob(null)}>Cancel</button><button className="primary">Save Completion</button></div>
    </form></Card>}
  </div>;
  return <>
    <PageTitle title="Production Control" subtitle="Scan Main DC, Colour, Machine and Employee QR to start" />
    <Card title="Load Common DC">
      <form className="dc-load-form" onSubmit={async (event) => { event.preventDefault(); const [data, ready] = await Promise.all([getProductionDc(startForm.dcNo), getWarehouse("PRODUCTION_READY", startForm.dcNo)]); setDcPlan(data); setReadyRows(ready); setStartForm({...startForm, section:data.section || startForm.section}); }}>
        <input required value={startForm.dcNo} placeholder="Scan Main DC QR or enter DC No." onChange={(event)=>setStartForm({...startForm,dcNo:event.target.value.toUpperCase()})}/>
        <button className="primary">Load DC Colours</button>
      </form>
      {dcPlan && <div className="dc-colour-plan"><b>DC {dcPlan.dcNo}</b><span>{dcPlan.itemNames.join(", ")}</span>{dcPlan.colours.map((colour)=>{const row=dcPlan.rows.find((entry)=>entry.colour===colour);return <button type="button" className={startForm.colour===colour?"primary":""} key={colour} onClick={()=>setStartForm({...startForm,colour,outwardNo:row?.outwardNo||row?.referenceNo||"",inwardNo:row?.inwardNo||row?.inwardReference||""})}>{colour}</button>;})}</div>}
      {readyRows.length > 0 && <div className="dc-ready-summary"><b>Completed Production Ready Stock</b>{readyRows.map((row) => <span key={row._id}>{row.itemName} · {row.colour} · Size {row.size}<strong>{row.balanceQty} PCS</strong></span>)}<button className="primary" type="button" onClick={() => setShowWarehouse(true)}>Scan Section QR & Deliver</button></div>}
    </Card>
    {!startForm.dcNo && scannedMachineJob && <div className="scan-result-card"><b>{scannedMachineJob.machineCode} is {scannedMachineJob.status}</b><span>{scannedMachineJob.colour} · Size {scannedMachineJob.size} · Balance {scannedMachineJob.balancePcs} pcs</span>{scannedMachineJob.status === "Running" ? <button className="danger" onClick={() => setSelectedJob(scannedMachineJob)}>Stop Machine</button> : <button onClick={() => resume(scannedMachineJob)}>Complete Change / Resume</button>}</div>}
    <Card title="Start Production">
      <form className="production-start-grid" onSubmit={start}>{Object.keys(blankStart).filter(key=>!["dcNo","inwardNo"].includes(key)).map((key) => ["machineCode", "employeeCode"].includes(key) ? <QRScanInput key={key} field={key} label={key === "machineCode" ? "Machine QR" : "Employee QR"} value={startForm[key]} onChange={key === "machineCode" ? setMachineFromScan : (scannedValue) => setStartForm((current) => ({ ...current, employeeCode: scannedValue.toUpperCase() }))} /> : <label key={key}><span>{key === "size" ? "Sizes (comma separated)" : key === "plannedPcs" ? "PCS (same sequence)" : key}</span>{key === "colour" && dcPlan ? <select required value={startForm.colour} onChange={(event)=>setStartForm({...startForm,colour:event.target.value})}><option value="">Select DC Colour</option>{dcPlan.colours.map(colour=><option key={colour}>{colour}</option>)}</select> : <input required={!['outwardNo'].includes(key)} readOnly={key === "outwardNo" && Boolean(startForm.outwardNo)} value={startForm[key]} type="text" placeholder={key === "size" ? "Example: 85, 90, 95" : key === "plannedPcs" ? "Example: 100, 110, 111" : ""} onChange={(event) => setStartForm({ ...startForm, [key]: event.target.value })} />}</label>)}{startForm.inwardNo && <div className="scan-reference"><b>Source Inward</b><span>{startForm.inwardNo}</span></div>}<button className="primary">Start Production</button></form>
    </Card>
    {selectedJob && <Card title={`Stop ${selectedJob.jobNo}`}><form className="production-start-grid" onSubmit={stop}>
      <label><span>Stop Option</span><select value={stopForm.action} onChange={(event) => setStopForm({ ...stopForm, action: event.target.value })}>{["Complete","Breakdown","Thread Change","Bobbin Change","Box Change","Size Change","Other Change"].map((value) => <option key={value}>{value}</option>)}</select></label>
      {stopForm.action === "Complete" ? <><label><span>OK Pcs</span><input type="number" value={stopForm.okPcs} onChange={(event) => setStopForm({...stopForm,okPcs:event.target.value})}/></label><label><span>Rework</span><input type="number" value={stopForm.reworkPcs} onChange={(event) => setStopForm({...stopForm,reworkPcs:event.target.value})}/></label><label><span>Rejection</span><input type="number" value={stopForm.rejectionPcs} onChange={(event) => setStopForm({...stopForm,rejectionPcs:event.target.value})}/></label></> : <label><span>Reason</span><input value={stopForm.reason} onChange={(event) => setStopForm({...stopForm,reason:event.target.value})}/></label>}
      <button className="primary">Confirm Stop</button><button type="button" onClick={() => setSelectedJob(null)}>Cancel</button>
    </form></Card>}
    <Card title="Production Runs"><DataTable rows={jobs} columns={columns} /></Card>
    {machineWarning && <div className="warning-modal-backdrop" role="dialog" aria-modal="true"><div className="warning-modal"><div className="warning-icon">!</div><h3>Machine Already Running</h3><p><b>{machineWarning.machineCode}</b> is currently running {machineWarning.jobNo}.</p><small>Scan another available machine QR to start this production.</small><button className="primary" autoFocus onClick={() => setMachineWarning(null)}>OK · Scan Another QR</button></div></div>}
  </>;
}
