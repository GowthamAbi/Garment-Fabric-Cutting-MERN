import QRGenerator from "./QRGenerator.jsx";
export default function QRPrintLayout({ inward }) {
  return (
    <section className="qr-print">
      <QRGenerator value={inward.referenceNo} />
      <div>
        <b>{inward.referenceNo}</b>
        <p>
          {inward.itemCode} · {inward.quantity}
        </p>
      </div>
      <button onClick={() => window.print()}>Print</button>
    </section>
  );
}
