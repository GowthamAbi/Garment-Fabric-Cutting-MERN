import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { subscribeToLoading } from "../../services/loadingService.js";

export default function GlobalLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeToLoading(setVisible), []);

  if (!visible) return null;

  return (
    <div className="global-loader" role="status" aria-live="polite">
      <div className="global-loader-box">
        <LoaderCircle />
        <b>Loading...</b>
        <span>Please wait</span>
      </div>
    </div>
  );
}
