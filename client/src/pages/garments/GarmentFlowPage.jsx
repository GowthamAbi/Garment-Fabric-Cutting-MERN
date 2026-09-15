import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Save } from "lucide-react";
import { exportCsv } from "../../api.js";
import { garmentApi } from "../../api/garmentApi.js";

const departments = ["FABRIC", "CUTTING", "ACCESSORIES", "ELASTIC", "STITCHING", "FINISHING", "PACKING", "DISPATCH"];
const movementTypes = ["INWARD", "OUTWARD", "PRODUCTION", "REWORK", "REJECTION", "WASTE", "DELIVERY"];
const today = new Date().toISOString().slice(0, 10);

const emptyMovement = (department) => ({ department, movementType: department === "DISPATCH" ? "DELIVERY" : department === "FABRIC" ? "INWARD" : "PRODUCTION", dcNo: "", poNo: "", itemName: "", style: "", fabricType: "", colour: "", size: "", quantity: "", unit: department === "FABRIC" ? "KG" : "PCS", machineCode: "", employeeCode: "", transactionDate: today, status: "COMPLETED", remarks: "" });

export default function GarmentFlowPage({ mode, department = "", notify }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", status: "", colour: "", dcNo: "" });
  const [form, setForm] = useState(emptyMovement(department || "FABRIC"));
  const [bomForm, setBomForm] = useState({ bomNo: "", itemName: "", brand: "", style: "", category: "", fabricType: "", colours: "", sizes: "", cuttingKg: "", foldingKg: "", status: "PENDING_APPROVAL" });
  const [poForm, setPoForm] = useState({ poNo: "", poDate: today, deliveryDate: "", buyer: "", itemName: "", style: "", bomNo: "", colour: "", sizes: "", quantities: "" });

  async function load() {
    setLoading(true);
    try {
      if (mode === "dashboard") setSummary(await garmentApi.dashboard());
      else if (mode === "bom") setRows(await garmentApi.boms(filters));
      else if (mode === "po") setRows(await garmentApi.pos(filters));
      else if (mode === "materials") setRows(await garmentApi.materialStatus(filters));
      else setRows(await garmentApi.movements({ ...filters, department }));
    } catch (error) { notify?.(error.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [mode, department]);

  async function submit(event) {
    event.preventDefault();
    try {
      await garmentApi.saveMovement(form);
      notify?.("Entry saved successfully");
      setForm(emptyMovement(department));
      await load();
    } catch (error) { notify?.(error.message); }
  }

  async function savePlanning(event) {
    event.preventDefault();
    try {
      if (mode === "bom") {
        const sizes = bomForm.sizes.split(",").map((size) => size.trim()).filter(Boolean);
        const cutting = bomForm.cuttingKg.split(",").map(Number);
        const folding = bomForm.foldingKg.split(",").map(Number);
        if (sizes.length !== cutting.length || sizes.length !== folding.length) throw new Error("Each size needs matching cutting and folding measurement");
        await garmentApi.saveBom({ ...bomForm, colours: bomForm.colours.split(","), sizes: sizes.map((size, index) => ({ size, cuttingKg: cutting[index], foldingKg: folding[index] })) });
        setBomForm({ bomNo: "", itemName: "", brand: "", style: "", category: "", fabricType: "", colours: "", sizes: "", cuttingKg: "", foldingKg: "", status: "PENDING_APPROVAL" });
      } else {
        const sizes = poForm.sizes.split(",").map((size) => size.trim()).filter(Boolean);
        const quantities = poForm.quantities.split(",").map(Number);
        if (sizes.length !== quantities.length) throw new Error("Each size needs one matching quantity");
        await garmentApi.savePo({ ...poForm, sizes: sizes.map((size, index) => ({ size, quantity: quantities[index] })) });
        setPoForm({ poNo: "", poDate: today, deliveryDate: "", buyer: "", itemName: "", style: "", bomNo: "", colour: "", sizes: "", quantities: "" });
      }
      notify?.(`${mode === "bom" ? "BOM" : "PO"} saved successfully`);
      await load();
    } catch (error) { notify?.(error.message); }
  }

  const title = mode === "dashboard" ? "Garment Production Dashboard" : mode === "bom" ? "Garment BOM" : mode === "po" ? "Garment PO Status" : mode === "materials" ? "Materials Status" : `${department[0]}${department.slice(1).toLowerCase()} Operations`;
  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.quantity || row.orderQty || row.wantedKg || 0), 0), [rows]);

  if (mode === "dashboard") return <section>
    <div className="page-title"><div><small>END TO END GARMENT FLOW</small><h2>{title}</h2><p>Fabric inward முதல் finished goods dispatch வரை ஒரே DC traceability.</p></div></div>
    {loading ? <div className="loader-card">Loading production dashboard...</div> : <>
      <div className="stats-grid">
        <article className="stat-card"><small>ORDER PCS</small><strong>{summary?.orderQty || 0}</strong></article>
        <article className="stat-card"><small>CUTTING PENDING</small><strong>{summary?.cuttingPending || 0}</strong></article>
        <article className="stat-card"><small>ACTIVE DEPARTMENTS</small><strong>{summary?.departments?.filter((row) => row.quantity > 0).length || 0}</strong></article>
      </div>
      <div className="card"><h3>Department Flow Status</h3><div className="table-wrap"><table><thead><tr><th>Department</th><th>Processed Qty</th><th>Pending / Hold</th><th>Status</th></tr></thead><tbody>{summary?.departments?.map((row) => <tr key={row.department}><td><b>{row.department}</b></td><td>{row.quantity}</td><td>{row.pending}</td><td><span className={row.pending ? "status danger" : "status success"}>{row.pending ? "ACTION NEEDED" : "ON TRACK"}</span></td></tr>)}</tbody></table></div></div>
    </>}
  </section>;

  if (["bom", "po"].includes(mode)) return <section>
    <div className="page-title"><div><small>GARMENT PLANNING</small><h2>{title}</h2><p>{mode === "bom" ? "Style, fabric, colours, sizes, measurements and accessories master." : "Date-range PO planning and cutting balance."}</p></div><button className="secondary" onClick={() => exportCsv(`${mode}-${today}.csv`, rows)}><Download />Excel</button></div>
    <form className="card garment-entry" onSubmit={savePlanning}><h3><Plus />New {mode === "bom" ? "BOM" : "Purchase Order"}</h3>{mode === "bom" ? <div className="form-grid">
      <label>BOM No<input required value={bomForm.bomNo} onChange={(e) => setBomForm({ ...bomForm, bomNo: e.target.value })} /></label><label>Item Name<input required value={bomForm.itemName} onChange={(e) => setBomForm({ ...bomForm, itemName: e.target.value })} /></label><label>Brand<input value={bomForm.brand} onChange={(e) => setBomForm({ ...bomForm, brand: e.target.value })} /></label><label>Style<input required value={bomForm.style} onChange={(e) => setBomForm({ ...bomForm, style: e.target.value })} /></label><label>Fabric Type<input required value={bomForm.fabricType} onChange={(e) => setBomForm({ ...bomForm, fabricType: e.target.value })} /></label><label>Colours (comma separated)<input required placeholder="NAVY, RED, WHITE" value={bomForm.colours} onChange={(e) => setBomForm({ ...bomForm, colours: e.target.value })} /></label><label>Sizes (same sequence)<input required placeholder="85, 90, 95" value={bomForm.sizes} onChange={(e) => setBomForm({ ...bomForm, sizes: e.target.value })} /></label><label>Cutting KG (same sequence)<input required placeholder="0.084, 0.090, 0.096" value={bomForm.cuttingKg} onChange={(e) => setBomForm({ ...bomForm, cuttingKg: e.target.value })} /></label><label>Folding KG (same sequence)<input required placeholder="0.010, 0.010, 0.010" value={bomForm.foldingKg} onChange={(e) => setBomForm({ ...bomForm, foldingKg: e.target.value })} /></label>
    </div> : <div className="form-grid"><label>PO No<input required value={poForm.poNo} onChange={(e) => setPoForm({ ...poForm, poNo: e.target.value })} /></label><label>PO Date<input type="date" required value={poForm.poDate} onChange={(e) => setPoForm({ ...poForm, poDate: e.target.value })} /></label><label>Delivery Date<input type="date" value={poForm.deliveryDate} onChange={(e) => setPoForm({ ...poForm, deliveryDate: e.target.value })} /></label><label>Buyer<input value={poForm.buyer} onChange={(e) => setPoForm({ ...poForm, buyer: e.target.value })} /></label><label>Item Name<input required value={poForm.itemName} onChange={(e) => setPoForm({ ...poForm, itemName: e.target.value })} /></label><label>Style<input required value={poForm.style} onChange={(e) => setPoForm({ ...poForm, style: e.target.value })} /></label><label>BOM No<input required value={poForm.bomNo} onChange={(e) => setPoForm({ ...poForm, bomNo: e.target.value })} /></label><label>Colour<input required value={poForm.colour} onChange={(e) => setPoForm({ ...poForm, colour: e.target.value })} /></label><label>Sizes (comma separated)<input required placeholder="85, 90, 95" value={poForm.sizes} onChange={(e) => setPoForm({ ...poForm, sizes: e.target.value })} /></label><label>PCS (same sequence)<input required placeholder="100, 110, 120" value={poForm.quantities} onChange={(e) => setPoForm({ ...poForm, quantities: e.target.value })} /></label></div>}<button type="submit"><Save />Save {mode === "bom" ? "BOM" : "PO"}</button></form>
    <FilterBar filters={filters} setFilters={setFilters} load={load} />
    {loading ? <div className="loader-card">Loading data...</div> : <div className="card table-wrap"><table><thead><tr>{mode === "bom" ? <><th>BOM No</th><th>Item / Style</th><th>Fabric</th><th>Colours</th><th>Sizes</th><th>Status</th></> : <><th>PO No</th><th>Date</th><th>Item / Style</th><th>Colour</th><th>Order</th><th>Cut</th><th>Pending</th><th>Status</th></>}</tr></thead><tbody>{rows.map((row) => mode === "bom" ? <tr key={row._id}><td>{row.bomNo}</td><td>{row.itemName}<small>{row.style}</small></td><td>{row.fabricType}</td><td>{row.colours?.map((x) => x.name).join(", ")}</td><td>{row.sizes?.map((x) => x.size).join(", ")}</td><td>{row.status}</td></tr> : <tr key={row._id}><td>{row.poNo}</td><td>{String(row.poDate).slice(0, 10)}</td><td>{row.itemName}<small>{row.style}</small></td><td>{row.colour}</td><td>{row.orderQty}</td><td>{row.cuttingCompletedQty}</td><td>{Math.max(0, row.orderQty - row.cuttingCompletedQty)}</td><td>{row.status}</td></tr>)}</tbody></table>{!rows.length && <p className="empty">No records found.</p>}</div>}
  </section>;

  if (mode === "materials") return <section><div className="page-title"><div><small>BOM CALCULATION</small><h2>{title}</h2><p>Wanted KG = PO PCS × (Cutting KG + Folding KG) ÷ Colour Count</p></div><button className="secondary" onClick={() => exportCsv(`materials-${today}.csv`, rows)}><Download />Excel</button></div><FilterBar filters={filters} setFilters={setFilters} load={load} />{loading ? <div className="loader-card">Calculating material status...</div> : <div className="card table-wrap"><table><thead><tr><th>Fabric Type</th><th>Colour</th><th>Wanted KG</th><th>Stock KG</th><th>Balance KG</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.fabricType}-${row.colour}`}><td>{row.fabricType}</td><td>{row.colour}</td><td>{row.wantedKg}</td><td>{row.stockKg}</td><td className={row.balanceKg < 0 ? "negative" : "positive"}>{row.balanceKg}</td><td>{row.status}</td></tr>)}</tbody></table></div>}</section>;

  return <section>
    <div className="page-title"><div><small>DC + STYLE + COLOUR + SIZE TRACEABILITY</small><h2>{title}</h2><p>Every save creates a tenant-separated audit transaction.</p></div><button className="secondary" onClick={() => exportCsv(`${department.toLowerCase()}-${today}.csv`, rows)}><Download />Excel</button></div>
    <form className="card garment-entry" onSubmit={submit}><h3><Plus />New {department} Entry</h3><div className="form-grid">
      <label>Movement<select value={form.movementType} onChange={(e) => setForm({ ...form, movementType: e.target.value })}>{movementTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>DC No<input required value={form.dcNo} onChange={(e) => setForm({ ...form, dcNo: e.target.value })} /></label>
      <label>PO No<input value={form.poNo} onChange={(e) => setForm({ ...form, poNo: e.target.value })} /></label>
      <label>Item Name<input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} /></label>
      <label>Style<input required value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} /></label>
      <label>Colour<input required value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} /></label>
      <label>Size<input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></label>
      <label>Quantity<input type="number" min="0.001" step="0.001" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
      <label>Unit<select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option>PCS</option><option>KG</option><option>MTR</option><option>ROLL</option></select></label>
      <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>COMPLETED</option><option>PARTIAL</option><option>PENDING</option><option>RUNNING</option><option>HOLD</option></select></label>
    </div><label>Remarks<textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label><button type="submit"><Save />Save Entry</button></form>
    <FilterBar filters={filters} setFilters={setFilters} load={load} />
    {loading ? <div className="loader-card">Loading {department.toLowerCase()} data...</div> : <div className="card table-wrap"><table><thead><tr><th>Reference</th><th>Date</th><th>DC / PO</th><th>Item / Style</th><th>Colour / Size</th><th>Movement</th><th>Quantity</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.referenceNo}</td><td>{String(row.transactionDate).slice(0, 10)}</td><td>{row.dcNo}<small>{row.poNo}</small></td><td>{row.itemName}<small>{row.style}</small></td><td>{row.colour}<small>{row.size}</small></td><td>{row.movementType}</td><td>{row.quantity} {row.unit}</td><td>{row.status}</td></tr>)}</tbody><tfoot><tr><td colSpan="6">Total</td><td>{total}</td><td /></tr></tfoot></table>{!rows.length && <p className="empty">No records found.</p>}</div>}
  </section>;
}

function FilterBar({ filters, setFilters, load }) {
  return <div className="card report-filter"><label>From<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label><label>To<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label><label>DC No<input value={filters.dcNo} onChange={(e) => setFilters({ ...filters, dcNo: e.target.value })} /></label><label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All</option><option>PENDING</option><option>RUNNING</option><option>PARTIAL</option><option>COMPLETED</option><option>HOLD</option></select></label><button onClick={load}>Apply Filters</button></div>;
}
