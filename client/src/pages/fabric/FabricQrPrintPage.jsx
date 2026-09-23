import { useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import { printElement } from "../../services/printService.js";

export default function FabricQrPrintPage({ notify }) {
  const [number, setNumber] = useState("");
  const [inward, setInward] = useState(null);
  const [rolls, setRolls] = useState([]);
  const [cfg, setCfg] = useState({ width: 70, height: 48, qr: 23, gapX: 4, gapY: 4, columns: 2, page: "a4" });

  async function find() {
    try {
      const [entry, entryRolls] = await Promise.all([api.inward(number), api.bundles(number)]);
      setInward(entry);
      setRolls(entryRolls);
    } catch (error) {
      setInward(null);
      notify?.(error.message);
    }
  }

  async function download() {
    if (!rolls.length) return;
    const pdf = new jsPDF({ unit: "mm", format: cfg.page });
    let x = 10;
    let y = 10;
    for (let index = 0; index < rolls.length; index += 1) {
      const roll = rolls[index];
      if (y + Number(cfg.height) > pdf.internal.pageSize.height - 8) {
        pdf.addPage(); x = 10; y = 10;
      }
      pdf.rect(x, y, Number(cfg.width), Number(cfg.height));
      const qr = await QRCode.toDataURL(`${location.origin}/fabric-roll/${roll.qrToken}`, { margin: 1, width: 300 });
      pdf.addImage(qr, "PNG", x + 3, y + 3, Number(cfg.qr), Number(cfg.qr));
      pdf.setFontSize(7);
      pdf.text([
        `${roll.fabricGroup} / ${roll.fabricName}`,
        `${roll.colour} · Dia ${roll.dia}`,
        `Batch: ${roll.batchNo || "Legacy"}`,
        `Set No: ${roll.setNo || "-"}`,
        `Dyeing: ${roll.dyeingName || "-"}`,
        `Compacting: ${roll.compactingName || "-"}`,
        `DC: ${inward.dcNo || inward.lotDcNo || "-"}`,
        `WT: ${roll.originalWeightKg} KG · ROLL ${roll.rollNo}/${rolls.length}`,
      ], x + Number(cfg.qr) + 6, y + 7);
      if ((index + 1) % Number(cfg.columns) === 0) { x = 10; y += Number(cfg.height) + Number(cfg.gapY); }
      else x += Number(cfg.width) + Number(cfg.gapX);
    }
    pdf.save(`${inward.inwardNo}-roll-qr.pdf`);
  }

  return <section className="classic-page">
    <div className="classic-title"><div><small>FABRIC INWARD</small><h2>Fabric Roll QR Print</h2><p>Generate one cut-ready rectangular QR label for every inward roll.</p></div></div>
    <div className="classic-card">
      <div className="lookup-bar"><input placeholder="Inward Number" value={number} onChange={(e) => setNumber(e.target.value)} /><button className="primary" onClick={find}><Search /> Load Rolls</button></div>
      <div className="qr-config">{[["width", "Width mm"], ["height", "Height mm"], ["qr", "QR mm"], ["gapX", "Horizontal Gap"], ["gapY", "Vertical Gap"], ["columns", "Labels / Row"]].map(([key, label]) => <label key={key}>{label}<input type="number" value={cfg[key]} onChange={(e) => setCfg({ ...cfg, [key]: e.target.value })} /></label>)}<label>Page<select value={cfg.page} onChange={(e) => setCfg({ ...cfg, page: e.target.value })}><option value="a4">A4</option><option value="a5">A5</option></select></label></div>
    </div>
    {inward && <><div className="page-actions"><button onClick={() => printElement("fabric-roll-label-print")}><Printer /> Print All</button><button className="primary" onClick={download}><Download /> Download PDF</button></div>
      <div id="fabric-roll-label-print" className="fabric-label-grid" style={{ gridTemplateColumns: `repeat(${cfg.columns},${cfg.width}mm)`, gap: `${cfg.gapY}mm ${cfg.gapX}mm` }}>
        {rolls.map((roll) => <article key={roll._id} style={{ width: `${cfg.width}mm`, height: `${cfg.height}mm` }}><QRGenerator size={Math.round(Number(cfg.qr) * 3.78)} value={`${location.origin}/fabric-roll/${roll.qrToken}`} /><div><b>{roll.fabricGroup} / {roll.fabricName}</b><span>{roll.colour} · Dia {roll.dia}</span><span>Batch: {roll.batchNo || "Legacy"}</span><span>Set No: {roll.setNo || "—"}</span><span>Dyeing: {roll.dyeingName || "—"}</span><span>Compacting: {roll.compactingName || "—"}</span><span>DC: {inward.dcNo || inward.lotDcNo || "—"}</span><strong>{roll.originalWeightKg} KG · ROLL {roll.rollNo}/{rolls.length}</strong></div></article>)}
      </div></>}
  </section>;
}
