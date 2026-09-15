import { QrCode } from "lucide-react";
export default function QRScanner({ onValue }) {
  return (
    <div className="scanner">
      <QrCode />
      <h3>Scan inward QR</h3>
      <input
        placeholder="Scanner value"
        onChange={(event) => onValue(event.target.value)}
      />
    </div>
  );
}
