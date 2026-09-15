export default function ProductionPlanDocument({ plan, documentRef }) {
  if (!plan) return null;
  const lines = plan.colours.flatMap((colour) =>
    colour.sizes
      .filter((size) => size.plannedPcs > 0)
      .map((size) => ({ ...size, colour: colour.colour })),
  );
  const sizeSummary = [...new Set(lines.map((line) => line.size))].map(
    (size) => {
      const sizeLines = lines.filter((line) => line.size === size);
      return {
        size,
        pcs: sizeLines.reduce(
          (sum, line) => sum + Number(line.plannedPcs || 0),
          0,
        ),
        weightKg: Number(
          sizeLines
            .reduce((sum, line) => sum + Number(line.wantedWeightKg || 0), 0)
            .toFixed(3),
        ),
      };
    },
  );
  return (
    <article
      className="production-plan-document print-document"
      ref={documentRef}
    >
      <header>
        <small>PRODUCTION PLAN / FABRIC REQUIREMENT</small>
        <h1>{plan.itemName}</h1>
        <p>
          {plan.planNo} · {plan.dcType?.replace("_", " ")}
        </p>
      </header>
      <div className="plan-document-meta">
        <span>
          <small>Order No</small>
          <b>{plan.orderNo}</b>
        </span>
        <span>
          <small>DC No</small>
          <b>{plan.dcNo}</b>
        </span>
        <span>
          <small>Item Code</small>
          <b>{plan.itemCode}</b>
        </span>
        <span>
          <small>Style</small>
          <b>{plan.style || "—"}</b>
        </span>
        <span>
          <small>Fabric Group</small>
          <b>{plan.fabricGroup}</b>
        </span>
        <span>
          <small>Date</small>
          <b>{new Date(plan.createdAt).toLocaleDateString()}</b>
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Colour</th>
            <th>Size</th>
            <th>PCS</th>
            <th>Per PCS KG</th>
            <th>Required KG</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.colour}-${line.size}`}>
              <td>{index + 1}</td>
              <td>{line.colour}</td>
              <td>{line.size}</td>
              <td>{line.plannedPcs}</td>
              <td>{line.cuttingWeightPerPieceKg}</td>
              <td>{line.wantedWeightKg}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3">TOTAL</td>
            <td>{plan.totalPlannedPcs}</td>
            <td />
            <td>{plan.totalWantedWeightKg} KG</td>
          </tr>
        </tfoot>
      </table>
      <h3 className="document-section-title">Size-wise Total Requirement</h3>
      <table className="size-summary-table">
        <thead>
          <tr>
            <th>Size</th>
            <th>Total Wanted PCS</th>
            <th>Required Weight KG</th>
          </tr>
        </thead>
        <tbody>
          {sizeSummary.map((row) => (
            <tr key={row.size}>
              <td>{row.size}</td>
              <td>{row.pcs}</td>
              <td>{row.weightKg}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>OVERALL</td>
            <td>{plan.totalPlannedPcs}</td>
            <td>{plan.totalWantedWeightKg} KG</td>
          </tr>
        </tfoot>
      </table>
      <section className="plan-colour-summary">
        {plan.colours.map((row) => (
          <span key={row.colour}>
            <small>{row.colour}</small>
            <b>
              {row.totalPcs} PCS · {row.wantedWeightKg} KG
            </b>
          </span>
        ))}
      </section>
      {plan.notes && (
        <section className="document-notes">
          <small>NOTES</small>
          <p>{plan.notes}</p>
        </section>
      )}
      <div className="receipt-signatures">
        <span>Prepared By</span>
        <span>Checked By</span>
        <span>Authorized By</span>
      </div>
    </article>
  );
}
