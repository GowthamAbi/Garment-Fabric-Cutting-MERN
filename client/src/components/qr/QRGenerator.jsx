import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRGenerator({ value, size = 180, onReady }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!value) {
      setDataUrl("");
      return;
    }

    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#102f29",
        light: "#ffffff",
      },
    }).then((url) => {
      setDataUrl(url);
      onReady?.(url);
    });
  }, [value, size, onReady]);

  if (!value)
    return <div className="qr-placeholder">Save inward to generate QR</div>;
  if (!dataUrl) return <div className="qr-placeholder">Generating QR...</div>;

  return (
    <img
      className="qr-image"
      src={dataUrl}
      width={size}
      height={size}
      alt={`QR code for ${value}`}
    />
  );
}
