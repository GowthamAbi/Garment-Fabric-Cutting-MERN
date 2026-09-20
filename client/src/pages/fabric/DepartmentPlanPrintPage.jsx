import { useMemo, useRef, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import { printElement } from "../../services/printService.js";

const TITLES = {
  cutting: ["CUTTING DEPARTMENT", "Cutting Plan / Actual Print"],
  folding: ["FABRIC DEPARTMENT", "Folding Plan Print"],
  elastic: ["ELASTIC DEPARTMENT", "Elastic Plan Print"],
};

const n = (value) => Number(value || 0);
const fixed = (value, digits = 3) => Number(n(value).toFixed(digits));

export default function DepartmentPlanPrintPage({ type = "cutting", notify }) {
  const [number, setNumber] = useState("");
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const [department, title] = TITLES[type] || TITLES.cutting;

  async function find() {
    if (!number.trim()) return notify?.("Enter Plan Number");
    setBusy(true);
    try {
      const result = type === "elastic" ? await api.elastic(number.trim()) : await api.plan(number.trim());
      setPlan(result?.plan || result);
    } catch (error) {
      setPlan(null);
      notify?.(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function pdf() {
    if (!ref.current || !plan) return;
    setBusy(true);
    try {
      const file = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      await file.html(ref.current, { x: 6, y: 6, width: 285, windowWidth: 1350, autoPaging: "text" });
      file.save(`${plan.planNo || number}-${type}-plan.pdf`);
    } catch (error) {
      notify?.(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="classic-page">
      <div className="classic-title">
        <div><small>{department}</small><h2>{title}</h2><p>Enter Plan Number to load the saved plan in the approved Excel layout.</p></div>
      </div>
      <div className="classic-card print-search">
        <label><span>Plan Number</span><div className="input-action">
          <input value={number} placeholder="Enter Plan No" onChange={(e) => setNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} />
          <button onClick={find} disabled={busy}><Search /></button>
        </div></label>
        {plan && <div className="form-actions">
          <button onClick={() => printElement("department-plan-print")}><Printer /> Print</button>
          <button onClick={pdf} disabled={busy}><Download /> PDF</button>
        </div>}
      </div>
      <div id="department-plan-print">
        {plan && <ExcelPlanDocument plan={plan} type={type} documentRef={ref} />}
      </div>
    </section>
  );
}

function ExcelPlanDocument({ plan, type, documentRef }) {
  const lines = useMemo(() => (plan.colours || []).flatMap((colour) =>
    (colour.sizes || []).filter((row) => n(row.plannedPcs || row.pcs) > 0).map((row) => ({ ...row, colour: colour.colour }))), [plan]);
  const sizes = [...new Set(lines.map((row) => row.size))];
  const colourRows = plan.colours || [];
  const isElastic = type === "elastic";
  const pieceWeight = (row) => type === "folding" ? n(row.foldingWeightPerPieceKg || row.foldingPieceWeightKg) : n(row.cuttingWeightPerPieceKg || row.cuttingPieceWeightKg || row.pieceMetre);
  const sizeSummary = sizes.map((size) => {
    const rows = lines.filter((row) => row.size === size);
    const pcs = rows.reduce((sum, row) => sum + n(row.plannedPcs || row.pcs), 0);
    const rate = pieceWeight(rows[0] || {});
    return { size, rate, pcs, wanted: fixed(pcs * rate), dia: rows[0]?.dia || "—" };
  });
  const totalPcs = colourRows.reduce((sum, row) => sum + n(row.totalPcs), 0) || lines.reduce((sum, row) => sum + n(row.plannedPcs || row.pcs), 0);
  const totalWanted = fixed(sizeSummary.reduce((sum, row) => sum + row.wanted, 0));
  return <article className="excel-plan-document print-document" ref={documentRef}>
    <header><small>{type.toUpperCase()} PLAN / TRACEABILITY</small><h1>{plan.itemName || "Production Plan"}</h1><p>Plan {plan.planNo || "—"} · DC {plan.dcNo || "—"}</p></header>
    <div className="excel-plan-meta">
      <span><small>Date</small><b>{plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</b></span>
      <span><small>Plan No</small><b>{plan.planNo || "—"}</b></span>
      <span><small>Item Name</small><b>{plan.itemName || "—"}</b></span>
      <span><small>Order No</small><b>{plan.orderNo || "—"}</b></span>
      <span><small>{type === "folding" ? "Folding Quality" : type === "elastic" ? "Elastic Quality" : "Fabric Group"}</small><b>{plan.fabricGroup || plan.quality || "—"}</b></span>
    </div>
    <h3>Size-wise Requirement</h3>
    <table><thead><tr><th>Size</th>{type === "cutting" && <th>Dia</th>}<th>{isElastic ? "PCS Metre" : `${type === "folding" ? "Folding" : "Cutting"} PCS WT`}</th><th>PCS</th><th>{isElastic ? "Wanted Metre" : "Wanted WT"}</th></tr></thead>
      <tbody>{sizeSummary.map((row) => <tr key={row.size}><td>{row.size}</td>{type === "cutting" && <td>{row.dia}</td>}<td>{row.rate}</td><td>{row.pcs}</td><td>{row.wanted}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={type === "cutting" ? 3 : 2}>TOTAL</td><td>{totalPcs}</td><td>{totalWanted}</td></tr></tfoot>
    </table>
    <h3>Colour × Size Plan</h3>
    <table className="excel-matrix"><thead><tr><th>No</th><th>Batch No</th><th>Colour</th>{sizes.map((size) => <th key={size}>{size}<small>PCS / {isElastic ? "MTR" : "WT"}</small></th>)}<th>Total PCS</th><th>{isElastic ? "Total MTR" : "Total WT"}</th></tr></thead>
      <tbody>{colourRows.map((colour, index) => <tr key={colour.colour}><td>{index + 1}</td><td>{colour.batchNo || ""}</td><td>{colour.colour}</td>{sizes.map((size) => { const row = (colour.sizes || []).find((x) => x.size === size) || {}; const pcs = n(row.plannedPcs || row.pcs); return <td key={size}>{pcs}<small>{fixed(pcs * pieceWeight(row))}</small></td>; })}<td>{colour.totalPcs || 0}</td><td>{colour.wantedWeightKg || fixed((colour.sizes || []).reduce((sum, row) => sum + n(row.plannedPcs || row.pcs) * pieceWeight(row), 0))}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={3 + sizes.length}>TOTAL</td><td>{totalPcs}</td><td>{totalWanted}</td></tr></tfoot>
    </table>
    <div className="excel-signatures"><span>GRN No</span><span>Prepared By</span><span>Checked By</span><span>Verified By</span><span>Authorized By</span></div>
  </article>;
}
