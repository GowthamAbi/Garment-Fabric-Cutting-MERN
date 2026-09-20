import { useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { exportCsv } from "../../api.js";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";

export default function FabricStockPage({ notify, mode = "summary" }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    api
      [mode === "balance" ? "fabricBalance" : "fabricStock"]()
      .then(setRows)
      .catch((error) => notify?.(error.message));
  }, []);
  const filtered = rows.filter((row) =>
    `${row.fabricGroup} ${row.fabricName || ""} ${row.inwardNo || ""} ${row.colour} ${row.dia} ${(row.fabricCodes || []).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function pdf() {
    const file = new jsPDF({ unit: "mm", format: "a4" });
    await file.html(ref.current, {
      x: 8,
      y: 8,
      width: 194,
      windowWidth: 1100,
      autoPaging: "text",
    });
    file.save("fabric-stock.pdf");
  }
  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>FABRIC DEPARTMENT</small>
          <h2>{mode === "balance" ? "Fabric Balance Stock" : "Fabric Stock"}</h2>
          <p>Inward minus Production Plan and Folding batch consumption.</p>
        </div>
        <div className="page-actions">
          <button onClick={() => exportCsv("fabric-stock.csv", filtered)}>
            <Download /> Excel
          </button>
          <button onClick={() => window.print()}>
            <Printer /> Print
          </button>
          <button onClick={pdf}>
            <Download /> PDF
          </button>
        </div>
      </div>
      <div className="classic-card">
        <input
          placeholder="Search fabric group, code or colour"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <article className="production-plan-document print-document" ref={ref}>
        <header>
          <small>FABRIC STOCK REPORT</small>
          <h1>Available Fabric Stock</h1>
          <p>{new Date().toLocaleDateString()}</p>
        </header>
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Fabric Group</th>
              {mode === "balance" ? <><th>Fabric Name</th><th>Inward No</th></> : <th>Fabric Code</th>}
              <th>Colour</th>
              <th>Dia</th>
              <th>Roll</th><th>Inward KG</th><th>Balance KG</th><th>Aging</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr key={`${row.fabricGroup}-${row.colour}-${row.dia}`}>
                <td>{index + 1}</td>
                <td>{row.fabricGroup}</td>
                {mode === "balance" ? <><td>{row.fabricName}</td><td>{row.inwardNo}</td></> : <td>{(row.fabricCodes || []).join(", ")}</td>}
                <td>{row.colour}</td>
                <td>{row.dia}</td>
                <td>{row.rolls ?? "—"}</td><td>{row.inwardWeightKg ?? row.grossWeightKg}</td><td>{row.balanceWeightKg ?? row.availableWeightKg}</td><td>{row.inwardDate ? Math.max(0, Math.floor((Date.now() - new Date(row.inwardDate)) / 86400000)) + " days" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt-signatures">
          <span>Prepared By</span>
          <span>Checked By</span>
          <span>Authorized By</span>
        </div>
      </article>
    </section>
  );
}
