import { useEffect, useState } from "react";
import { Search, Save } from "lucide-react";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import ProductionPlanDocument from "./ProductionPlanDocument.jsx";

const blank = () => ({
  _id: "",
  planNo: "",
  orderNo: "",
  dcNo: "",
  itemCode: "",
  itemName: "",
  fabricGroup: "",
  style: "",
  dcType: "FRESH_LOT",
  selectedColours: [],
  colourBatches: {},
  colourRemarks: {},
  sizes: [],
  notes: "",
});

export default function ProductionPlanEntryPage({ notify }) {
  const [form, setForm] = useState(blank());
  const [stock, setStock] = useState([]);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const stored = sessionStorage.getItem("fabric_production_plan_edit");
    if (!stored) return;
    sessionStorage.removeItem("fabric_production_plan_edit");
    const row = JSON.parse(stored);
    api
      .planSetup(row.itemCode, row._id)
      .then((data) => {
        setStock(groupStockByColour(data.stockColours));
        setForm({
          _id: row._id,
          planNo: row.planNo,
          orderNo: row.orderNo,
          dcNo: row.dcNo,
          itemCode: row.itemCode,
          itemName: row.itemName,
          fabricGroup: row.fabricGroup,
          style: row.style || "",
          dcType: row.dcType,
          selectedColours: row.colours.map((colour) => colour.colour),
          colourBatches: Object.fromEntries(row.colours.map((colour) => [colour.colour, colour.batchNumbers || []])),
          colourRemarks: Object.fromEntries(row.colours.map((colour) => [colour.colour, colour.remarks || ""])),
          sizes: data.item.sizes.map((size) => ({
            ...size,
            pcs: row.colours.reduce(
              (sum, colour) =>
                sum +
                Number(
                  colour.sizes.find((line) => line.size === size.size)
                    ?.plannedPcs || 0,
                ),
              0,
            ),
          })),
          notes: row.notes || "",
        });
      })
      .catch((error) => notify?.(error.message));
  }, []);
  async function lookup() {
    setBusy(true);
    try {
      const data = await api.planSetup(form.itemCode, form._id);
      setStock(groupStockByColour(data.stockColours));
      setForm({
        ...form,
        itemCode: data.item.itemCode,
        itemName: data.item.itemName,
        fabricGroup: data.item.fabricGroup,
        selectedColours: [],
        colourBatches: {},
        colourRemarks: {},
        sizes: data.item.sizes.map((row) => ({
          size: row.size,
          pcs: "",
          cuttingPieceWeightKg: row.cuttingPieceWeightKg,
          foldingPieceWeightKg: row.foldingPieceWeightKg,
          dia: row.dia,
        })),
      });
      notify?.("Approved Item Master and available fabric loaded");
    } catch (error) {
      notify?.(error.message);
    } finally {
      setBusy(false);
    }
  }
  function toggleColour(colour) {
    const selected = form.selectedColours.includes(colour);
    setForm({
      ...form,
      selectedColours: selected
        ? form.selectedColours.filter((x) => x !== colour)
        : [...form.selectedColours, colour],
    });
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        sizes: form.sizes.filter((x) => Number(x.pcs) > 0),
      };
      const row = form._id
        ? await api.updatePlan(form._id, payload)
        : await api.savePlan(payload);
      setSaved(row);
      notify?.(
        `Production Plan ${form._id ? "updated" : "saved"}: ${row.planNo}`,
      );
    } catch (error) {
      notify?.(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>CUTTING DEPARTMENT</small>
          <h2>Production Plan · Data Entry</h2>
          <p>
            Approved Item Master measurement and live fabric stock based
            planning.
          </p>
        </div>
      </div>
      <form
        className="classic-card production-plan-form"
        onSubmit={submit}
        aria-busy={busy}
      >
        <div className="form-grid">
          <label>
            <span>Plan No</span>
            <input
              readOnly
              placeholder="4 digit auto number"
              value={form.planNo}
            />
          </label>
          <label>
            <span>Order No *</span>
            <input
              required
              value={form.orderNo}
              onChange={(e) => setForm({ ...form, orderNo: e.target.value })}
            />
          </label>
          <label>
            <span>DC No</span>
            <input
              placeholder="Same as Plan No if blank"
              value={form.dcNo}
              onChange={(e) => setForm({ ...form, dcNo: e.target.value })}
            />
          </label>
          <label>
            <span>Item Code *</span>
            <div className="input-action">
              <input
                required
                value={form.itemCode}
                onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
              />
              <button type="button" onClick={lookup} disabled={busy}>
                <Search />
              </button>
            </div>
          </label>
          <label>
            <span>Item Name</span>
            <input readOnly value={form.itemName} />
          </label>
          <label>
            <span>Style</span>
            <input
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
            />
          </label>
          <label>
            <span>Fabric Group</span>
            <input readOnly value={form.fabricGroup} />
          </label>
          <label>
            <span>DC Type *</span>
            <select
              value={form.dcType}
              onChange={(e) => setForm({ ...form, dcType: e.target.value })}
            >
              <option value="FRESH_LOT">Fresh Lot · Cutting weight</option>
              <option value="FOLDING_LOT">
                Folding Lot · Cutting + Folding
              </option>
            </select>
          </label>
        </div>
        <h3>Available Colours</h3>
        <div className="stock-colour-grid">
          {stock.length ? (
            stock.map((row) => (
              <button
                type="button"
                className={
                  form.selectedColours.includes(row.colour) ? "selected" : ""
                }
                onClick={() => toggleColour(row.colour)}
                key={row.colour}
              >
                <b>{row.colour}</b>
                <span>{row.availableWeightKg} KG available</span>
                <small>
                  {row.dias
                    .map((dia) => `Dia ${dia.dia}: ${dia.availableWeightKg} KG`)
                    .join(" · ")}
                </small>
              </button>
            ))
          ) : (
            <p>Enter Item Code and click search.</p>
          )}
        </div>
        {form.selectedColours.length > 0 && <div className="table-wrap"><table><thead><tr><th>Colour</th><th>Batch Numbers</th><th>Remarks</th></tr></thead><tbody>{form.selectedColours.map((colour) => <tr key={colour}><td>{colour}</td><td><input placeholder="BATCH-1, BATCH-2" value={(form.colourBatches[colour] || []).join(", ")} onChange={(e) => setForm({ ...form, colourBatches: { ...form.colourBatches, [colour]: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} /></td><td><input value={form.colourRemarks[colour] || ""} onChange={(e) => setForm({ ...form, colourRemarks: { ...form.colourRemarks, [colour]: e.target.value } })} /></td></tr>)}</tbody></table></div>}
        <h3>Size-wise Required PCS</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Size</th>
                <th>Dia</th>
                <th>Cutting KG/PCS</th>
                <th>Folding KG/PCS</th>
                <th>Required PCS</th>
              </tr>
            </thead>
            <tbody>
              {form.sizes.map((row, index) => (
                <tr key={row.size}>
                  <td>{row.size}</td>
                  <td><input value={row.dia || ""} placeholder="Required if BOM Dia missing" onChange={(e) => setForm({ ...form, sizes: form.sizes.map((x, i) => i === index ? { ...x, dia: e.target.value } : x) })} /></td>
                  <td>{row.cuttingPieceWeightKg}</td>
                  <td>{row.foldingPieceWeightKg}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.pcs}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sizes: form.sizes.map((x, i) =>
                            i === index ? { ...x, pcs: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="form-hint">
          PCS selected colours-க்கு equal-ஆ distribute ஆகும். ஒரு colour stock
          குறைந்தால் remaining PCS மற்ற colour-க்கு automatic-ஆ move ஆகும்.
        </p>
        <label className="notes-field">
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Plan notes / special instructions"
          />
        </label>
        <div className="form-actions">
          <button
            className="primary"
            disabled={busy || !form.selectedColours.length}
          >
            <Save />{" "}
            {busy
              ? "Saving..."
              : form._id
                ? "Update Production Plan"
                : "Save Production Plan"}
          </button>
        </div>
      </form>
      {saved && <ProductionPlanDocument plan={saved} />}
    </section>
  );
}

function groupStockByColour(rows) {
  const groups = new Map();
  for (const row of rows) {
    const current = groups.get(row.colour) || {
      colour: row.colour,
      availableWeightKg: 0,
      dias: [],
    };
    current.availableWeightKg = Number(
      (current.availableWeightKg + Number(row.availableWeightKg || 0)).toFixed(
        3,
      ),
    );
    current.dias.push({
      dia: row.dia,
      availableWeightKg: row.availableWeightKg,
    });
    groups.set(row.colour, current);
  }
  return [...groups.values()];
}
