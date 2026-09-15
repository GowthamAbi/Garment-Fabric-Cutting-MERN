import { Camera, CameraOff, Keyboard } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

function extractValue(rawValue, field) {
  const value = rawValue.trim();
  try {
    const url = new URL(value);
    return url.searchParams.get(field) || value;
  } catch {
    return value;
  }
}

export default function QRScanInput({ field, label, value, onChange, required = true }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const scannerId = useId();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  function stopScanner() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startScanner() {
    setError("");
    if (!("BarcodeDetector" in window)) {
      setError("This browser camera scanner is not supported. Use Chrome/Brave or scan with a USB scanner.");
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent("accessories-qr-scanner-open", { detail: scannerId }));
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
    } catch (scanError) {
      stopScanner();
      setError(scanError?.message || "Camera permission is required to scan the QR code.");
    }
  }

  useEffect(() => {
    const closeOtherScanner = (event) => {
      if (event.detail !== scannerId) stopScanner();
    };
    window.addEventListener("accessories-qr-scanner-open", closeOtherScanner);
    return () => {
      window.removeEventListener("accessories-qr-scanner-open", closeOtherScanner);
      stopScanner();
    };
  }, [scannerId]);

  useEffect(() => {
    if (!scanning || !videoRef.current || !streamRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const detect = async () => {
      if (!streamRef.current || !videoRef.current) return;
      if (video.readyState >= 2) {
        try {
          const codes = await detectorRef.current.detect(video);
          if (codes[0]?.rawValue) {
            onChange(extractValue(codes[0].rawValue, field));
            stopScanner();
            return;
          }
        } catch {
          // Continue with the next frame while camera focus settles.
        }
      }
      frameRef.current = requestAnimationFrame(detect);
    };

    video.play().then(() => {
      frameRef.current = requestAnimationFrame(detect);
    }).catch((playError) => {
      setError(playError?.message || "Unable to display camera preview.");
      stopScanner();
    });

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [scanning, field, onChange]);

  return (
    <label className="qr-scan-field">
      <span>{label}</span>
      <div className="qr-scan-control">
        <input
          required={required}
          value={value}
          placeholder={`Scan ${label}`}
          onChange={(event) => onChange(extractValue(event.target.value, field))}
        />
        <button type="button" className={scanning ? "danger" : "scan-button"} onClick={scanning ? stopScanner : startScanner}>
          {scanning ? <CameraOff /> : <Camera />}
          {scanning ? "Stop" : "Scan"}
        </button>
      </div>
      {scanning && <div className="qr-camera-backdrop"><div className="qr-camera-modal"><div className="qr-camera-title"><strong>Scan {label}</strong><button type="button" className="danger" onClick={stopScanner}><CameraOff /> Stop</button></div><div className="qr-camera"><video ref={videoRef} muted playsInline /><div className="qr-camera-frame" /></div><small>Place the QR clearly inside the green box</small></div></div>}
      {error && <small className="scan-error"><Keyboard /> {error}</small>}
    </label>
  );
}
