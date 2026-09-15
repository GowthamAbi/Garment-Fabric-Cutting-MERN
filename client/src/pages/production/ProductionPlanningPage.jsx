import { useEffect, useState } from "react";
import { getPlans, savePlan } from "../../api/productionApi.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

const line = () => ({ colour: "", size: "", requiredPcs: "", measurement: "", requiredMtr: "" });
const blank = () => ({ dcNo: "", customerOrder: "", section: "Elastic Production", itemCode: "", itemName: "", priority: "Normal", requiredDate: "", plannedMachine: "", lines: [line()] });

export default function ProductionPlanningPage({ notify }) {
  const [form, setForm] = useState(blank());
  const [plans, setPlans] = useState([]);
  const [editingId, setEditingId] = useState("");
  async function load() { setPlans(await getPlans()); }
  useEffect(() => { load(); }, []);
  function updateLine(index, key, value) { setForm({ ...form, lines: form.lines.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) }); }
  async function submit(event) {
    event.preventDefault();
    const grouped = Object.values(form.lines.reduce((map, row) => {
      const colour = row.colour.trim().toUpperCase();
      map[colour] ||= { colour, sizes: [] };
      map[colour].sizes.push({ size: row.size, requiredPcs: Number(row.requiredPcs), measurement: Number(row.measurement), requiredMtr: Number(row.requiredPcs) * Number(row.measurement) });
      return map;
    }, {}));
    const { lines, ...header } = form;
    await savePlan({ ...header, colours: grouped }, editingId);
    setForm(blank()); setEditingId(""); await load(); notify("Production plan saved");
  }
  function edit(plan) {
    setEditingId(plan._id);
    setForm({ ...blank(), ...plan, requiredDate: plan.requiredDate?.slice(0, 10) || "", lines: plan.colours.flatMap((colour) => colour.sizes.map((size) => ({ colour: colour.colour, size: size.size, requiredPcs: size.requiredPcs, measurement: size.measurement, requiredMtr: size.requiredMtr }))) });
  }
  const columns = [
    { key: "planNo", label: "Plan No." }, { key: "dcNo", label: "DC" }, { key: "itemCode", label: "Item" },
    { key: "section", label: "Section" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" },
    { key: "lines", label: "Colour / Size", render: (row) => row.colours.map((c) => `${c.colour}: ${c.sizes.map((s) => `${s.size}-${s.requiredPcs}`).join(", ")}`).join(" | ") },
    { key: "action", label: "Action", render: (row) => <button onClick={() => edit(row)}>Edit</button> },
  ];
  return <><PageTitle title="Production Planning" subtitle="DC requirement, colour and size-wise machine plan" />
    <Card title={editingId ? "Edit Plan" : "New Production Plan"}><form onSubmit={submit} className="pending-form">
      {["dcNo", "customerOrder", "section", "itemCode", "itemName", "requiredDate", "plannedMachine"].map((key) => <label key={key}><span>{key}</span><input required={["dcNo", "section", "itemCode"].includes(key)} type={key === "requiredDate" ? "date" : "text"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label><span>Priority</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <div className="plan-lines"><b>Colour / Size / Measurement Lines · Maximum 10</b>{form.lines.map((row, index) => <div className="plan-line production-measure-line" key={index}><input placeholder="Colour" required value={row.colour} onChange={(e) => updateLine(index, "colour", e.target.value)} /><input placeholder="Size" required value={row.size} onChange={(e) => updateLine(index, "size", e.target.value)} /><input placeholder="PCS" type="number" min="1" required value={row.requiredPcs} onChange={(e) => updateLine(index, "requiredPcs", e.target.value)} /><input placeholder="Measurement MTR/PCS" type="number" min="0.0001" step="0.0001" required value={row.measurement} onChange={(e) => updateLine(index, "measurement", e.target.value)} /><output>{(Number(row.requiredPcs || 0) * Number(row.measurement || 0)).toFixed(2)} MTR</output><button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}>Remove</button></div>)}</div>
      <div className="row-actions"><button type="button" disabled={form.lines.length >= 10} onClick={() => setForm({ ...form, lines: [...form.lines, line()] })}>Add Size ({form.lines.length}/10)</button><button className="primary">{editingId ? "Update Plan" : "Validate & Save Plan"}</button></div>
    </form></Card><Card title="Production Plans"><DataTable rows={plans} columns={columns} /></Card></>;
}
