import { useEffect, useRef, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth } from "../../context/AuthContext.jsx";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import ProductionPlanDocument from "./ProductionPlanDocument.jsx";
import { exportCsv } from "../../api.js";
import { printElement } from "../../services/printService.js";

export default function DepartmentRecordPage({ mode, notify, departmentType }) {
  const { user } = useAuth();
  const department = departmentType || user?.department ||
    (user?.role?.startsWith("fabric") ? "FABRIC" : "CUTTING");
  const [rows, setRows] = useState([]);
  const [number, setNumber] = useState("");
  const [record, setRecord] = useState(null);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const ref = useRef(null);
  async function load() {
    try {
      setRows(
        department === "FABRIC"
          ? await api.inwards(filters)
          : await api.plans(),
      );
    } catch (error) {
      notify?.(error.message);
    }
  }
  useEffect(() => {
    if (mode === "history") load();
  }, [department, mode]);
  async function find() {
    try {
      setRecord(
        department === "FABRIC"
          ? await api.inward(number)
          : await api.plan(number),
      );
    } catch (error) {
      setRecord(null);
      notify?.(error.message);
    }
  }
  async function pdf() {
    if (!ref.current) return;
    const file = new jsPDF({ unit: "mm", format: "a4" });
    await file.html(ref.current, {
      x: 8,
      y: 8,
      width: 194,
      windowWidth: 1100,
      autoPaging: "text",
    });
    file.save(`${number}-record.pdf`);
  }
  if (mode === "history")
    {
    const displayRows = department === "FABRIC"
      ? rows.flatMap((row) => row.colours.flatMap((colour) => colour.details.map((line) => ({
          ...line, _id: `${row._id}-${colour.colour}-${line._id || line.dia}`, inwardDate: row.inwardDate,
          inwardNo: row.inwardNo, fabricName: row.fabricName, fabricGroup: row.fabricGroup,
          colour: colour.colour, aging: Math.max(0, Math.floor((Date.now() - new Date(row.inwardDate)) / 86400000)),
        }))))
      : rows;
    return (
      <section className="classic-page">
        <div className="classic-title">
          <div>
            <small>{department} DEPARTMENT</small>
            <h2>History</h2>
            <p>Date range and unique reference records.</p>
          </div>
          <div className="page-actions"><button onClick={() => exportCsv(`${department.toLowerCase()}-history.csv`, displayRows)}><Download /> Download History</button></div>
        </div>
        <div className="classic-card">
          <div className="filter-panel">
            <label>
              From
              <input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value })
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </label>
            <button onClick={load}>
              <Search /> Apply
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date</th>
                  {department === "FABRIC" ? <><th>Inward No</th><th>Fabric Name</th><th>Group</th><th>Colour</th><th>Roll</th><th>Dia</th><th>WT</th><th>Aging</th></> : <><th>Plan No</th><th>DC No</th><th>Item</th><th>Status</th><th>Aging</th></>}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => (
                  <tr key={row._id}>
                    <td>{index + 1}</td>
                    <td>
                      {new Date(
                        row.inwardDate || row.createdAt,
                      ).toLocaleDateString()}
                    </td>
                    {department === "FABRIC" ? <><td>{row.inwardNo}</td><td>{row.fabricName}</td><td>{row.fabricGroup}</td><td>{row.colour}</td><td>{row.totalRolls}</td><td>{row.dia}</td><td>{row.totalWeightKg} KG</td><td>{row.aging} days</td></> : <><td>{row.planNo}</td><td>{row.dcNo || "—"}</td><td>{row.itemName}</td><td>{row.status}</td><td>{Math.max(0, Math.floor((Date.now() - new Date(row.createdAt)) / 86400000))} days</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
    }
  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>{department} DEPARTMENT</small>
          <h2>Print</h2>
          <p>
            History unique number மூலம் A4 record view, print அல்லது PDF
            download.
          </p>
        </div>
      </div>
      <div className="classic-card print-search">
        <label>
          <span>
            {department === "FABRIC" ? "Inward No" : "Plan No / DC No"}
          </span>
          <div className="input-action">
            <input value={number} onChange={(e) => setNumber(e.target.value)} />
            <button onClick={find}>
              <Search />
            </button>
          </div>
        </label>
        {record && (
          <div className="form-actions">
            <button onClick={() => printElement("department-record-print")}>
              <Printer /> Print
            </button>
            <button onClick={pdf}>
              <Download /> PDF
            </button>
          </div>
        )}
      </div>
      <div id="department-record-print">{record &&
        (department === "CUTTING" ? (
          <ProductionPlanDocument plan={record} documentRef={ref} />
        ) : (
          <FabricRecord record={record} documentRef={ref} />
        ))}</div>
    </section>
  );
}

function FabricRecord({ record, documentRef }) {
  return (
    <article
      className="production-plan-document print-document"
      ref={documentRef}
    >
      <header>
        <small>FABRIC INWARD RECEIPT</small>
        <h1>{record.fabricName}</h1>
        <p>{record.inwardNo}</p>
      </header>
      <div className="plan-document-meta">
        <span>
          <small>Fabric Group</small>
          <b>{record.fabricGroup}</b>
        </span>
        <span>
          <small>DC No</small>
          <b>{record.dcNo}</b>
        </span>
        <span>
          <small>Lot DC No</small>
          <b>{record.lotDcNo || "—"}</b>
        </span>
        <span>
          <small>Dyeing</small>
          <b>{record.dyeingName || "—"}</b>
        </span>
        <span>
          <small>Compacting</small>
          <b>{record.compactingName || "—"}</b>
        </span>
        <span>
          <small>Date</small>
          <b>{new Date(record.inwardDate).toLocaleDateString()}</b>
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Colour</th>
            <th>Dia</th>
            <th className="sample-col">Sample Rolls</th>
            <th className="sample-col">Sample KG</th>
            <th>Lot Rolls</th>
            <th>Lot KG</th>
          </tr>
        </thead>
        <tbody>
          {record.colours
            .flatMap((colour) =>
              colour.details.map((line) => ({
                ...line,
                colour: colour.colour,
              })),
            )
            .map((line, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{line.colour}</td>
                <td>{line.dia}</td>
                <td>{line.sampleRolls}</td>
                <td>{line.sampleWeightKg}</td>
                <td>{line.lotRolls}</td>
                <td>{line.lotWeightKg}</td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3">TOTAL</td>
            <td>{record.totalSampleRolls}</td>
            <td>{record.totalSampleWeightKg}</td>
            <td>{record.totalLotRolls}</td>
            <td>{record.totalLotWeightKg}</td>
          </tr>
        </tfoot>
      </table>
      <div className="receipt-signatures">
        <span>Prepared By</span>
        <span>Checked By</span>
        <span>Authorized By</span>
      </div>
    </article>
  );
}
