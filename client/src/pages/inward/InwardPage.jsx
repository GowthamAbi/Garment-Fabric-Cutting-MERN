import { useState } from "react";
import { Download, Plus, Printer, Trash2 } from "lucide-react";
import { createInward } from "../../api/inwardApi.js";
import { getItem } from "../../api/itemApi.js";
import { getPurchaseOrders } from "../../api/purchaseOrderApi.js";
import PageTitle from "../../components/common/PageTitle.jsx";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import { formatInputDate } from "../../utils/formatters.js";

function createBlankRow() {
  return {
    itemCode: "",
    poNo: "",
    indentNo: "",
    brand: "",
    description: "",
    type: "",
    colour: "",
    orderQty: 0,
    inwardDate: formatInputDate(new Date()),
    inwardQty: "",
    balanceQty: 0,
    loading: false,
    error: "",
  };
}

export default function InwardPage({ notify }) {
  const [rows, setRows] = useState([createBlankRow()]);
  const [savedInwards, setSavedInwards] = useState([]);
  const [selectedInward, setSelectedInward] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function updateRow(rowIndex, changes) {
    setRows((currentRows) =>
      currentRows.map((row, index) =>
        index === rowIndex ? { ...row, ...changes } : row,
      ),
    );
  }

  async function loadItemAndPO(rowIndex) {
    const itemCode = rows[rowIndex].itemCode.trim().toUpperCase();
    const poNo = rows[rowIndex].poNo.trim().toUpperCase();

    if (!poNo || !itemCode) return;
    updateRow(rowIndex, { loading: true, error: "" });

    try {
      const purchaseOrders = await getPurchaseOrders(true);

      const matchingPO = purchaseOrders.find(
        (purchaseOrder) =>
          purchaseOrder.poNo === poNo &&
          purchaseOrder.itemCode === itemCode &&
          purchaseOrder.status !== "Completed",
      );

      if (!matchingPO) {
        throw new Error("No pending order found for this PO No. and Item Code");
      }

      let item = null;

      try {
        item = await getItem(itemCode, matchingPO.colour || "");
      } catch (error) {
        if (!error.message.toLowerCase().includes("not found")) throw error;
      }

      updateRow(rowIndex, {
        itemCode,
        poNo,
        indentNo: matchingPO.indentNo || "",
        brand: matchingPO.brand || item?.brand || "",
        description:
          matchingPO.description || item?.description || matchingPO.itemCode,
        type: matchingPO.type || item?.type || "",
        colour: matchingPO.colour || item?.colour || "",
        orderQty: matchingPO.orderQty,
        balanceQty: Math.max(0, matchingPO.orderQty - matchingPO.inwardQty),
        loading: false,
        error: item ? "" : "Item Master will be created from this PO on submit",
      });
    } catch (error) {
      updateRow(rowIndex, {
        loading: false,
        error: error.message,
        brand: "",
        description: "",
        type: "",
        colour: "",
        orderQty: 0,
        balanceQty: 0,
      });
    }
  }

  function addRow() {
    setRows((currentRows) => [...currentRows, createBlankRow()]);
  }

  function removeRow(rowIndex) {
    setRows((currentRows) =>
      currentRows.length === 1
        ? [createBlankRow()]
        : currentRows.filter((_, index) => index !== rowIndex),
    );
  }

  async function submitInward() {
    const invalidRow = rows.find(
      (row) => !row.poNo || !row.itemCode || !row.inwardQty || Number(row.inwardQty) <= 0,
    );

    if (invalidRow) {
      notify("PO No., Item Code and valid Inward Qty are required");
      return;
    }

    setSaving(true);

    try {
      const results = [];

      for (const row of rows) {
        const saved = await createInward({
          itemCode: row.itemCode,
          poNo: row.poNo,
          indentNo: row.indentNo,
          quantity: Number(row.inwardQty),
          transactionDate: row.inwardDate,
          createdBy: "Store User",
        });

        results.push({
          ...saved,
          brand: row.brand,
          description: row.description,
          type: row.type,
          colour: row.colour,
          unit: saved.unit || "",
        });
      }

      setSavedInwards(results);
      setSelectedInward(results[0]);
      setRows([createBlankRow()]);
      notify(`${results.length} inward record saved and QR generated`);
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }

  function qrPayload(inward) {
    if (!inward) return "";

    return `${window.location.origin}/outward?inwardNo=${encodeURIComponent(
      inward.referenceNo,
    )}`;
  }

  function downloadQR() {
    if (!qrDataUrl || !selectedInward) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${selectedInward.referenceNo}-QR.png`;
    link.click();
  }

  return (
    <>
      <PageTitle
        title="Inward"
        subtitle="Enter PO No. and Item Code to load the exact pending order details"
      />

      <section className="card inward-card">
        <div className="table-wrap">
          <table className="inward-table">
            <thead>
              <tr>
                <th>Inward No.</th>
                <th>PO No.</th>
                <th>Item Code</th>
                <th>Brand</th>
                <th>Item Description</th>
                <th>Type</th>
                <th>Colour</th>
                <th>Order Quantity</th>
                <th>Inward Date</th>
                <th>Inward Qty</th>
                <th>PO Balance</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>
                    <span className="auto-value">Auto</span>
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.poNo}
                      placeholder="PO-001"
                      onChange={(event) =>
                        updateRow(rowIndex, {
                          poNo: event.target.value.toUpperCase(),
                          orderQty: 0,
                          balanceQty: 0,
                        })
                      }
                      onBlur={() => loadItemAndPO(rowIndex)}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input item-code-input"
                      value={row.itemCode}
                      placeholder="ITEM-001"
                      onChange={(event) =>
                        updateRow(rowIndex, {
                          itemCode: event.target.value.toUpperCase(),
                          orderQty: 0,
                          balanceQty: 0,
                        })
                      }
                      onBlur={() => loadItemAndPO(rowIndex)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          loadItemAndPO(rowIndex);
                        }
                      }}
                    />
                    {row.loading && <small>Loading...</small>}
                    {row.error && (
                      <small className="row-error">{row.error}</small>
                    )}
                  </td>
                  <td>{row.brand || "—"}</td>
                  <td>{row.description || "—"}</td>
                  <td>{row.type || "—"}</td>
                  <td>{row.colour || "—"}</td>
                  <td>{row.orderQty || "—"}</td>
                  <td>
                    <input
                      className="table-input date-input"
                      type="date"
                      value={row.inwardDate}
                      onChange={(event) =>
                        updateRow(rowIndex, { inwardDate: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="table-input qty-input"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={row.inwardQty}
                      onChange={(event) =>
                        updateRow(rowIndex, { inwardQty: event.target.value })
                      }
                    />
                  </td>
                  <td>{row.balanceQty || 0}</td>
                  <td>
                    <button
                      className="icon-danger"
                      onClick={() => removeRow(rowIndex)}
                      title="Remove row"
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card-footer">
          <button onClick={addRow}>
            <Plus /> Add Row
          </button>
          <button className="primary" disabled={saving} onClick={submitInward}>
            {saving ? "Saving..." : "Submit Inward"}
          </button>
        </div>
      </section>

      {savedInwards.length > 0 && (
        <section className="qr-section">
          <div className="qr-list card">
            <h3 className="card-title">Generated inward numbers</h3>
            {savedInwards.map((inward) => (
              <button
                key={inward.referenceNo}
                className={
                  selectedInward?.referenceNo === inward.referenceNo
                    ? "selected"
                    : ""
                }
                onClick={() => setSelectedInward(inward)}
              >
                <b>{inward.referenceNo}</b>
                <span>
                  {inward.itemCode} · {inward.quantity}
                </span>
              </button>
            ))}
          </div>

          <div className="qr-label card" id="inward-qr-label">
            <div className="qr-label-header">
              <h3>Accessories Flow Inward Label</h3>
              <span>Unique stock identity</span>
            </div>

            <QRGenerator
              value={qrPayload(selectedInward)}
              size={210}
              onReady={setQrDataUrl}
            />

            <dl>
              <div>
                <dt>Inward No.</dt>
                <dd>{selectedInward.referenceNo}</dd>
              </div>
              <div>
                <dt>Item Code</dt>
                <dd>{selectedInward.itemCode}</dd>
              </div>
              <div>
                <dt>PO No.</dt>
                <dd>{selectedInward.poNo || "—"}</dd>
              </div>
              <div>
                <dt>Indent No.</dt>
                <dd>{selectedInward.indentNo || "—"}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{selectedInward.description}</dd>
              </div>
              <div>
                <dt>Inward Qty</dt>
                <dd>{selectedInward.quantity}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{selectedInward.type || "—"}</dd>
              </div>
              <div>
                <dt>Colour</dt>
                <dd>{selectedInward.colour || "—"}</dd>
              </div>
            </dl>

            <div className="qr-actions">
              <button onClick={() => window.print()}>
                <Printer /> Print
              </button>
              <button className="primary" onClick={downloadQR}>
                <Download /> Download QR
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
