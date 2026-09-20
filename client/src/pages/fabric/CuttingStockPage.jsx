import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { exportCsv } from "../../api.js";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";

export default function CuttingStockPage({ mode = "pending", notify }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const loader = mode === "waste" ? api.waste : mode === "stock" ? api.actuals : api.plans;
    loader().then(setRows).catch((error) => notify?.(error.message));
  }, [mode]);
  const filtered = useMemo(() => rows.filter((row) => {
    if (mode === "pending" && ["COMPLETED"].includes(row.status)) return false;
    return `${row.planNo} ${row.dcNo} ${row.itemName} ${row.status}`.toLowerCase().includes(search.toLowerCase());
  }), [rows, search, mode]);
  const title = mode === "pending" ? "Cutting Pending" : mode === "stock" ? "Cutting Stock Awaiting Stitching" : "Cutting Waste";
  return <section className="classic-page"><div className="classic-title"><div><small>CUTTING DEPARTMENT</small><h2>{title}</h2><p>{mode === "pending" ? "Plans without completed Cutting Actual remain pending." : mode === "stock" ? "Completed cutting pieces not yet transferred to stitching." : "Plan, colour and size-wise cutting waste."}</p></div><div className="page-actions"><button onClick={() => exportCsv(`${mode}.csv`, filtered)}><Download /> Excel</button><button onClick={() => window.print()}><Printer /> Print</button></div></div>
    <div className="classic-card"><div className="input-action"><input placeholder="Search Plan, DC, Item or Status" value={search} onChange={(e) => setSearch(e.target.value)} /><button><Search /></button></div><div className="table-wrap"><table><thead><tr><th>S.No</th><th>Date</th><th>Plan No</th><th>DC No</th><th>Item</th><th>PCS</th><th>Weight / Waste KG</th><th>Status</th><th>Aging</th></tr></thead><tbody>{filtered.map((row, index) => <tr key={row._id}><td>{index + 1}</td><td>{new Date(row.createdAt).toLocaleDateString()}</td><td>{row.planNo}</td><td>{row.dcNo}</td><td>{row.itemName || row.itemCode}</td><td>{row.totalActualPcs ?? row.totalPlannedPcs ?? "—"}</td><td>{row.wasteWeightKg ?? row.totalBundleWeightKg ?? row.totalWantedWeightKg ?? 0}</td><td>{row.status || (mode === "waste" ? "RECORDED" : "COMPLETE")}</td><td>{Math.max(0, Math.floor((Date.now() - new Date(row.createdAt)) / 86400000))} days</td></tr>)}</tbody></table></div></div>
  </section>;
}
