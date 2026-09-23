import { useMemo, useRef, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import { printElement } from "../../services/printService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { FoldingDocument } from "./FoldingEntryPage.jsx";

const TITLES = {
  cutting: ["CUTTING DEPARTMENT", "Cutting Plan / Actual Print"],
  folding: ["FABRIC DEPARTMENT", "Folding Plan Print"],
  elastic: ["ELASTIC DEPARTMENT", "Elastic Plan Print"],
  fabric: ["FABRIC DEPARTMENT", "Fabric Production Plan Print"],
};

const n = (value) => Number(value || 0);
const fixed = (value, digits = 3) => Number(n(value).toFixed(digits));

export default function DepartmentPlanPrintPage({ type = "cutting", notify }) {
  const [number, setNumber] = useState("");
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [actual, setActual] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const [department, title] = TITLES[type] || TITLES.cutting;

  async function find() {
    if (!number.trim()) return notify?.("Enter Plan Number");
    setBusy(true);
    try {
      const result = type === "elastic" ? await api.elastic(number.trim()) : type === "folding" ? await api.foldingSetup(number.trim()) : await api.plan(number.trim());
      let loadedPlan = result?.plan || result;
      if (type === "folding" && !loadedPlan.foldingLines?.length) {
        const source = result?.actual?.lines?.length
          ? result.actual.lines.map((row) => ({ ...row, pcs: row.actualPcs }))
          : (loadedPlan.colours || []).flatMap((colour) => (colour.sizes || []).map((row) => ({ ...row, colour: colour.colour, pcs: row.plannedPcs })));
        const foldingLines = source.map((row) => {
          const bom = result?.item?.sizes?.find((item) => String(item.size).toUpperCase() === String(row.size).toUpperCase());
          const pcs = n(row.pcs || row.actualPcs || row.plannedPcs);
          const perPiece = n(bom?.foldingPieceWeightKg || row.foldingWeightPerPieceKg);
          return { colour: row.colour, size: row.size, dia: row.dia || bom?.dia || "", actualCuttingPcs: pcs, foldingWeightPerPieceKg: perPiece, wantedWeightKg: fixed(pcs * perPiece), actualWeightKg: "" };
        });
        const foldingBatches = (loadedPlan.colours || []).flatMap((colour) => (colour.batchNumbers?.length ? colour.batchNumbers : [""]).map((bundleNo) => ({ colour: colour.colour, dia: colour.sizes?.[0]?.dia || "", bundleNo, weightKg: "" })));
        loadedPlan = { ...loadedPlan, foldingLines, foldingBatches };
      }
      setPlan(loadedPlan);
      if (type === "cutting") setActual((await api.actuals({ planNo: loadedPlan.planNo }))[0] || null);
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
        {plan && (type === "cutting" ? <CuttingGrnDocument plan={plan} actual={actual} documentRef={ref} /> : type === "fabric" ? <FabricPlanDocument plan={plan} companyName={user?.companyName} documentRef={ref} /> : type === "folding" ? <div ref={ref}><FoldingDocument plan={plan} lines={plan.foldingLines} batches={plan.foldingBatches} quality={plan.foldingQuality} companyName={user?.companyName}/></div> : <ExcelPlanDocument plan={plan} type={type} documentRef={ref} />)}
      </div>
    </section>
  );
}

function FabricPlanDocument({ plan, companyName, documentRef }) {
  const lines = (plan.colours || []).flatMap((colour) => (colour.sizes || []).map((row) => ({ ...row, colour: colour.colour })));
  const sizes = [...new Set(lines.map((row) => row.size))];
  return <article className="fabric-plan-print print-document" ref={documentRef}><header><h1>{companyName || "Company Name"}</h1><h2>FABRIC DEPARTMENT</h2></header>
    <div className="fabric-print-meta"><span>Date <b>{new Date(plan.createdAt).toLocaleDateString()}</b></span><span>Item Name <b>{plan.itemName}</b></span><span>Style <b>{plan.style || "—"}</b></span><span>Order No <b>{plan.orderNo}</b></span><span>Plan No <b>{plan.planNo}</b></span><span>Dia <b>{[...new Set(lines.map((x) => x.dia))].join(", ")}</b></span><span>DC Type <b>{plan.dcType === "FOLDING_LOT" ? "Folding Lot" : "First Lot"}</b></span></div>
    <h3>Size Summary</h3><table><thead><tr><th>Size</th><th>Dia</th><th>PCS</th><th>Total Weight</th></tr></thead><tbody>{sizes.map((size) => { const rows = lines.filter((x) => x.size === size); return <tr key={size}><td>{size}</td><td>{rows[0]?.dia}</td><td>{rows.reduce((s,x)=>s+n(x.plannedPcs),0)}</td><td>{fixed(rows.reduce((s,x)=>s+n(x.wantedWeightKg),0))} KG</td></tr>; })}</tbody><tfoot><tr><td colSpan="2">TOTAL</td><td>{plan.totalPlannedPcs}</td><td>{plan.totalWantedWeightKg} KG</td></tr></tfoot></table>
    <h3>Colour / Batch Requirement</h3><table><thead><tr><th>S.No</th><th>Colour</th><th>Batch Number</th><th>PCS</th><th>Wanted Weight</th><th>Remarks</th></tr></thead><tbody>{(plan.colours || []).flatMap((colour, colourIndex) => { const batches = colour.batchNumbers?.length ? colour.batchNumbers : ["—"]; return batches.map((batch,index) => <tr key={`${colour.colour}-${batch}-${index}`}><td>{index===0 ? colourIndex+1 : ""}</td>{index===0 && <td rowSpan={batches.length}>{colour.colour}</td>}<td>{batch}</td>{index===0 && <><td rowSpan={batches.length}>{colour.totalPcs}</td><td rowSpan={batches.length}>{colour.wantedWeightKg} KG</td><td rowSpan={batches.length}>{colour.remarks || ""}</td></>}</tr>); })}</tbody><tfoot><tr><td colSpan="3">TOTAL</td><td>{plan.totalPlannedPcs}</td><td>{plan.totalWantedWeightKg} KG</td><td /></tr></tfoot></table><div className="excel-signatures"><span>Prepared By</span><span>Checked By</span><span>Approved By</span></div>
  </article>;
}

function CuttingGrnDocument({ plan, actual, documentRef }) {
  const planLines = (plan.colours || []).flatMap((colour) => (colour.sizes || []).map((row) => ({ ...row, colour: colour.colour })));
  const actualLines = actual?.lines || [];
  const sizes = [...new Set(planLines.map((row) => row.size))];
  const colours = [...new Set(planLines.map((row) => row.colour))];
  const lineFor = (colour, size) => actualLines.find((row) => row.colour === colour && row.size === size) || planLines.find((row) => row.colour === colour && row.size === size) || {};
  const totals = actual || { issuedWeightKg: plan.totalWantedWeightKg, totalActualWeightKg: 0, totalBundleWeightKg: 0, wasteWeightKg: plan.totalWantedWeightKg, efficiencyPercent: 0 };
  const actualPcs = n(actual?.totalActualPcs || actualLines.reduce((sum, row) => sum + n(row.actualPcs), 0));
  const pieceEfficiency = n(plan.totalPlannedPcs) ? (actualPcs / n(plan.totalPlannedPcs)) * 100 : 0;
  return <article className="cutting-grn-document print-document" ref={documentRef}>
    <header><small>CUTTING ACTUAL / PLAN TRACEABILITY</small><h1>{plan.itemName}</h1><p>Plan {plan.planNo} · DC {plan.dcNo}</p></header>
    <div className="cutting-grn-meta"><span>Date <b>{new Date(actual?.createdAt || plan.createdAt).toLocaleDateString()}</b></span><span>Order No <b>{plan.orderNo}</b></span><span>Style <b>{plan.style || "—"}</b></span><span>Fabric Group <b>{plan.fabricGroup}</b></span></div>
    <div className="cutting-grn-kpis"><span>Received Weight <b>{fixed(totals.issuedWeightKg || plan.totalWantedWeightKg)} KG</b></span><span>Actual Weight <b>{fixed(totals.totalActualWeightKg)} KG</b></span><span>Cut Bundle Weight <b>{fixed(totals.totalBundleWeightKg)} KG</b></span><span>Waste Weight <b>{fixed(totals.wasteWeightKg)} KG</b></span><span>Weight Efficiency <b>{n(totals.efficiencyPercent).toFixed(2)}%</b></span><span>Piece Efficiency <b>{pieceEfficiency.toFixed(2)}%</b></span></div>
    <table><thead><tr><th>S.No</th><th>Colour</th>{sizes.map((size) => <th key={size}>{size}</th>)}<th>Total PCS</th></tr></thead><tbody>{colours.map((colour, index) => <tr key={colour}><td>{index + 1}</td><td>{colour}</td>{sizes.map((size) => <td key={size}>{n(lineFor(colour, size).actualPcs || lineFor(colour, size).plannedPcs) || ""}</td>)}<td>{sizes.reduce((sum, size) => sum + n(lineFor(colour, size).actualPcs || lineFor(colour, size).plannedPcs), 0)}</td></tr>)}</tbody><tfoot><tr><td colSpan="2">TOTAL</td>{sizes.map((size) => <td key={size}>{colours.reduce((sum, colour) => sum + n(lineFor(colour, size).actualPcs || lineFor(colour, size).plannedPcs), 0)}</td>)}<td>{actual?.totalActualPcs || plan.totalPlannedPcs}</td></tr></tfoot></table>
    <h3>Size-wise Cutting Summary</h3>
    <table><thead><tr><th>Size</th><th>Dia</th><th>Bundle</th><th>PCS</th><th>Fabric Lot WT</th><th>Cut Bundle WT</th><th>Waste WT</th></tr></thead><tbody>{sizes.map((size) => { const rows = colours.map((colour) => lineFor(colour, size)); const pcs = rows.reduce((sum,row) => sum + n(row.actualPcs || row.plannedPcs),0); const fabric = rows.reduce((sum,row) => sum + n(row.actualWeightKg || row.wantedWeightKg),0); const bundle = rows.reduce((sum,row) => sum + n(row.bundleWeightKg),0); return <tr key={size}><td>{size}</td><td>{rows.find((row) => row.dia)?.dia || "—"}</td><td>{rows.reduce((sum,row) => sum + n(row.bundleCount),0)}</td><td>{pcs}</td><td>{fixed(fabric)}</td><td>{fixed(bundle)}</td><td>{fixed(fabric - bundle)}</td></tr>; })}</tbody></table>
    <div className="document-notes"><small>REMARKS</small><p>{actual?.remarks || ""}</p></div><div className="cutting-grn-signatures"><span>GRN No: ______________</span><span>Prepared By</span><span>Checked By</span></div>
  </article>;
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
    {type === "folding" && plan.foldingBatches?.length > 0 && <>
      <h3>Colour / Batch Fabric Entry</h3>
      <table><thead><tr><th>S.No</th><th>Colour</th><th>Dia</th><th>Batch No</th><th>Fabric WT</th></tr></thead><tbody>
        {plan.foldingBatches.map((row, index, all) => {
          const first = index === 0 || all[index - 1].colour !== row.colour;
          const span = first ? all.filter((x) => x.colour === row.colour).length : 0;
          return <tr key={`${row.bundleNo}-${index}`}><td>{index + 1}</td>{first && <td rowSpan={span}>{row.colour}</td>}<td>{row.dia}</td><td>{row.bundleNo}</td><td>{row.weightKg} KG</td></tr>;
        })}
      </tbody><tfoot><tr><td colSpan="4">TOTAL</td><td>{plan.foldingWeightKg} KG</td></tr></tfoot></table>
    </>}
    <div className="excel-signatures"><span>GRN No</span><span>Prepared By</span><span>Checked By</span><span>Verified By</span><span>Authorized By</span></div>
  </article>;
}
