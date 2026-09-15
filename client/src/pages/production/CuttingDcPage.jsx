import { useEffect, useState } from "react";
import { Download, Plus, Printer, Search } from "lucide-react";
import { getCuttingDc, getCuttingDcs, getMeasurements, saveCuttingDc } from "../../api/productionApi.js";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import DataTable from "../../components/DataTable.jsx";
import { downloadCuttingDcPdf } from "../../services/printService.js";

const sizeLine = () => ({ size: "", pcs: "", measurement: "" });
const colourLine = () => ({ colour: "", sizes: [sizeLine()], materialDecision: "OUTWARD", shortageReason: "" });
const blank = () => ({ dcNo: "", itemName: "", itemCode: "", style: "", target: "", colours: [colourLine()] });

export default function CuttingDcPage({ notify }) {
  const [form, setForm] = useState(blank());
  const [rows, setRows] = useState([]);
  const [view, setView] = useState(null);
  const [searchNo, setSearchNo] = useState("");
  const load = async () => setRows(await getCuttingDcs());
  useEffect(() => { load(); }, []);
  const sizeCount = form.colours.reduce((sum, line) => sum + line.sizes.length, 0);
  function changeColour(ci, key, value) { setForm((old) => ({ ...old, colours: old.colours.map((line, index) => index === ci ? { ...line, [key]: value } : line) })); }
  function changeSize(ci, si, key, value) { setForm((old) => ({ ...old, colours: old.colours.map((line, index) => index === ci ? { ...line, sizes: line.sizes.map((size, i) => i === si ? { ...size, [key]: value } : size) } : line) })); }
  async function fillMeasurement(ci, si, size) {
    changeSize(ci, si, "size", size);
    if (!form.itemName || !form.style || !size) return;
    const found = await getMeasurements({ itemName: form.itemName, style: form.style, size });
    if (found[0]) changeSize(ci, si, "measurement", found[0].measurement);
  }
  async function submit(event) { event.preventDefault(); const saved = await saveCuttingDc(form); setView(saved); setForm(blank()); await load(); notify("Cutting DC and measurement master saved"); }
  async function findDc(dcNo = searchNo) { const found = await getCuttingDc(dcNo); setView(found); setSearchNo(found.dcNo); }
  const totalPcs = (data = form) => data.colours.reduce((sum, c) => sum + c.sizes.reduce((n, s) => n + Number(s.pcs || 0), 0), 0);
  const totalMtr = (data = form) => data.colours.reduce((sum, c) => sum + c.sizes.reduce((n, s) => n + Number(s.pcs || 0) * Number(s.measurement || 0), 0), 0);
  const columns = [
    { key: "dcNo", label: "DC No" }, { key: "itemName", label: "Item Name" }, { key: "style", label: "Style" },
    { key: "totalPcs", label: "Total PCS" }, { key: "totalMtr", label: "Total MTR" }, { key: "status", label: "Status" },
    { key: "view", label: "View", render: (row) => <button onClick={() => findDc(row.dcNo)}>View / Print</button> },
  ];
  return <><PageTitle title="Elastic Cutting DC" subtitle="Size and colour-wise PCS, measurement and wanted MTR planning" />
    <Card title="Cutting DC Entry"><form className="cutting-dc-form" onSubmit={submit}>
      <div className="cutting-header">{[["dcNo", "DC No"], ["itemName", "Item Name"], ["itemCode", "Item Code"], ["style", "Style"], ["target", "Target"]].map(([key, label]) => <label key={key}><span>{label}</span><input required={["dcNo", "itemName", "style"].includes(key)} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
      <div className="cutting-colours">{form.colours.map((colour, ci) => <section className="cutting-colour" key={ci}><div className="cutting-colour-head"><label><span>Colour</span><input required value={colour.colour} onChange={(e) => changeColour(ci, "colour", e.target.value)} /></label><label><span>Material Source</span><select value={colour.materialDecision} onChange={(e) => changeColour(ci, "materialDecision", e.target.value)}><option value="OUTWARD">Store Outward</option><option value="BALANCE">Balance Warehouse</option><option value="NO_STOCK">No Stock / Store Request</option></select></label>{colour.materialDecision !== "OUTWARD" && <label><span>Reason</span><input required value={colour.shortageReason} onChange={(e) => changeColour(ci, "shortageReason", e.target.value)} /></label>}</div>
        {colour.sizes.map((size, si) => <div className="cutting-size-row" key={si}><b>{si + 1}</b><input placeholder="Size" required value={size.size} onChange={(e) => fillMeasurement(ci, si, e.target.value)} /><input placeholder="PCS" type="number" min="1" required value={size.pcs} onChange={(e) => changeSize(ci, si, "pcs", e.target.value)} /><input placeholder="Measurement MTR/PCS" type="number" min="0.0001" step="0.0001" required value={size.measurement} onChange={(e) => changeSize(ci, si, "measurement", e.target.value)} /><output>{(Number(size.pcs || 0) * Number(size.measurement || 0)).toFixed(3)} MTR</output><button type="button" disabled={colour.sizes.length === 1} onClick={() => changeColour(ci, "sizes", colour.sizes.filter((_, i) => i !== si))}>Remove</button></div>)}
        <button type="button" disabled={sizeCount >= 10} onClick={() => changeColour(ci, "sizes", [...colour.sizes, sizeLine()])}><Plus /> Add Size</button></section>)}</div>
      <div className="cutting-total"><b>Total PCS: {totalPcs()}</b><b>Total MTR: {totalMtr().toFixed(3)}</b></div>
      <div className="row-actions"><button type="button" onClick={() => setForm({ ...form, colours: [...form.colours, colourLine()] })}><Plus /> Add Colour</button><button className="primary">Validate & Save Cutting DC</button></div>
    </form></Card>
    <Card title="DC View / Print"><div className="dc-lookup"><input placeholder="Enter common DC No" value={searchNo} onChange={(e) => setSearchNo(e.target.value)} /><button className="primary" onClick={() => findDc()}><Search /> View</button></div>{view && <div className="cutting-preview"><div><h2>ACCESSORIES FLOW</h2><b>ELASTIC CUTTING DC</b><p>DC No: {view.dcNo} · Item: {view.itemName} · Style: {view.style} · Target: {view.target || "-"}</p></div><table><thead><tr><th>S.No</th><th>Colour</th><th>Size</th><th>PCS</th><th>Measurement</th><th>Wanted MTR</th></tr></thead><tbody>{view.colours.flatMap((c) => c.sizes.map((s) => ({ ...s, colour: c.colour }))).map((line, index) => <tr key={`${line.colour}-${line.size}`}><td>{index + 1}</td><td>{line.colour}</td><td>{line.size}</td><td>{line.pcs}</td><td>{line.measurement}</td><td>{line.wantedMtr}</td></tr>)}</tbody><tfoot><tr><th colSpan="3">TOTAL</th><th>{view.totalPcs}</th><th></th><th>{view.totalMtr}</th></tr></tfoot></table><div className="row-actions"><button onClick={() => window.print()}><Printer /> Print</button><button className="primary" onClick={() => downloadCuttingDcPdf(view)}><Download /> PDF</button></div></div>}</Card>
    <Card title="Saved Cutting DC"><DataTable rows={rows} columns={columns} /></Card></>;
}
