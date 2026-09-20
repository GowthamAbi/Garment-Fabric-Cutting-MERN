import { useState } from "react";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";

const emptyBatch = (colour = "", dia = "") => ({ colour, dia, bundleNo: "", weightKg: "" });

export default function FoldingEntryPage({ notify }) {
  const [number, setNumber] = useState("");
  const [plan, setPlan] = useState(null);
  const [batches, setBatches] = useState([]);
  const [busy, setBusy] = useState(false);
  async function find() {
    setBusy(true);
    try {
      const row = await api.plan(number);
      setPlan(row);
      const seed = row.colours.flatMap((colour) => {
        const dias = [...new Set(colour.sizes.map((line) => line.dia).filter(Boolean))];
        return (dias.length ? dias : [""]).map((dia) => emptyBatch(colour.colour, dia));
      });
      setBatches(row.foldingBatches?.length ? row.foldingBatches : seed);
    } catch (error) { setPlan(null); notify?.(error.message); }
    finally { setBusy(false); }
  }
  function update(index, key, value) { setBatches(batches.map((row, i) => i === index ? { ...row, [key]: value } : row)); }
  function addAfter(index) { const row = batches[index]; setBatches([...batches.slice(0, index + 1), emptyBatch(row.colour, row.dia), ...batches.slice(index + 1)]); }
  async function save() {
    setBusy(true);
    try { const saved = await api.saveFolding(plan.planNo, { batches }); setPlan(saved); notify?.("Folding entry saved and fabric stock reduced colour/dia/batch-wise"); }
    catch (error) { notify?.(error.message); }
    finally { setBusy(false); }
  }
  return <section className="classic-page">
    <div className="classic-title"><div><small>FABRIC DEPARTMENT</small><h2>Folding Entry</h2><p>Load Plan/DC, enter one or more batches per colour and save stock consumption.</p></div></div>
    <div className="classic-card print-search"><label><span>Plan No / DC No</span><div className="input-action"><input value={number} onChange={(e) => setNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} /><button onClick={find} disabled={busy}><Search /></button></div></label></div>
    {plan && <div className="classic-card"><div className="folding-plan-summary"><b>{plan.itemName}</b><span>Plan: {plan.planNo}</span><span>DC: {plan.dcNo}</span><span>PCS: {plan.totalPlannedPcs}</span></div>
      <div className="table-wrap"><table><thead><tr><th>S.No</th><th>Colour</th><th>Dia</th><th>Batch No</th><th>Fabric WT (KG)</th><th>Add Multiple Batch</th></tr></thead><tbody>{batches.map((row, index) => <tr key={`${row.colour}-${index}`}><td>{index + 1}</td><td>{row.colour}</td><td><input value={row.dia} onChange={(e) => update(index, "dia", e.target.value)} /></td><td><input value={row.bundleNo} onChange={(e) => update(index, "bundleNo", e.target.value)} /></td><td><input type="number" min="0.001" step="0.001" value={row.weightKg} onChange={(e) => update(index, "weightKg", e.target.value)} /></td><td><div className="row-actions"><button type="button" onClick={() => addAfter(index)}><Plus /> Add Batch</button>{batches.length > 1 && <button type="button" className="danger" onClick={() => setBatches(batches.filter((_, i) => i !== index))}><Trash2 /></button>}</div></td></tr>)}</tbody></table></div>
      <div className="form-actions"><button className="primary" onClick={save} disabled={busy || plan.foldingBatches?.length}><Save /> {plan.foldingBatches?.length ? "Folding Entry Saved" : "Save & Reduce Stock"}</button></div>
    </div>}
  </section>;
}
