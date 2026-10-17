import { useEffect, useState } from "react";
import { subscribeToLoading } from "../../services/loadingService.js";
import UGSaaSLoader from "./UGSaaSLoader.jsx";

// Compatibility for code using the global fetch loading service. App currently
// mounts GlobalFeedback for request events; mount only one overlay at a time.
export default function GlobalLoader() {
  const [visible, setVisible] = useState(false);
  useEffect(() => subscribeToLoading(setVisible), []);
  if (!visible) return null;
  return <div className="ug-global-loader-backdrop">
    <UGSaaSLoader message="Loading your workspace..." />
  </div>;
}
