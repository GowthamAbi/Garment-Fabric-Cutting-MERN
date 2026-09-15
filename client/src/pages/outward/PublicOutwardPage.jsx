import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import {
  createPublicOutward,
  getPublicInward,
} from "../../api/publicOutwardApi.js";
import { downloadTransactionPdf } from "../../services/printService.js";

export default function PublicOutwardPage({ inwardNo }) {
  const [inward, setInward] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [scanNext, setScanNext] = useState(false);
  const [nextScanValue, setNextScanValue] = useState("");
  const [form, setForm] = useState({ itemName: "", dcNo: "", section: "", wantedMtr: "" });
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    error: "",
    success: "",
  });

  useEffect(() => {
    getPublicInward(inwardNo)
      .then((data) => {
        setInward(data);
        setStatus((current) => ({ ...current, loading: false }));
      })
      .catch((error) =>
        setStatus((current) => ({
          ...current,
          loading: false,
          error: error.message,
        })),
      );
  }, [inwardNo]);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submitOutward(event) {
    event.preventDefault();
    const wantedQty = Number(form.wantedMtr);

    if (!form.itemName.trim() || !form.dcNo.trim() || !form.section.trim() || wantedQty <= 0) {
      setStatus((current) => ({
        ...current,
        error: "Item Name, DC No, Section Name and valid Wanted Mtr are required",
        success: "",
      }));
      return;
    }

    setStatus((current) => ({
      ...current,
      saving: true,
      error: "",
      success: "",
    }));

    try {
      const result = await createPublicOutward({
        inwardNo,
        itemName: form.itemName.trim(),
        dcNo: form.dcNo.trim(),
        section: form.section.trim(),
        wantedQty,
      });

      setInward((current) => ({
        ...current,
        availableQty: result.availableQty,
      }));
      setReceipt(result);
      setForm((current) => ({
        ...current,
        itemName: "",
        wantedMtr: "",
      }));
      setStatus({
        loading: false,
        saving: false,
        error: "",
        success: `Outward saved: ${result.outwardNo}`,
      });
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: error.message,
      }));
    }
  }

  function openNextInward(event) {
    event.preventDefault();
    const scannedValue = nextScanValue.trim();
    if (!scannedValue) return;
    let nextInwardNo = scannedValue;
    try {
      const scannedUrl = new URL(scannedValue);
      nextInwardNo = scannedUrl.searchParams.get("inwardNo") || scannedValue;
    } catch {
      // Hardware scanners may enter only the inward number.
    }
    window.location.assign(
      `/outward?inwardNo=${encodeURIComponent(nextInwardNo.toUpperCase())}`,
    );
  }

  if (status.loading)
    return (
      <main className="public-outward-state">Loading inward details...</main>
    );
  if (!inward)
    return <main className="public-outward-state error">{status.error}</main>;

  return (
    <main className="public-outward-page">
      <section className="public-outward-card">
        <header className="public-outward-header">
          <span className="public-outward-logo">
            <PackageCheck />
          </span>
          <div>
            <h1>Outward Entry</h1>
            <p>Accessories Flow · QR-linked stock issue</p>
          </div>
        </header>

        <div className="inward-summary">
          <h2>Inward Details</h2>
          <dl>
            <div>
              <dt>Inward No.</dt>
              <dd>{inward.inwardNo}</dd>
            </div>
            <div>
              <dt>Item Code</dt>
              <dd>{inward.itemCode}</dd>
            </div>
            <div>
              <dt>Item Description</dt>
              <dd>{inward.description}</dd>
            </div>
            <div>
              <dt>Brand</dt>
              <dd>{inward.brand || "—"}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{inward.type || "—"}</dd>
            </div>
            <div>
              <dt>Colour</dt>
              <dd>{inward.colour || "—"}</dd>
            </div>
            <div>
              <dt>Inward Mtr</dt>
              <dd>
                {inward.inwardQty} {inward.unit}
              </dd>
            </div>
            <div className="available">
              <dt>Available Mtr</dt>
              <dd>
                {inward.availableQty} {inward.unit}
              </dd>
            </div>
          </dl>
        </div>

        <form className="public-outward-form" onSubmit={submitOutward}>
          <label>
            <span>Inward Reference</span>
            <input value={inward.inwardNo} readOnly />
          </label>
          <label>
            <span>DC No.</span>
            <input
              name="dcNo"
              value={form.dcNo}
              onChange={updateField}
              placeholder="Enter DC number"
            />
          </label>
          <label>
            <span>Item Name</span>
            <input
              name="itemName"
              required
              autoComplete="off"
              value={form.itemName}
              onChange={updateField}
              placeholder="Enter item name manually"
            />
          </label>
          <label>
            <span>Section Name / Issued To</span>
            <input
              name="section"
              value={form.section}
              onChange={updateField}
              placeholder="Enter section"
            />
          </label>
          <label>
            <span>Wanted Mtr</span>
            <input
              name="wantedMtr"
              type="number"
              min="0.001"
              step="0.001"
              max={inward.availableQty}
              value={form.wantedMtr}
              onChange={updateField}
              placeholder="0"
            />
          </label>

          {status.error && (
            <p className="public-message error">{status.error}</p>
          )}
          <button
            className="public-submit"
            disabled={status.saving || inward.availableQty <= 0}
          >
            {status.saving
              ? "Saving..."
              : inward.availableQty <= 0
                ? "Stock Fully Issued"
                : "Submit Outward"}
          </button>
        </form>
      </section>
      {receipt && (
        <div className="outward-success-overlay" role="dialog" aria-modal="true">
          <section className="outward-success-popup">
            <PackageCheck />
            <h2>Outward Completed</h2>
            <p><b>{receipt.outwardNo}</b> successfully saved.</p>
            <p>DC No: {receipt.dcNo} · Quantity: {receipt.quantity} {receipt.unit}</p>
            {!scanNext ? (
              <div className="outward-success-actions">
                <button type="button" onClick={() => downloadTransactionPdf(receipt)}>Download Outward PDF</button>
                <button className="primary" type="button" onClick={() => setScanNext(true)}>Scan Next Inward</button>
              </div>
            ) : (
              <form className="next-inward-scan" onSubmit={openNextInward}>
                <label>
                  <span>Scan QR or enter next Inward No.</span>
                  <input autoFocus value={nextScanValue} onChange={(event) => setNextScanValue(event.target.value)} placeholder="INW-... or complete QR link" />
                </label>
                <button className="primary">Open Next Inward</button>
                <button type="button" onClick={() => setScanNext(false)}>Back</button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
