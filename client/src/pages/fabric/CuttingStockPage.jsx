import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { exportCsv } from "../../api.js";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import { deliveryApi } from "../../api/deliveryApi.js";

export default function CuttingStockPage({ mode = "pending", notify }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  async function load() {
    const loader = mode === "waste" ? api.waste : mode === "stock" ? deliveryApi.cuttingStock : api.plans;
    try { setRows(await loader()); } catch (error) { notify?.(error.message); }
  }
  useEffect(() => {
    load();
  }, [mode]);
  const filtered = useMemo(() => rows.filter((row) => {
    if (mode === "pending" && ["COMPLETED"].includes(row.status)) return false;
    const date = new Date(row.createdAt);
    if (dates.from && date < new Date(dates.from)) return false;
    if (dates.to && date > new Date(`${dates.to}T23:59:59.999`)) return false;
    return `${row.planNo} ${row.dcNo} ${row.itemName} ${row.colour||""} ${row.size||""} ${row.status}`.toLowerCase().includes(search.toLowerCase());
  }), [rows, search, mode, dates]);
  const title = mode === "pending" ? "Cutting Pending" : mode === "stock" ? "Cutting Stock Awaiting Stitching" : "Cutting Waste";
  return <section className="classic-page"><div className="classic-title"><div><small>CUTTING DEPARTMENT</small><h2>{title}</h2><p>{mode === "pending" ? "Plans without completed Cutting Actual remain pending." : mode === "stock" ? "Completed cutting pieces not yet transferred to stitching." : "Plan, colour and size-wise cutting waste."}</p></div><div className="page-actions"><button onClick={() => exportCsv(`${mode}.csv`, filtered)}><Download /> Excel</button><button onClick={() => window.print()}><Printer /> Print</button></div></div>
    <div className="classic-card"><div className="filter-panel"><label>Search<input placeholder="Plan, DC, Item or Status" value={search} onChange={(e) => setSearch(e.target.value)} /></label><label>From<input type="date" value={dates.from} onChange={(e)=>setDates({...dates,from:e.target.value})}/></label><label>To<input type="date" value={dates.to} onChange={(e)=>setDates({...dates,to:e.target.value})}/></label><button onClick={load}><RefreshCw/> Refresh</button></div><div className="table-wrap"><table><thead><tr><th>S.No</th><th>Date</th><th>Plan No</th><th>DC No</th><th>Item</th>{mode==="stock"&&<><th>Colour</th><th>Size</th><th>Actual PCS</th><th>Delivered</th></>}<th>Balance PCS</th><th>Weight / Waste KG</th><th>Status</th><th>Aging</th></tr></thead><tbody>{filtered.map((row, index) => <tr key={row._id}><td>{index + 1}</td><td>{new Date(row.createdAt).toLocaleDateString()}</td><td>{row.planNo}</td><td>{row.dcNo}</td><td>{row.itemName || row.itemCode}</td>{mode==="stock"&&<><td>{row.colour}</td><td>{row.size}</td><td>{row.actualPcs}</td><td>{row.deliveredPcs}</td></>}<td>{row.balancePcs ?? row.totalActualPcs ?? row.totalPlannedPcs ?? "—"}</td><td>{row.wasteWeightKg ?? row.totalBundleWeightKg ?? row.totalWantedWeightKg ?? 0}</td><td>{row.status || (mode === "waste" ? "RECORDED" : "COMPLETE")}</td><td>{Math.max(0, Math.floor((Date.now() - new Date(row.createdAt)) / 86400000))} days</td></tr>)}</tbody></table></div></div>
  </section>;
}
