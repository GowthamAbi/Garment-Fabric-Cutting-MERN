import QRScanner from "../../components/qr/QRScanner.jsx";
export default function QRScanPage({ onScan }) {
  return <QRScanner onValue={onScan} />;
}
