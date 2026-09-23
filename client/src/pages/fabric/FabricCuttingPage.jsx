import { useEffect, useRef, useState } from "react";
import { Download, Plus, Printer, Save, Search, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { exportCsv } from "../../api.js";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import CuttingActualMatrix from "./CuttingActualMatrix.jsx";
import { printElement } from "../../services/printService.js";

const emptyDetail = () => ({ dia: "", rollCount: "", weightKg: "" });
const emptyColour = () => ({ colour: "", details: [emptyDetail()] });
const emptyMaster = {
  fabricCode: "",
  fabricGroup: "",
  itemCode: "",
  itemName: "",
  compactingCode: "",
  compactingName: "",
  dyeingCode: "",
  dyeingName: "",
};

export default function FabricCuttingPage({ mode, notify }) {
  const pageRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [master, setMaster] = useState(emptyMaster);
  const [inward, setInward] = useState({
    inwardNo: "",
    sampleInwardNo: "",
    fabricCode: "",
    supplier: "",
    dcNo: "",
    lotNo: "",
    inwardDate: new Date().toISOString().slice(0, 10),
    colours: [emptyColour()],
  });
  const [detailIndex, setDetailIndex] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [plan, setPlan] = useState({
    planNo: "",
    dcNo: "",
    itemName: "",
    style: "",
    numberOfColours: 1,
    sizes: [{ size: "", pcs: "" }],
  });
  const [currentPlan, setCurrentPlan] = useState(null);
  const [issue, setIssue] = useState({
    inwardNo: "",
    colour: "",
    weightKg: "",
  });
  const [actual, setActual] = useState(null);
  const [elastic, setElastic] = useState(null);

  async function load() {
    setLoading(true);
    try {
      if (mode === "master") setRows(await api.masters({ search }));
      if (mode === "inward") setRows(await api.inwards({ inwardNo: search }));
      if (mode === "plan") setRows(await api.plans({ planNo: search }));
      if (mode === "actual") setRows(await api.actuals({ planNo: search }));
      if (mode === "waste") setRows(await api.waste());
    } catch (error) {
      notify?.(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [mode]);

  async function saveMaster(event) {
    event.preventDefault();
    await api.saveMaster(master);
    setMaster(emptyMaster);
    notify?.("Fabric Master saved");
    load();
  }

  async function lookupFabric() {
    try {
      const row = await api.master(inward.fabricCode);
      setMaster(row);
      setInward((value) => ({ ...value, fabricCode: row.fabricCode }));
      notify?.("Fabric code details loaded");
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function lookupSample() {
    try {
      const row = await api.inward(inward.sampleInwardNo);
      setMaster(row);
      setInward((value) => ({
        ...value,
        fabricCode: row.fabricCode,
        supplier: row.supplier,
        dcNo: row.dcNo,
        colours: row.colours.map((item) => ({
          colour: item.colour,
          details: item.details.map((detail) => ({
            dia: detail.dia,
            rollCount: detail.totalRolls || detail.sampleRolls || detail.lotRolls || "",
            weightKg: detail.totalWeightKg || detail.sampleWeightKg || detail.lotWeightKg || "",
          })),
        })),
      }));
      notify?.("Sample inward details loaded");
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function saveInward(event) {
    event.preventDefault();
    const saved = await api.saveInward(inward, inward._id);
    setBundles(await api.bundles(saved.inwardNo));
    notify?.("Colour-wise Fabric Inward saved");
    setInward({
      inwardNo: "",
      sampleInwardNo: "",
      fabricCode: "",
      supplier: "",
      dcNo: "",
      lotNo: "",
      inwardDate: new Date().toISOString().slice(0, 10),
      colours: [emptyColour()],
    });
    load();
  }

  async function savePlan(event) {
    event.preventDefault();
    const row = await api.savePlan(plan);
    setCurrentPlan(row);
    notify?.("Cutting plan generated: " + row.planNo);
    load();
  }

  async function findPlan() {
    try {
      const row = await api.plan(search);
      setCurrentPlan(row);
      const existing = (await api.actuals({ planNo: row.planNo }))[0];
      setActual(existing || {
        planNo: row.planNo,
        status: "COMPLETED",
        remarks: "",
        lines: row.colours.flatMap((colour) =>
          colour.sizes.map((size) => ({
            colour: colour.colour,
            size: size.size,
            dia: size.dia || "",
            plannedPcs: size.plannedPcs,
            pieceWeightKg: size.cuttingWeightPerPieceKg,
            plannedWeightKg: size.wantedWeightKg,
            actualPcs: size.plannedPcs,
            bundleCount: "",
            bundleWeightKg: "",
          })),
        ),
      });
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function saveActual(event) {
    event.preventDefault();
    const row = await api.saveActual(actual);
    setActual(row);
    notify?.("Cutting saved. Waste: " + row.wasteWeightKg + " KG");
    load();
  }

  async function issueFabric(event) {
    event.preventDefault();
    try {
      const row = await api.issue(currentPlan.planNo, issue);
      setCurrentPlan(row);
      setIssue({ inwardNo: "", colour: "", weightKg: "" });
      notify?.("Fabric issued and inward balance updated");
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function findElastic() {
    try {
      setElastic(await api.elastic(search));
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function downloadPdf() {
    const target =
      mode === "actual"
        ? document.getElementById("cutting-actual-print")
        : mode === "elastic"
          ? document.getElementById("elastic-requirement-print")
          : document.querySelector(".print-document") || pageRef.current;
    if (!target) return;
    notify?.("Preparing PDF...");
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      await pdf.html(target, {
        x: 8,
        y: 8,
        width: 281,
        windowWidth: Math.max(1100, target.scrollWidth),
        autoPaging: "text",
      });
      pdf.save(
        `${mode}-${search || new Date().toISOString().slice(0, 10)}.pdf`,
      );
      notify?.("PDF downloaded");
    } catch (error) {
      notify?.(error.message || "PDF download failed");
    }
  }

  function exportRows() {
    if (mode === "actual") return actual?.lines || [];
    if (mode === "elastic") return elastic?.lines || [];
    if (mode !== "waste") return rows;

    return rows.flatMap((row) =>
      row.lines?.length
        ? row.lines.map((line) => ({
            wasteNo: row.wasteNo,
            planNo: row.planNo,
            dcNo: row.dcNo,
            colour: line.colour,
            size: line.size,
            dia: line.dia,
            actualPcs: line.actualPcs,
            actualWeightKg: line.actualWeightKg,
            bundleWeightKg: line.bundleWeightKg,
            wasteWeightKg: line.wasteWeightKg,
          }))
        : [row],
    );
  }

  const titles = {
    master: "Fabric Master",
    inward: "Fabric Inward",
    plan: "Fabric Cutting Plan",
    actual: "Cutting Actual",
    elastic: "Elastic Requirement",
    waste: "Fabric Waste Warehouse",
  };

  return (
    <section className="fabric-flow professional-flow" ref={pageRef}>
      <div className="page-title">
        <div>
          <small>PLAN / DC TRACEABILITY</small>
          <h2>{titles[mode]}</h2>
          <p>
            Fabric → Cutting Actual → Elastic requirement in one controlled
            flow.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="secondary"
            disabled={
              mode === "actual"
                ? !actual
                : mode === "elastic"
                  ? !elastic
                  : false
            }
            onClick={() =>
              printElement(
                mode === "actual"
                  ? "cutting-actual-print"
                  : mode === "elastic"
                    ? "elastic-requirement-print"
                    : "department-report-print",
              )
            }
          >
            <Printer />
            Print
          </button>
          <button
            className="secondary"
            disabled={
              mode === "actual"
                ? !actual
                : mode === "elastic"
                  ? !elastic
                  : !rows.length
            }
            onClick={() => exportCsv(mode + ".csv", exportRows())}
          >
            <Download />
            Excel
          </button>
          <button
            className="secondary"
            disabled={
              mode === "actual"
                ? !actual
                : mode === "elastic"
                  ? !elastic
                  : !rows.length
            }
            onClick={downloadPdf}
          >
            <Download />
            PDF
          </button>
        </div>
      </div>

      {mode === "master" && (
        <form className="card garment-entry" onSubmit={saveMaster}>
          <h3>Fabric and Process Mapping</h3>
          <div className="form-grid">
            {Object.keys(emptyMaster).map((key) => (
              <label key={key}>
                {fieldLabel(key)}
                <input
                  required={[
                    "fabricCode",
                    "fabricGroup",
                    "itemCode",
                    "itemName",
                  ].includes(key)}
                  value={master[key] || ""}
                  onChange={(event) =>
                    setMaster({ ...master, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <button>
            <Save />
            Save Master
          </button>
        </form>
      )}

      {mode === "inward" && (
        <form className="card garment-entry" onSubmit={saveInward}>
          <h3>Colour-wise Fabric Receipt</h3>
          <div className="form-grid">
            <label>
              Inward No
              <input
                placeholder="Auto generated if blank"
                value={inward.inwardNo}
                onChange={(e) =>
                  setInward({ ...inward, inwardNo: e.target.value })
                }
              />
            </label>
            <label>
              Sample Inward No
              <div className="input-action">
                <input
                  value={inward.sampleInwardNo}
                  onChange={(e) =>
                    setInward({ ...inward, sampleInwardNo: e.target.value })
                  }
                />
                <button type="button" onClick={lookupSample}>
                  <Search />
                </button>
              </div>
            </label>
            <label>
              Fabric Code
              <div className="input-action">
                <input
                  required
                  value={inward.fabricCode}
                  onChange={(e) =>
                    setInward({ ...inward, fabricCode: e.target.value })
                  }
                />
                <button type="button" onClick={lookupFabric}>
                  <Search />
                </button>
              </div>
            </label>
            <label>
              Fabric Group
              <input readOnly value={master.fabricGroup || ""} />
            </label>
            <label>
              Item Name
              <input readOnly value={master.itemName || ""} />
            </label>
            <label>
              Supplier
              <input
                value={inward.supplier}
                onChange={(e) =>
                  setInward({ ...inward, supplier: e.target.value })
                }
              />
            </label>
            <label>
              Supplier DC
              <input
                value={inward.dcNo}
                onChange={(e) => setInward({ ...inward, dcNo: e.target.value })}
              />
            </label>
            <label>
              Inward Date
              <input
                type="date"
                required
                value={inward.inwardDate}
                onChange={(e) =>
                  setInward({ ...inward, inwardDate: e.target.value })
                }
              />
            </label>
          </div>
          <div className="colour-entry-list">
            {inward.colours.map((row, index) => (
              <div key={index} className="colour-entry-row">
                <b>Colour {index + 1}</b>
                <input
                  required
                  placeholder="Colour name"
                  value={row.colour}
                  onChange={(e) =>
                    setInward({
                      ...inward,
                      colours: inward.colours.map((item, i) =>
                        i === index
                          ? { ...item, colour: e.target.value }
                          : item,
                      ),
                    })
                  }
                />
                <button type="button" onClick={() => setDetailIndex(index)}>
                  Colour Details ({row.details.length})
                </button>
                {inward.colours.length > 1 && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setInward({
                        ...inward,
                        colours: inward.colours.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setInward({
                ...inward,
                colours: [...inward.colours, emptyColour()],
              })
            }
          >
            <Plus />
            Add Colour
          </button>
          <button>
            <Save />
            Save Inward
          </button>
        </form>
      )}

      {detailIndex !== null && (
        <ColourDetails
          row={inward.colours[detailIndex]}
          update={(row) =>
            setInward({
              ...inward,
              colours: inward.colours.map((item, i) =>
                i === detailIndex ? row : item,
              ),
            })
          }
          close={() => setDetailIndex(null)}
        />
      )}

      {mode === "inward" && bundles.length > 0 && (
        <div className="card bundle-print-sheet">
          <div className="bundle-print-heading">
            <div>
              <small>FABRIC ROLL LABELS</small>
              <h3>{bundles[0].inwardNo}</h3>
            </div>
            <button onClick={() => window.print()}>
              <Printer />
              Print All QR
            </button>
          </div>
          <div className="bundle-label-grid">
            {bundles.map((bundle) => (
              <article key={bundle._id}>
                <QRGenerator value={bundle.qrToken} size={120} />
                <b>{bundle.bundleNo}</b>
                <span>
                  {bundle.fabricCode} · {bundle.colour}
                </span>
                <span>Dia: {bundle.dia}</span>
                <strong>{bundle.originalWeightKg} KG</strong>
                {bundle.provisionalWeight && <small>PROVISIONAL WEIGHT</small>}
              </article>
            ))}
          </div>
        </div>
      )}

      {mode === "plan" && (
        <form className="card garment-entry" onSubmit={savePlan}>
          <h3>Generate Colour and Size Plan</h3>
          <div className="form-grid">
            {["planNo", "dcNo", "itemName", "style"].map((key) => (
              <label key={key}>
                {fieldLabel(key)}
                <input
                  required={["itemName", "style"].includes(key)}
                  placeholder={key.includes("No") ? "Auto if blank" : ""}
                  value={plan[key]}
                  onChange={(e) => setPlan({ ...plan, [key]: e.target.value })}
                />
              </label>
            ))}
            <label>
              Total Colours
              <input
                type="number"
                min="1"
                required
                value={plan.numberOfColours}
                onChange={(e) =>
                  setPlan({ ...plan, numberOfColours: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <SizeRows
            rows={plan.sizes}
            setRows={(sizes) => setPlan({ ...plan, sizes })}
          />
          <button>
            <Save />
            Generate Plan
          </button>
        </form>
      )}

      {mode === "plan" && currentPlan && (
        <form className="card garment-entry" onSubmit={issueFabric}>
          <PlanHeader plan={currentPlan} />
          <div className="issue-summary">
            <span>
              <small>Wanted Fabric</small>
              <b>{currentPlan.totalWantedWeightKg} KG</b>
            </span>
            <span>
              <small>Issued Fabric</small>
              <b>{currentPlan.issuedWeightKg} KG</b>
            </span>
            <span>
              <small>Balance To Issue</small>
              <b>
                {Math.max(
                  0,
                  currentPlan.totalWantedWeightKg - currentPlan.issuedWeightKg,
                ).toFixed(3)}{" "}
                KG
              </b>
            </span>
          </div>
          <h3>Scan / Enter Inward and Issue Fabric</h3>
          <div className="form-grid">
            <label>
              Inward No
              <input
                required
                value={issue.inwardNo}
                onChange={(e) =>
                  setIssue({ ...issue, inwardNo: e.target.value })
                }
              />
            </label>
            <label>
              Colour
              <select
                required
                value={issue.colour}
                onChange={(e) => setIssue({ ...issue, colour: e.target.value })}
              >
                <option value="">Select colour</option>
                {currentPlan.colours.map((item) => (
                  <option key={item.colour}>{item.colour}</option>
                ))}
              </select>
            </label>
            <label>
              Issue Weight KG
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={issue.weightKg}
                onChange={(e) =>
                  setIssue({ ...issue, weightKg: e.target.value })
                }
              />
            </label>
          </div>
          <button>
            <Save />
            Issue Fabric
          </button>
        </form>
      )}

      {["actual", "elastic"].includes(mode) && (
        <div className="card professional-lookup-card">
          <label>
            <span>Plan No / DC No</span>
            <div className="input-action">
              <input
                placeholder="Enter 4-digit Plan No or DC No"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (mode === "actual" ? findPlan() : findElastic())
                }
              />
              <button
                className="primary"
                onClick={mode === "actual" ? findPlan : findElastic}
              >
                <Search /> Load {mode === "actual" ? "Plan" : "Requirement"}
              </button>
            </div>
          </label>
        </div>
      )}

      {mode === "actual" && actual && (
        <CuttingActualMatrix
          plan={currentPlan}
          actual={actual}
          setActual={setActual}
          submit={saveActual}
        />
      )}

      {mode === "elastic" && elastic && (
        <div
          id="elastic-requirement-print"
          className="card print-document professional-document"
        >
          <PlanHeader plan={elastic} />
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Colour</th>
                <th>Size</th>
                <th>Actual Cutting PCS</th>
                <th>Elastic Measurement</th>
                <th>Wanted MTR</th>
              </tr>
            </thead>
            <tbody>
              {elastic.lines.map((line, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{line.colour}</td>
                  <td>{line.size}</td>
                  <td>{line.actualPcs}</td>
                  <td>{line.elasticMeasurement}</td>
                  <td>{line.wantedMtr}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3">Total</td>
                <td>{elastic.totalPcs}</td>
                <td />
                <td>{elastic.totalWantedMtr} MTR</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {mode === "waste" && <WasteReport rows={rows} loading={loading} />}

      {!["actual", "elastic", "waste"].includes(mode) && (
        <DataList
          rows={rows}
          loading={loading}
          search={search}
          setSearch={setSearch}
          load={load}
        />
      )}
    </section>
  );
}

function ColourDetails({ row, update, close }) {
  return (
    <div className="modal-backdrop">
      <div className="card colour-detail-modal">
        <div className="modal-title">
          <h3>{row.colour || "Colour"} Details</h3>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Roll Count</th>
              <th>Weight KG</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {row.details.map((line, index) => (
              <tr key={index}>
                {["dia", "rollCount", "weightKg"].map((key) => (
                  <td key={key}>
                    <input
                      type={key === "dia" ? "text" : "number"}
                      min="0"
                      step={key === "weightKg" ? "0.001" : "1"}
                      required
                      value={line[key]}
                      onChange={(e) =>
                        update({
                          ...row,
                          details: row.details.map((item, i) =>
                            i === index
                              ? { ...item, [key]: e.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    className="danger"
                    onClick={() =>
                      update({
                        ...row,
                        details: row.details.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={() =>
            update({ ...row, details: [...row.details, emptyDetail()] })
          }
        >
          <Plus />
          Add Dia / Roll
        </button>
        <button className="secondary" onClick={close}>
          Done
        </button>
      </div>
    </div>
  );
}

function SizeRows({ rows, setRows }) {
  return (
    <div className="size-plan">
      <h4>Sizes and Total PCS</h4>
      {rows.map((row, index) => (
        <div key={index}>
          <input
            required
            placeholder="Size"
            value={row.size}
            onChange={(e) =>
              setRows(
                rows.map((item, i) =>
                  i === index ? { ...item, size: e.target.value } : item,
                ),
              )
            }
          />
          <input
            required
            type="number"
            min="1"
            placeholder="PCS"
            value={row.pcs}
            onChange={(e) =>
              setRows(
                rows.map((item, i) =>
                  i === index ? { ...item, pcs: e.target.value } : item,
                ),
              )
            }
          />
          {rows.length > 1 && (
            <button
              type="button"
              className="danger"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              <X />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() => setRows([...rows, { size: "", pcs: "" }])}
      >
        <Plus />
        Add Size
      </button>
    </div>
  );
}

function WasteReport({ rows, loading }) {
  const lines = rows.flatMap((row) =>
    row.lines?.length
      ? row.lines.map((line) => ({ ...line, ...row, ...line }))
      : [row],
  );

  return (
    <div
      id="department-report-print"
      className="card print-document report-print-document"
    >
      <div className="print-report-header">
        <small>UG SAAS · CUTTING</small>
        <h2>Fabric Waste Warehouse Report</h2>
        <p>Generated {new Date().toLocaleDateString()}</p>
      </div>
      {loading ? (
        <div className="loader-card">Loading waste data...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Plan No</th>
                <th>DC No</th>
                <th>Colour</th>
                <th>Size</th>
                <th>Dia</th>
                <th>Actual PCS</th>
                <th>Actual WT</th>
                <th>Bundle WT</th>
                <th>Waste WT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line._id || line.wasteNo}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{line.planNo || "-"}</td>
                  <td>{line.dcNo || "-"}</td>
                  <td>{line.colour || "-"}</td>
                  <td>{line.size || "-"}</td>
                  <td>{line.dia || "-"}</td>
                  <td>{line.actualPcs ?? "-"}</td>
                  <td>{Number(line.actualWeightKg || 0).toFixed(3)} KG</td>
                  <td>{Number(line.bundleWeightKg || 0).toFixed(3)} KG</td>
                  <td>{Number(line.wasteWeightKg || 0).toFixed(3)} KG</td>
                </tr>
              ))}
            </tbody>
            {!!lines.length && (
              <tfoot>
                <tr>
                  <td colSpan="7">Total</td>
                  <td>
                    {lines
                      .reduce(
                        (sum, line) => sum + Number(line.actualWeightKg || 0),
                        0,
                      )
                      .toFixed(3)}{" "}
                    KG
                  </td>
                  <td>
                    {lines
                      .reduce(
                        (sum, line) => sum + Number(line.bundleWeightKg || 0),
                        0,
                      )
                      .toFixed(3)}{" "}
                    KG
                  </td>
                  <td>
                    {lines
                      .reduce(
                        (sum, line) => sum + Number(line.wasteWeightKg || 0),
                        0,
                      )
                      .toFixed(3)}{" "}
                    KG
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {!lines.length && <p className="empty">No waste records found.</p>}
        </div>
      )}
    </div>
  );
}

function DataList({ rows, loading, search, setSearch, load }) {
  return (
    <div
      id="department-report-print"
      className="card print-document report-print-document"
    >
      <div className="print-report-header">
        <small>UG SAAS</small>
        <h2>Department Report</h2>
        <p>Generated {new Date().toLocaleDateString()}</p>
      </div>
      <div className="lookup-bar">
        <input
          placeholder="Search reference or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={load}>
          <Search />
          Search
        </button>
      </div>
      {loading ? (
        <div className="loader-card">Loading data...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Item / Fabric</th>
                <th>Group / Style</th>
                <th>Colour / Lot</th>
                <th>Quantity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>
                    {row.fabricCode ||
                      row.inwardNo ||
                      row.planNo ||
                      row.actualNo ||
                      row.wasteNo}
                  </td>
                  <td>{row.itemName || row.itemCode}</td>
                  <td>{row.fabricGroup || row.style}</td>
                  <td>
                    {row.lotNo ||
                      row.colours?.map((item) => item.colour).join(", ")}
                  </td>
                  <td>
                    {row.totalWeightKg ||
                      row.totalWantedWeightKg ||
                      row.totalActualPcs ||
                      row.wasteWeightKg ||
                      "-"}
                  </td>
                  <td>{row.status || (row.active ? "ACTIVE" : "INACTIVE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="empty">No records found.</p>}
        </div>
      )}
    </div>
  );
}

function PlanHeader({ plan }) {
  return (
    <div className="print-heading">
      <h3>Production Plan</h3>
      <div>
        <span>
          <small>Plan No</small>
          <b>{plan?.planNo}</b>
        </span>
        <span>
          <small>DC No</small>
          <b>{plan?.dcNo}</b>
        </span>
        <span>
          <small>Item</small>
          <b>{plan?.itemName}</b>
        </span>
        <span>
          <small>Style</small>
          <b>{plan?.style}</b>
        </span>
      </div>
    </div>
  );
}

function fieldLabel(value) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (item) => item.toUpperCase());
}
