import { useEffect, useRef, useState } from "react";
import {
  Download,
  Edit3,
  Filter,
  Plus,
  Printer,
  Save,
  Search,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth } from "../../context/AuthContext.jsx";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import QRGenerator from "../../components/qr/QRGenerator.jsx";

const detail = () => ({
  dia: "",
  sampleRolls: "",
  sampleWeightKg: "",
  lotRolls: "",
  lotWeightKg: "",
});
const colour = () => ({ colour: "", details: [detail()] });
const blank = () => ({
  inwardNo: "",
  sampleInwardNo: "",
  inwardType: "LOT",
  fabricCode: "",
  fabricName: "",
  fabricGroup: "",
  dcNo: "",
  lotDcNo: "",
  compactingCode: "",
  compactingName: "",
  dyeingCode: "",
  dyeingName: "",
  inwardDate: new Date().toISOString().slice(0, 10),
  colours: [colour()],
});

export default function FabricInwardPage({ notify }) {
  const { user } = useAuth();
  const canEnter =
    [
      "saas_super_admin",
      "admin",
      "fabric_admin",
      "fabric_entry",
      "department_entry",
    ].includes(user?.role) &&
    (!user?.department || user.department === "FABRIC");
  const [form, setForm] = useState(blank());
  const [rows, setRows] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailIndex, setDetailIndex] = useState(null);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    inwardNo: "",
    dcNo: "",
    lotDcNo: "",
    fabricCode: "",
    inwardType: "",
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const receiptRef = useRef(null);

  async function load() {
    setRows(await api.inwards(filters));
  }
  useEffect(() => {
    load();
  }, []);
  async function lookupFabric() {
    const row = await api.master(form.fabricCode);
    setForm({
      ...form,
      fabricCode: row.fabricCode,
      fabricName: row.fabricName,
      fabricGroup: row.fabricGroup,
    });
    notify?.("Fabric Group loaded");
  }
  async function lookupSampleInward() {
    try {
      const row = await api.inward(form.sampleInwardNo);
      setForm({
        ...blank(),
        sampleInwardNo: row.inwardNo,
        inwardType: "LOT",
        fabricCode: row.fabricCode,
        fabricName: row.fabricName,
        fabricGroup: row.fabricGroup,
        dcNo: row.dcNo || "",
        lotDcNo: row.lotDcNo || "",
        compactingCode: row.compactingCode || "",
        compactingName: row.compactingName || "",
        dyeingCode: row.dyeingCode || "",
        dyeingName: row.dyeingName || "",
        colours: row.colours.map((item) => ({
          colour: item.colour,
          details: item.details.map((line) => ({
            dia: line.dia,
            sampleRolls: line.sampleRolls || "",
            sampleWeightKg: line.sampleWeightKg || "",
            lotRolls: line.lotRolls || "",
            lotWeightKg: line.lotWeightKg || "",
          })),
        })),
      });
      notify?.("Sample inward data loaded. You can edit, add colour, dia or rows before saving.");
    } catch (error) { notify?.(error.message); }
  }
  async function lookupProcess(type) {
    const code = type === "COMPACTING" ? form.compactingCode : form.dyeingCode;
    const row = await api.process(type, code);
    setForm({
      ...form,
      [type === "COMPACTING" ? "compactingName" : "dyeingName"]: row.name,
    });
  }
  async function submit(event) {
    event.preventDefault();
    const saved = await api.saveInward(form, form._id);
    setSelected(saved);
    setBundles(await api.bundles(saved.inwardNo));
    setForm(blank());
    notify?.("Fabric inward and roll QR saved");
    load();
  }
  async function view(row) {
    setSelected(await api.inward(row.inwardNo));
    setBundles(await api.bundles(row.inwardNo));
  }
  async function downloadPdf() {
    if (!receiptRef.current) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    await pdf.html(receiptRef.current, {
      x: 8,
      y: 8,
      width: 194,
      windowWidth: 1100,
      autoPaging: "text",
    });
    pdf.save(`${selected.inwardNo}-fabric-inward.pdf`);
  }

  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>FABRIC STORE</small>
          <h2>Fabric Inward & Roll QR</h2>
          <p>
            Sample/Lot, colour and dia-wise receipt with professional print.
          </p>
        </div>
      </div>
      {canEnter && (
        <form className="classic-card" onSubmit={submit}>
          <h3>New Fabric Receipt</h3>
          <div className="form-grid">
            <label>
              <span>Inward No</span>
              <input
                placeholder="Auto generated"
                value={form.inwardNo}
                onChange={(e) => setForm({ ...form, inwardNo: e.target.value })}
              />
            </label>
            <label>
              <span>Fabric Type</span>
              <select
                value={form.inwardType}
                onChange={(e) =>
                  setForm({ ...form, inwardType: e.target.value })
                }
              >
                <option>SAMPLE</option>
                <option>LOT</option>
                <option>BOTH</option>
              </select>
            </label>
            <Lookup
              label="Saved Sample Inward No"
              value={form.sampleInwardNo}
              change={(value) => setForm({ ...form, sampleInwardNo: value })}
              lookup={lookupSampleInward}
            />
            <Lookup
              label="Fabric Code"
              value={form.fabricCode}
              change={(value) => setForm({ ...form, fabricCode: value })}
              lookup={lookupFabric}
            />
            <label>
              <span>Fabric Group</span>
              <input readOnly value={form.fabricGroup} />
            </label>
            <label>
              <span>DC No</span>
              <input
                required
                value={form.dcNo}
                onChange={(e) => setForm({ ...form, dcNo: e.target.value })}
              />
            </label>
            <label>
              <span>Lot DC No</span>
              <input
                required
                value={form.lotDcNo}
                onChange={(e) => setForm({ ...form, lotDcNo: e.target.value })}
              />
            </label>
            <Lookup
              label="Compacting Code"
              value={form.compactingCode}
              change={(value) => setForm({ ...form, compactingCode: value })}
              lookup={() => lookupProcess("COMPACTING")}
            />
            <label>
              <span>Compacting Name</span>
              <input readOnly value={form.compactingName} />
            </label>
            <Lookup
              label="Dyeing Code"
              value={form.dyeingCode}
              change={(value) => setForm({ ...form, dyeingCode: value })}
              lookup={() => lookupProcess("DYEING")}
            />
            <label>
              <span>Dyeing Name</span>
              <input readOnly value={form.dyeingName} />
            </label>
            <label>
              <span>Inward Date</span>
              <input
                type="date"
                required
                value={form.inwardDate}
                onChange={(e) =>
                  setForm({ ...form, inwardDate: e.target.value })
                }
              />
            </label>
          </div>
          <div className="colour-entry-list">
            {form.colours.map((row, index) => (
              <div className="colour-entry-row" key={index}>
                <b>Colour {index + 1}</b>
                <input
                  required
                  placeholder="Colour"
                  value={row.colour}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      colours: form.colours.map((x, i) =>
                        i === index ? { ...x, colour: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button type="button" onClick={() => setDetailIndex(index)}>
                  Dia / Roll Details ({row.details.length})
                </button>
                {form.colours.length > 1 && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setForm({
                        ...form,
                        colours: form.colours.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setForm({ ...form, colours: [...form.colours, colour()] })
              }
            >
              <Plus /> Add Colour
            </button>
            <button className="primary">
              <Save /> Save Inward
            </button>
          </div>
        </form>
      )}
      {detailIndex !== null && (
        <DetailModal
          row={form.colours[detailIndex]}
          update={(row) =>
            setForm({
              ...form,
              colours: form.colours.map((x, i) =>
                i === detailIndex ? row : x,
              ),
            })
          }
          close={() => setDetailIndex(null)}
        />
      )}
      <div className="classic-card">
        <div className="table-toolbar">
          <h3>Inward History</h3>
          <button
            className="secondary"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter /> Filters
          </button>
        </div>
        {filterOpen && (
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
            <label>
              Inward No
              <input
                value={filters.inwardNo}
                onChange={(e) =>
                  setFilters({ ...filters, inwardNo: e.target.value })
                }
              />
            </label>
            <label>
              DC No
              <input
                value={filters.dcNo}
                onChange={(e) =>
                  setFilters({ ...filters, dcNo: e.target.value })
                }
              />
            </label>
            <label>
              Lot DC No
              <input
                value={filters.lotDcNo}
                onChange={(e) =>
                  setFilters({ ...filters, lotDcNo: e.target.value })
                }
              />
            </label>
            <label>
              Fabric
              <input
                value={filters.fabricCode}
                onChange={(e) =>
                  setFilters({ ...filters, fabricCode: e.target.value })
                }
              />
            </label>
            <label>
              Type
              <select
                value={filters.inwardType}
                onChange={(e) =>
                  setFilters({ ...filters, inwardType: e.target.value })
                }
              >
                <option value="">All</option>
                <option>SAMPLE</option>
                <option>LOT</option>
                <option>BOTH</option>
              </select>
            </label>
            <button onClick={load}>
              <Search /> Apply
            </button>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Inward No</th>
                <th>Type</th>
                <th>Fabric</th>
                <th>DC No</th>
                <th>Lot DC No</th>
                <th>Rolls</th>
                <th>Weight</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>{new Date(row.inwardDate).toLocaleDateString()}</td>
                  <td>{row.inwardNo}</td>
                  <td>{row.inwardType}</td>
                  <td>
                    {row.fabricCode} · {row.fabricGroup}
                  </td>
                  <td>{row.dcNo}</td>
                  <td>{row.lotDcNo || "—"}</td>
                  <td>{row.totalRolls}</td>
                  <td>{row.totalWeightKg} KG</td>
                  <td>
                    <button onClick={() => view(row)}>
                      <Edit3 /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && (
        <>
          <div className="receipt-actions">
            <button onClick={() => window.print()}>
              <Printer /> Print Receipt & QR
            </button>
            <button onClick={downloadPdf}>
              <Download /> Download PDF
            </button>
          </div>
          <Receipt
            inward={selected}
            bundles={bundles}
            receiptRef={receiptRef}
          />
        </>
      )}
    </section>
  );
}

function Lookup({ label, value, change, lookup }) {
  return (
    <label>
      <span>{label}</span>
      <div className="input-action">
        <input
          required
          value={value}
          onChange={(e) => change(e.target.value)}
        />
        <button type="button" onClick={lookup}>
          <Search />
        </button>
      </div>
    </label>
  );
}
function DetailModal({ row, update, close }) {
  return (
    <div className="modal-backdrop">
      <div className="classic-card colour-detail-modal">
        <div className="modal-title">
          <h3>{row.colour || "Colour"} · Dia Details</h3>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Sample Rolls</th>
                <th>Sample KG</th>
                <th>Lot Rolls</th>
                <th>Lot KG</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {row.details.map((line, index) => (
                <tr key={index}>
                  {Object.keys(detail()).map((key) => (
                    <td key={key}>
                      <input
                        type={key === "dia" ? "text" : "number"}
                        min="0"
                        step={key.includes("Weight") ? "0.001" : "1"}
                        value={line[key]}
                        onChange={(e) =>
                          update({
                            ...row,
                            details: row.details.map((x, i) =>
                              i === index ? { ...x, [key]: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <button
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
        </div>
        <button
          onClick={() =>
            update({ ...row, details: [...row.details, detail()] })
          }
        >
          <Plus /> Add Dia
        </button>
        <button className="primary" onClick={close}>
          Done
        </button>
      </div>
    </div>
  );
}
function Receipt({ inward, bundles, receiptRef }) {
  return (
    <div className="fabric-print-area" ref={receiptRef}>
      <section className="fabric-receipt-print">
        <header>
          <small>FABRIC INWARD RECEIPT</small>
          <h1>{inward.fabricName || inward.fabricGroup}</h1>
          <p>
            {inward.inwardNo} · {inward.inwardType}
          </p>
        </header>
        <div className="receipt-meta">
          <span>
            <small>Fabric Group</small>
            <b>{inward.fabricGroup}</b>
          </span>
          <span>
            <small>DC No</small>
            <b>{inward.dcNo}</b>
          </span>
          <span>
            <small>Dyeing</small>
            <b>{inward.dyeingName || "—"}</b>
          </span>
          <span>
            <small>Compacting</small>
            <b>{inward.compactingName || "—"}</b>
          </span>
          <span>
            <small>Lot DC No</small>
            <b>{inward.lotDcNo || "—"}</b>
          </span>
          <span>
            <small>Date</small>
            <b>{new Date(inward.inwardDate).toLocaleDateString()}</b>
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Colour</th>
              <th>Dia</th>
              <th>Sample Rolls</th>
              <th>Sample KG</th>
              <th>Lot Rolls</th>
              <th>Lot KG</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {inward.colours
              .flatMap((c) =>
                c.details.map((d) => ({ colour: c.colour, ...d })),
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
                  <td>{line.totalWeightKg} KG</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3">Overall</td>
              <td>{inward.totalSampleRolls}</td>
              <td>{inward.totalSampleWeightKg}</td>
              <td>{inward.totalLotRolls}</td>
              <td>{inward.totalLotWeightKg}</td>
              <td>{inward.totalWeightKg} KG</td>
            </tr>
          </tfoot>
        </table>
        <div className="receipt-signatures">
          <span>Prepared By</span>
          <span>Checked By</span>
          <span>Authorized By</span>
        </div>
      </section>
      <section className="roll-label-sheet">
        {bundles.map((bundle) => (
          <article key={bundle._id}>
            <small>
              {bundle.inwardType} · ROLL {bundle.rollNo}
            </small>
            <QRGenerator value={bundle.qrToken} size={112} />
            <b>{bundle.bundleNo}</b>
            <span>
              {bundle.fabricGroup} · {bundle.colour}
            </span>
            <span>
              Dia {bundle.dia} · {bundle.averageWeightKg} KG
            </span>
            <span>{bundle.dyeingName || "No Dyeing"}</span>
            <span>{bundle.compactingName || "No Compacting"}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
