import { useEffect, useState } from "react";
export default function Feedback() {
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const start = () => setCount((value) => value + 1);
    const end = () => setCount((value) => Math.max(0, value - 1));
    const fail = (event) => { setError(event.detail); setTimeout(() => setError(""), 3500); };
    addEventListener("api:start", start); addEventListener("api:end", end); addEventListener("api:error", fail);
    return () => { removeEventListener("api:start", start); removeEventListener("api:end", end); removeEventListener("api:error", fail); };
  }, []);
  return <>{count > 0 && <div className="overlay"><div className="spinner" /><b>Loading data...</b></div>}{error && <div className="toast error">{error}</div>}</>;
}
