import { AlertTriangle, X } from "lucide-react";
import UGSaaSLoader from "./UGSaaSLoader.jsx";
import { useEffect, useState } from "react";

export default function GlobalFeedback() {
  const [pending, setPending] = useState(0);
  const [showLoader, setShowLoader] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const start = () => setPending((value) => value + 1);
    const end = () => setPending((value) => Math.max(0, value - 1));
    const fail = (event) => setError(event.detail || "Something went wrong");
    window.addEventListener("accessories-api-start", start);
    window.addEventListener("accessories-api-end", end);
    window.addEventListener("accessories-api-error", fail);
    return () => {
      window.removeEventListener("accessories-api-start", start);
      window.removeEventListener("accessories-api-end", end);
      window.removeEventListener("accessories-api-error", fail);
    };
  }, []);

  // Avoid flashing a modal for requests that finish almost instantly.
  useEffect(() => {
    if (pending === 0) {
      setShowLoader(false);
      return;
    }
    const id = window.setTimeout(() => setShowLoader(true), 180);
    return () => window.clearTimeout(id);
  }, [pending]);

  return (
    <>
      {showLoader && pending > 0 && (
        <div className="ug-global-loader-backdrop">
          <UGSaaSLoader message="Loading your workspace..." />
        </div>
      )}
      {error && (
        <div className="global-error-backdrop" role="alertdialog">
          <div className="global-error-popup">
            <AlertTriangle />
            <h3>Unable to Continue</h3>
            <p>{error}</p>
            <button className="primary" onClick={() => setError("")}>
              <X /> OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
