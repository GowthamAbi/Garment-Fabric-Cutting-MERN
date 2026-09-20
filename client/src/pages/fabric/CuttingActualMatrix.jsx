import { Save } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const number = (value) => Number(value || 0);
const fixed = (value) => Number(number(value).toFixed(3));

export default function CuttingActualMatrix({
  plan,
  actual,
  setActual,
  submit,
}) {
  const { user } = useAuth();
  const locked = Boolean(actual._id) && !["saas_super_admin", "company_admin", "admin"].includes(user?.role);
  const sizes = [...new Set(actual.lines.map((line) => line.size))];
  const colours = [...new Set(actual.lines.map((line) => line.colour))];
  const calculatedLines = actual.lines.map((line) => {
    const actualWeightKg = fixed(line.plannedWeightKg);
    const wasteWeightKg = fixed(actualWeightKg - number(line.bundleWeightKg));
    return { ...line, actualWeightKg, wasteWeightKg };
  });
  const totals = calculatedLines.reduce(
    (result, line) => ({
      plannedPcs: result.plannedPcs + number(line.plannedPcs),
      actualPcs: result.actualPcs + number(line.actualPcs),
      plannedWeightKg: result.plannedWeightKg + number(line.plannedWeightKg),
      actualWeightKg: result.actualWeightKg + number(line.actualWeightKg),
      bundleCount: result.bundleCount + number(line.bundleCount),
      bundleWeightKg: result.bundleWeightKg + number(line.bundleWeightKg),
      wasteWeightKg: result.wasteWeightKg + number(line.wasteWeightKg),
    }),
    {
      plannedPcs: 0,
      actualPcs: 0,
      plannedWeightKg: 0,
      actualWeightKg: 0,
      bundleCount: 0,
      bundleWeightKg: 0,
      wasteWeightKg: 0,
    },
  );
  const efficiency = totals.actualWeightKg
    ? (totals.bundleWeightKg / totals.actualWeightKg) * 100
    : 0;

  function lineFor(colour, size) {
    return calculatedLines.find(
      (line) => line.colour === colour && line.size === size,
    );
  }

  function update(colour, size, key, value) {
    setActual({
      ...actual,
      lines: actual.lines.map((line) =>
        line.colour === colour && line.size === size
          ? { ...line, [key]: value }
          : line,
      ),
    });
  }

  return (
    <form
      id="cutting-actual-print"
      className="cutting-actual-sheet print-document"
      onSubmit={submit}
    >
      <header className="cutting-sheet-header">
        <div>
          <small>CUTTING ACTUAL / PLAN TRACEABILITY</small>
          <h2>{plan.itemName}</h2>
          <p>
            Plan {plan.planNo} · DC {plan.dcNo}
          </p>
        </div>
        <div className="cutting-sheet-meta">
          <span>
            <small>Date</small>
            <b>{new Date().toLocaleDateString()}</b>
          </span>
          <span>
            <small>Order No</small>
            <b>{plan.orderNo || "—"}</b>
          </span>
          <span>
            <small>Style</small>
            <b>{plan.style || "—"}</b>
          </span>
          <span>
            <small>Fabric Group</small>
            <b>{plan.fabricGroup || "—"}</b>
          </span>
        </div>
      </header>

      <section className="cutting-kpi-grid">
        <Kpi
          label="Received Weight"
          value={`${fixed(plan.totalWantedWeightKg)} KG`}
        />
        <Kpi
          label="Actual Weight"
          value={`${fixed(totals.actualWeightKg)} KG`}
        />
        <Kpi
          label="Cut Bundle Weight"
          value={`${fixed(totals.bundleWeightKg)} KG`}
        />
        <Kpi
          label="Waste Weight"
          value={`${fixed(totals.wasteWeightKg)} KG`}
          tone={totals.wasteWeightKg < 0 ? "danger" : ""}
        />
        <Kpi label="Efficiency" value={`${efficiency.toFixed(2)}%`} />
      </section>

      <div className="actual-matrix-wrap">
        <table className="actual-matrix">
          <thead>
            <tr>
              <th rowSpan="2">S.No</th>
              <th rowSpan="2">Colour</th>
              {sizes.map((size) => (
                <th key={size} colSpan="5" className="size-group">
                  Size {size}
                </th>
              ))}
              <th colSpan="6" className="total-group">
                Colour Total
              </th>
            </tr>
            <tr>
              {sizes.flatMap((size) =>
                [
                  "Planned PCS",
                  "Actual PCS",
                  "Actual WT",
                  "Bundle",
                  "Bundle WT",
                ].map((heading) => (
                  <th key={`${size}-${heading}`}>{heading}</th>
                )),
              )}
              <th>T.Plan PCS</th>
              <th>T.Actual PCS</th>
              <th>T.Actual WT</th>
              <th>T.Bundle</th>
              <th>T.Bundle WT</th>
              <th>Waste WT</th>
            </tr>
          </thead>
          <tbody>
            {colours.map((colour, colourIndex) => {
              const colourLines = calculatedLines.filter(
                (line) => line.colour === colour,
              );
              const colourTotal = sumLines(colourLines);
              return (
                <tr key={colour}>
                  <td>{colourIndex + 1}</td>
                  <th className="colour-index">{colour}</th>
                  {sizes.flatMap((size) => {
                    const line = lineFor(colour, size);
                    if (!line)
                      return [0, 1, 2, 3, 4].map((cell) => (
                        <td key={`${colour}-${size}-${cell}`}>—</td>
                      ));
                    return [
                      <td key={`${colour}-${size}-planned`}>
                        {line.plannedPcs}
                      </td>,
                      <td key={`${colour}-${size}-actual`}>
                        <NumberInput
                          disabled={locked}
                          value={line.actualPcs}
                          change={(value) =>
                            update(colour, size, "actualPcs", value)
                          }
                        />
                      </td>,
                      <td key={`${colour}-${size}-actual-wt`}>
                        {line.actualWeightKg}
                      </td>,
                      <td key={`${colour}-${size}-bundle`}>
                        <NumberInput
                          disabled={locked}
                          value={line.bundleCount}
                          change={(value) =>
                            update(colour, size, "bundleCount", value)
                          }
                        />
                      </td>,
                      <td key={`${colour}-${size}-bundle-wt`}>
                        <NumberInput
                          disabled={locked}
                          decimal
                          value={line.bundleWeightKg}
                          change={(value) =>
                            update(colour, size, "bundleWeightKg", value)
                          }
                        />
                      </td>,
                    ];
                  })}
                  <td>{colourTotal.plannedPcs}</td>
                  <td>{colourTotal.actualPcs}</td>
                  <td>{fixed(colourTotal.actualWeightKg)}</td>
                  <td>{colourTotal.bundleCount}</td>
                  <td>{fixed(colourTotal.bundleWeightKg)}</td>
                  <td
                    className={
                      colourTotal.wasteWeightKg < 0 ? "negative" : "positive"
                    }
                  >
                    {fixed(colourTotal.wasteWeightKg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan="2">TOTAL</th>
              <td colSpan={sizes.length * 5} />
              <th>{totals.plannedPcs}</th>
              <th>{totals.actualPcs}</th>
              <th>{fixed(totals.actualWeightKg)}</th>
              <th>{totals.bundleCount}</th>
              <th>{fixed(totals.bundleWeightKg)}</th>
              <th>{fixed(totals.wasteWeightKg)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3>Size-wise Cutting Summary</h3>
      <div className="table-wrap compact-summary-table">
        <table>
          <thead>
            <tr>
              <th>Size</th>
              <th>Dia</th>
              <th>Bundle</th>
              <th>PCS</th>
              <th>Fabric Lot WT</th>
              <th>Cut Bundle WT</th>
              <th>Waste WT</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => {
              const sizeLines = calculatedLines.filter(
                (line) => line.size === size,
              );
              const value = sumLines(sizeLines);
              return (
                <tr key={size}>
                  <td>{size}</td>
                  <td>{sizeLines[0]?.dia || "—"}</td>
                  <td>{value.bundleCount}</td>
                  <td>{value.actualPcs}</td>
                  <td>{fixed(value.actualWeightKg)}</td>
                  <td>{fixed(value.bundleWeightKg)}</td>
                  <td>{fixed(value.wasteWeightKg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="actual-remarks">
        <span>Remarks</span>
        <textarea
          disabled={locked}
          value={actual.remarks || ""}
          onChange={(event) =>
            setActual({ ...actual, remarks: event.target.value })
          }
        />
      </label>
      <div className="cutting-signatures">
        <span>GRN No: ______________</span>
        <span>Prepared By</span>
        <span>Checked By</span>
      </div>
      <button className="primary actual-submit" disabled={locked}>
        <Save /> {locked ? "Saved · Company Admin Edit Only" : actual._id ? "Update Cutting Actual" : "Complete Cutting"}
      </button>
    </form>
  );
}

function NumberInput({ value, change, decimal = false, disabled = false }) {
  return (
    <input
      type="number"
      min="0"
      step={decimal ? "0.001" : "1"}
      required
      disabled={disabled}
      value={value}
      onChange={(event) => change(event.target.value)}
    />
  );
}

function Kpi({ label, value, tone = "" }) {
  return (
    <span className={tone}>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function sumLines(lines) {
  return lines.reduce(
    (result, line) => ({
      plannedPcs: result.plannedPcs + number(line.plannedPcs),
      actualPcs: result.actualPcs + number(line.actualPcs),
      actualWeightKg: result.actualWeightKg + number(line.actualWeightKg),
      bundleCount: result.bundleCount + number(line.bundleCount),
      bundleWeightKg: result.bundleWeightKg + number(line.bundleWeightKg),
      wasteWeightKg: result.wasteWeightKg + number(line.wasteWeightKg),
    }),
    {
      plannedPcs: 0,
      actualPcs: 0,
      actualWeightKg: 0,
      bundleCount: 0,
      bundleWeightKg: 0,
      wasteWeightKg: 0,
    },
  );
}
