import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function GlobalFeedback() {
  const [pending, setPending] = useState(0);
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

  return <>
    {pending > 0 && <div className="global-loading-overlay"><div><LoaderCircle className="spin" /><b>Loading...</b><small>Please wait</small></div></div>}
    {error && <div className="global-error-backdrop" role="alertdialog"><div className="global-error-popup"><AlertTriangle /><h3>Unable to Continue</h3><p>{error}</p><button className="primary" onClick={() => setError("")}><X /> OK</button></div></div>}
  </>;
}
