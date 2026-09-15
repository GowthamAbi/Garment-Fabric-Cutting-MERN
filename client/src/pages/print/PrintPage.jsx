import { useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { api } from "../../api.js";
import PageTitle from "../../components/common/PageTitle.jsx";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import {
  downloadDcPdf,
  downloadTransactionPdf,
  printTransaction,
} from "../../services/printService.js";

const labels = [
  ["referenceNo", "Reference No."],
  ["kind", "Transaction"],
  ["inwardReference", "Inward Reference"],
  ["poNo", "PO No."],
  ["indentNo", "Indent No."],
  ["itemCode", "Item Code"],
  ["itemName", "Item Name / Usage"],
  ["brand", "Brand"],
  ["type", "Type"],
  ["colour", "Colour"],
  ["dcNo", "DC No."],
  ["section", "Section Name"],
  ["quantity", "Quantity"],
  ["balanceQty", "Balance"],
  ["transactionDate", "Date"],
];

function TransactionReceipt({ record }) {
  const inwardQrLink =
    record.kind === "INWARD"
      ? `${window.location.origin}/outward?inwardNo=${encodeURIComponent(record.referenceNo)}`
      : "";

  return (
    <section className={`card transaction-print ${record.kind === "INWARD" ? "inward-label" : ""}`}>
      <header>
        <div><h2>Accessories Flow</h2><p>{record.kind} Receipt</p></div>
        <b>{record.referenceNo}</b>
      </header>
      <dl>
        {labels.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {key === "transactionDate"
                ? new Date(record[key]).toLocaleString()
                : record[key] || "—"}
              {["quantity", "balanceQty"].includes(key) ? ` ${record.unit || ""}` : ""}
            </dd>
          </div>
        ))}
      </dl>
      {record.kind === "INWARD" && (
        <div className="receipt-qr">
          <QRGenerator value={inwardQrLink} size={205} />
          <div><b>Inward QR Code</b><p>Scan for outward entry: {record.referenceNo}</p></div>
        </div>
      )}
      <footer className="no-print">
        <button onClick={() => printTransaction("transaction-print")}><Printer /> Print</button>
        <button className="primary" onClick={() => downloadTransactionPdf(record)}><Download /> Download PDF</button>
      </footer>
    </section>
  );
}

export default function PrintPage({ notify }) {
  const [referenceNo, setReferenceNo] = useState("");
  const [record, setRecord] = useState(null);
  const [dcNo, setDcNo] = useState("");
  const [dcReport, setDcReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const productionLink = (colour = "") =>
    `${window.location.origin}/production?dcNo=${encodeURIComponent(dcReport?.dcNo || "")}${colour ? `&colour=${encodeURIComponent(colour)}` : ""}`;
  const outwardRowLink = (entry) =>
    `${window.location.origin}/production?dcNo=${encodeURIComponent(dcReport?.dcNo || "")}` +
    `&outwardNo=${encodeURIComponent(entry.referenceNo || "")}` +
    `&inwardNo=${encodeURIComponent(entry.inwardReference || "")}` +
    `&colour=${encodeURIComponent(entry.colour || "")}`;

  async function findRecord(event) {
    event.preventDefault();
    if (!referenceNo.trim()) return;
    setLoading(true);
    setRecord(null);
    try {
      const first = await api(
          `/transactions/reference/${encodeURIComponent(referenceNo.trim())}`,
        );
      setRecord(first);
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function findDcReport(event) {
    event.preventDefault();
    if (!dcNo.trim()) return;
    setLoading(true);
    setDcReport(null);
    setRecord(null);
    try {
      setDcReport(
        await api(`/transactions/dc/${encodeURIComponent(dcNo.trim())}`),
      );
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Print"
        subtitle="Enter an Inward No. or Outward No. to view, print or download PDF"
      />
      <section className="card print-search-card no-print">
        <div className="print-search-option">
          <h3>Inward / Outward Number</h3>
          <form onSubmit={findRecord}>
            <input
              value={referenceNo}
              onChange={(event) =>
                setReferenceNo(event.target.value.toUpperCase())
              }
              placeholder="INW-... or OUT-..."
            />
            <button className="primary" disabled={loading}>
              <Search /> View
            </button>
          </form>
        </div>
        <div className="print-search-option">
          <h3>DC Number</h3>
          <form onSubmit={findDcReport}>
            <input
              value={dcNo}
              onChange={(event) => setDcNo(event.target.value.toUpperCase())}
              placeholder="Enter common DC No."
            />
            <button className="primary" disabled={loading}>
              <Search /> View DC
            </button>
          </form>
        </div>
      </section>

      {record && <div className="transaction-print-sheet" id="transaction-print">
        <TransactionReceipt record={record} />
      </div>}

      {dcReport && (
        <section className="card dc-print" id="dc-print">
          <header>
            <div>
              <h2>Accessories Flow</h2>
              <p>DC Outward Statement</p>
            </div>
            <div className="dc-header-main-qr">
              <QRGenerator value={productionLink()} size={100} />
              <b>Main DC QR</b>
            </div>
            <div className="dc-meta">
              <b>DC No: {dcReport.dcNo}</b>
              <span>Date: {new Date(dcReport.date).toLocaleDateString()}</span>
              <span>Item Name: {dcReport.itemNames.join(", ")}</span>
              <span>
                Section Name: {dcReport.sectionNames.join(", ") || "—"}
              </span>
              <span className="manual-size">Size:</span>
            </div>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th className="view-only-column">Outward No.</th>
                  <th className="view-only-column">Inward No.</th>
                  <th>Item Description</th>
                  <th>Item Code</th>
                  <th className="center-cell">Colour</th>
                  <th className="center-cell">QR</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {dcReport.entries.map((entry, index) => (
                  <tr key={entry._id || entry.referenceNo}>
                    <td>{index + 1}</td>
                    <td className="view-only-column">{entry.referenceNo}</td>
                    <td className="view-only-column">{entry.inwardReference || "—"}</td>
                    <td>{entry.description}</td>
                    <td>{entry.itemCode}</td>
                    <td className="center-cell">{entry.colour || "—"}</td>
                    <td className="center-cell dc-row-qr">
                      <QRGenerator value={outwardRowLink(entry)} size={58} />
                    </td>
                    <td>
                      {entry.quantity} {entry.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="screen-only-total">
                  <td colSpan="7">Total Quantity</td>
                  <td>{dcReport.totalQuantity}</td>
                </tr>
                <tr className="print-only-total">
                  <td colSpan="5">Total Quantity</td>
                  <td>{dcReport.totalQuantity}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="remarks">
            <b>Remarks:</b>
            <span></span>
            <span></span>
          </div>
          <div className="signatures">
            <div>
              <span></span>
              <b>Prepared By</b>
            </div>
            <div>
              <span></span>
              <b>Checked By</b>
            </div>
            <div>
              <span></span>
              <b>Authorized By</b>
            </div>
          </div>
          <footer className="no-print">
            <button onClick={() => printTransaction("dc-print")}>
              <Printer /> Print
            </button>
            <button className="primary" onClick={() => downloadDcPdf(dcReport)}>
              <Download /> Download PDF
            </button>
          </footer>
        </section>
      )}
    </>
  );
}
