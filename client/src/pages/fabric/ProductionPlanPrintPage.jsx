import { useRef, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import ProductionPlanDocument from "./ProductionPlanDocument.jsx";
import { printElement } from "../../services/printService.js";

export default function ProductionPlanPrintPage({ notify }) {
  const [number, setNumber] = useState("");
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  async function find() {
    setBusy(true);
    try {
      setPlan(await api.plan(number));
    } catch (error) {
      setPlan(null);
      notify?.(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function pdf() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const file = new jsPDF({ unit: "mm", format: "a4" });
      await file.html(ref.current, {
        x: 8,
        y: 8,
        width: 194,
        windowWidth: 1100,
        autoPaging: "text",
      });
      file.save(`${plan.planNo}-production-plan.pdf`);
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
          <h2>Production Plan · Print</h2>
          <p>Enter Plan No or DC No to view a clean A4 document.</p>
        </div>
      </div>
      <div className="classic-card print-search">
        <label>
          <span>Plan No / DC No</span>
          <div className="input-action">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && find()}
            />
            <button onClick={find} disabled={busy}>
              <Search />
            </button>
          </div>
        </label>
        {plan && (
          <div className="form-actions">
            <button onClick={() => printElement("production-plan-print")}>
              <Printer /> Print
            </button>
            <button onClick={pdf} disabled={busy}>
              <Download /> {busy ? "Preparing..." : "PDF"}
            </button>
          </div>
        )}
      </div>
      <div id="production-plan-print">
        <ProductionPlanDocument plan={plan} documentRef={ref} />
      </div>
    </section>
  );
}
