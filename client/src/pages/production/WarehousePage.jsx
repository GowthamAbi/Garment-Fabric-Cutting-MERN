import { useEffect, useState } from "react";
import { Download, PackageCheck } from "lucide-react";
import { deliverWarehouseStock, getWarehouse, transferRework } from "../../api/productionApi.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import QRScanInput from "../../components/qr/QRScanInput.jsx";
import { downloadExcel } from "../../services/csvService.js";

  const labels = { PRODUCTION_READY: "Production Ready", REWORK: "Rework", REJECTION: "Rejection", BALANCE_ELASTIC: "Balance Elastic", SECTION_DELIVERY: "Section Delivery" };
const blankAction = { action: "complete", quantity: "", itemName: "", colour: "", size: "", reason: "", sectionCode: "" };

export default function WarehousePage({ initialType = "PRODUCTION_READY", initialDc = "", notify }) {
  const [type, setType] = useState(initialType);
  const [rows, setRows] = useState([]);
  const [dcNo, setDcNo] = useState(initialDc);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blankAction);

  async function load(nextType = type, nextDc = dcNo) { setRows(await getWarehouse(nextType, nextDc)); }
  useEffect(() => { setType(initialType); load(initialType, dcNo); }, [initialType]);

  function openAction(row, action) {
    setSelected(row);
    setForm({ ...blankAction, action, itemName: row.itemName, colour: row.colour, size: row.size });
  }

  async function submit(event) {
    event.preventDefault();
    if (type === "REWORK") await transferRework(selected._id, form);
    else await deliverWarehouseStock(selected._id, form);
    setSelected(null); setForm(blankAction); await load(); notify("Warehouse stock updated");
  }

  const columns = [
    { key: "referenceNo", label: "Reference" }, { key: "dcNo", label: "DC No" },
    { key: "itemName", label: "Item Name" }, { key: "colour", label: "Colour" },
    { key: "size", label: "Size" }, { key: "originalQty", label: "Original Qty", render: (row) => `${row.originalQty} ${row.unit || "PCS"}` },
    { key: "balanceQty", label: "Balance Qty", render: (row) => `${row.balanceQty} ${row.unit || "PCS"}` }, { key: "sectionCode", label: "Section" },
    { key: "actions", label: "Actions", render: (row) => type === "REWORK" && row.balanceQty > 0 ? <div className="warehouse-actions"><button onClick={() => openAction(row, "complete")}>Ready</button><button onClick={() => openAction(row, "convert")}>Convert</button><button className="danger" onClick={() => openAction(row, "reject")}>Reject</button></div> : type === "PRODUCTION_READY" && row.balanceQty > 0 ? <button className="primary" onClick={() => openAction(row, "deliver")}>Deliver to Section</button> : "—" },
  ];

  const total = rows.reduce((sum, row) => sum + Number(row.balanceQty || 0), 0);
  return <>
    <PageTitle title="Warehouse" subtitle="Production-ready, rework, rejection, balance elastic and section delivery stock" />
    <div className="warehouse-tabs">{Object.entries(labels).map(([key, label]) => <button className={type === key ? "active" : ""} key={key} onClick={() => { setType(key); load(key, dcNo); }}>{label}</button>)}</div>
    <div className="warehouse-summary"><PackageCheck /><div><small>{labels[type]} Balance</small><b>{total} PCS</b></div><div className="warehouse-dc-search"><QRScanInput field="dcNo" label="Main DC QR" required={false} value={dcNo} onChange={(value) => setDcNo(value.toUpperCase())}/><button className="primary" onClick={() => load(type, dcNo)}>View DC Stock</button><button onClick={() => downloadExcel(`${type.toLowerCase()}-warehouse.xls`, rows)}><Download /> Excel</button></div></div>
    <Card title={`${labels[type]} Warehouse`}><DataTable rows={rows} columns={columns} /></Card>
    {selected && <div className="warehouse-modal-backdrop"><Card title={type === "REWORK" ? `${form.action.toUpperCase()} REWORK` : "DELIVER TO SECTION"}><form className="warehouse-action-form" onSubmit={submit}>
      <label><span>Quantity PCS</span><input required type="number" min="1" max={selected.balanceQty} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })}/><small>Available: {selected.balanceQty} PCS</small></label>
      {form.action === "convert" && <>{["itemName", "colour", "size"].map((key) => <label key={key}><span>New {key}</span><input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}/></label>)}</>}
      {form.action === "reject" && <label><span>Rejection Reason</span><input required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}/></label>}
      {form.action === "deliver" && <QRScanInput field="sectionCode" label="Section QR" value={form.sectionCode} onChange={(value) => setForm({ ...form, sectionCode: value.toUpperCase() })}/>} 
      <div className="row-actions"><button type="button" onClick={() => setSelected(null)}>Cancel</button><button className="primary">Confirm</button></div>
    </form></Card></div>}
  </>;
}
