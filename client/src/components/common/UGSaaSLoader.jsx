import "./ugSaasLoader.css";

/**
 * A theme-aware, indeterminate loading indicator.
 * Do not show a simulated percentage: it might imply that an unfinished
 * network request is complete. The caller owns loading start/stop.
 */
export default function UGSaaSLoader({
  message = "Preparing your workspace...",
  size = "full",
  surface = "card",
  className = "",
}) {
  const compact = size === "compact";

  return (
    <div
      className={`ug-loader ug-loader--${compact ? "compact" : "full"} ug-loader--${surface === "transparent" ? "transparent" : "card"} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="ug-loader__orb" aria-hidden="true">
        <div className="ug-loader__aura" />
        <div className="ug-loader__orbit ug-loader__orbit--gold" />
        <div className="ug-loader__orbit ug-loader__orbit--teal" />
        <div className="ug-loader__orbit ug-loader__orbit--guide" />
        <div className="ug-loader__center">
          <svg className="ug-loader__machine" viewBox="0 0 100 80" fill="none" aria-hidden="true">
            <path d="M50 14 L36 24 H64 Z" stroke="#E4B65B" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="50" cy="10" r="3.2" stroke="#E4B65B" strokeWidth="2.2" />
            <path
              d="M20 64 H80 C82.2 64 84 62.2 84 60 V35 C84 28 78 24 70 24 H34 V38 H54 C56.5 38 58.5 40 58.5 42.5 C58.5 45 56.5 47 54 47 H34 V60"
              stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
            />
            <line x1="34" y1="47" x2="34" y2="60" stroke="#E4B65B" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="26" y1="64" x2="40" y2="64" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="68" y="18" width="7" height="6" rx="1.5" fill="#E4B65B" />
            <line x1="71.5" y1="18" x2="71.5" y2="15" stroke="#E4B65B" strokeWidth="1.5" />
            <path d="M62 55 Q72 50 82 55 T96 53" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M64 60 Q74 56 84 60 T98 58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
          </svg>
          <strong className="ug-loader__name">UG SaaS</strong>
          <span className="ug-loader__brand-rule" />
          <span className="ug-loader__tagline">Garment ERP Solutions</span>
        </div>
      </div>
      <div className="ug-loader__progress">
        <div className="ug-loader__status-line">
          <span className="ug-loader__status-label"><span className="ug-loader__beacon" /> Loading</span>
          <span className="ug-loader__status-note">Please wait</span>
        </div>
        <div className="ug-loader__track" aria-hidden="true">
          <span className="ug-loader__bar" />
        </div>
        <p className="ug-loader__message">{message}</p>
      </div>
    </div>
  );
}
