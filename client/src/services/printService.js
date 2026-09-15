import { jsPDF } from "jspdf";
import QRCode from "qrcode";

function rowsFor(record) {
  return [
    ["Reference No", record.referenceNo || record.outwardNo || record.inwardNo],
    ["Transaction", record.kind || "OUTWARD"],
    ["Inward Reference", record.inwardReference || record.inwardNo || "-"],
    ["PO No", record.poNo || "-"],
    ["Indent No", record.indentNo || "-"],
    ["Item Code", record.itemCode || "-"],
    ["Item Name / Usage", record.itemName || record.description || "-"],
    ["Brand", record.brand || "-"],
    ["Type", record.type || "-"],
    ["Colour", record.colour || "-"],
    ["DC No", record.dcNo || "-"],
    ["Section Name", record.section || "-"],
    [
      "Quantity",
      `${record.quantity ?? record.issuedQty ?? "-"} ${record.unit || ""}`,
    ],
    [
      "Balance",
      `${record.balanceQty ?? record.availableQty ?? "-"} ${record.unit || ""}`,
    ],
    [
      "Date",
      new Date(
        record.transactionDate || record.createdAt || Date.now(),
      ).toLocaleString(),
    ],
  ];
}

export async function downloadTransactionPdf(record) {
  if (!record) return;
  const referenceNo = record.referenceNo || record.outwardNo || record.inwardNo;
  const isInward = record.kind === "INWARD";
  const pdf = isInward
    ? new jsPDF({ orientation: "landscape", format: "a5" })
    : new jsPDF();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(isInward ? 17 : 20);
  pdf.text("Accessories Flow", 14, 16);
  pdf.setFontSize(isInward ? 11 : 14);
  pdf.text(`${record.kind || "OUTWARD"} RECEIPT`, 14, 25);
  pdf.setDrawColor(24, 130, 103);
  pdf.line(14, 29, 196, 29);

  let y = 38;
  rowsFor(record).forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(isInward ? 8 : 10);
    pdf.text(label, 14, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(value), isInward ? 54 : 72, y, { maxWidth: isInward ? 82 : 120 });
    y += isInward ? 6.8 : 10;
  });

  if (record.kind === "INWARD") {
    const qrLink = `${window.location.origin}/outward?inwardNo=${encodeURIComponent(record.referenceNo)}`;
    const qrDataUrl = await QRCode.toDataURL(qrLink, {
      width: 500,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    pdf.addImage(qrDataUrl, "PNG", 151, 38, 45, 45);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Scan for Outward Entry", 153, 88);
  }

  pdf.save(`${referenceNo}.pdf`);
}

export async function downloadDcPdf(report) {
  if (!report) return;
  const pdf = new jsPDF({ orientation: "landscape", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const columns = [12, 27, 112, 157, 197, 224];
  const widths = [15, 85, 45, 40, 27, 61];
  const headers = ["S.No", "Description", "Item Code", "Colour", "QR", "Quantity"];
  const manyRows = report.entries.length > 12;
  const fontSize = manyRows ? 6 : 7.5;
  const qrSize = manyRows ? 5.5 : 7.5;
  const minimumRowHeight = manyRows ? 7 : 9.5;

  const mainQrUrl = `${window.location.origin}/production?dcNo=${encodeURIComponent(report.dcNo)}`;
  const mainQrData = await QRCode.toDataURL(mainQrUrl, {
    width: 360,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const rowQrData = await Promise.all(
    report.entries.map((entry) => {
      const url =
        `${window.location.origin}/production?dcNo=${encodeURIComponent(report.dcNo)}` +
        `&outwardNo=${encodeURIComponent(entry.referenceNo || "")}` +
        `&inwardNo=${encodeURIComponent(entry.inwardReference || "")}` +
        `&colour=${encodeURIComponent(entry.colour || "")}`;
      return QRCode.toDataURL(url, {
        width: 260,
        margin: 1,
        errorCorrectionLevel: "M",
      });
    }),
  );

  pdf.setFillColor(18, 92, 75);
  pdf.rect(0, 0, pageWidth, 5, "F");
  pdf.setTextColor(18, 60, 51);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text("Accessories Flow", 14, 18);
  pdf.setFontSize(10);
  pdf.setTextColor(70, 91, 85);
  pdf.text("DC OUTWARD STATEMENT", 14, 27);

  pdf.addImage(mainQrData, "PNG", pageWidth / 2 - 13, 7, 26, 26);
  pdf.setFontSize(6.5);
  pdf.setTextColor(18, 60, 51);
  pdf.text("MAIN DC QR", pageWidth / 2, 36, { align: "center" });

  pdf.setFontSize(9);
  pdf.text(`DC No: ${report.dcNo}`, 220, 17);
  pdf.text(`Date: ${new Date(report.date).toLocaleDateString()}`, 220, 27);
  pdf.setDrawColor(24, 130, 103);
  pdf.setLineWidth(0.5);
  pdf.line(12, 41, 285, 41);

  pdf.setFillColor(244, 249, 247);
  pdf.roundedRect(12, 45, 273, 12, 2, 2, "F");
  pdf.setFontSize(8);
  pdf.setTextColor(18, 60, 51);
  pdf.text(`Item Name: ${report.itemNames.join(", ") || "-"}`, 16, 52, { maxWidth: 92 });
  pdf.text(`Section: ${report.sectionNames.join(", ") || "-"}`, 112, 52, { maxWidth: 82 });
  pdf.text("Size: __________________", 218, 52);

  let y = 61;
  const headerHeight = 9;
  pdf.setFillColor(18, 92, 75);
  pdf.rect(12, y, 273, headerHeight, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  headers.forEach((header, index) => {
    const center = columns[index] + widths[index] / 2;
    pdf.text(header, center, y + 5.8, { align: "center" });
  });
  y += headerHeight;

  pdf.setTextColor(25, 45, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  report.entries.forEach((entry, index) => {
    const values = [
      String(index + 1),
      entry.description || entry.itemCode,
      entry.itemCode || "-",
      entry.colour || "-",
      "",
      `${entry.quantity} ${entry.unit || ""}`,
    ];
    const wrapped = values.map((value, columnIndex) =>
      pdf.splitTextToSize(value, widths[columnIndex] - 4),
    );
    const textLines = Math.max(...wrapped.map((lines) => lines.length));
    const rowHeight = Math.max(minimumRowHeight, textLines * 3.2 + 3);

    if (index % 2 === 1) {
      pdf.setFillColor(248, 251, 250);
      pdf.rect(12, y, 273, rowHeight, "F");
    }
    pdf.setDrawColor(205, 220, 215);
    pdf.rect(12, y, 273, rowHeight);
    for (let columnIndex = 1; columnIndex < columns.length; columnIndex += 1) {
      pdf.line(columns[columnIndex], y, columns[columnIndex], y + rowHeight);
    }
    wrapped.forEach((lines, columnIndex) => {
      if (columnIndex === 4) return;
      const center = columns[columnIndex] + widths[columnIndex] / 2;
      pdf.text(lines, center, y + 4.3, {
        align: "center",
        lineHeightFactor: 1.05,
        maxWidth: widths[columnIndex] - 4,
      });
    });
    pdf.addImage(
      rowQrData[index],
      "PNG",
      columns[4] + (widths[4] - qrSize) / 2,
      y + (rowHeight - qrSize) / 2,
      qrSize,
      qrSize,
    );
    y += rowHeight;
  });

  const totalHeight = 9;
  pdf.setFillColor(231, 243, 239);
  pdf.rect(12, y, 273, totalHeight, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("TOTAL QUANTITY", 210, y + 5.8, { align: "right" });
  pdf.text(String(report.totalQuantity), 277, y + 5.8, { align: "right" });
  y += totalHeight + 5;

  const footerY = Math.min(y, 168);
  pdf.setFontSize(8);
  pdf.text("Remarks", 14, footerY);
  pdf.setDrawColor(130, 150, 144);
  pdf.line(14, footerY + 8, 283, footerY + 8);
  pdf.line(14, footerY + 15, 283, footerY + 15);

  const signatureLineY = 195;
  const signatures = [
    [20, 82, "Prepared By"],
    [117, 179, "Checked By"],
    [215, 277, "Authorized By"],
  ];
  signatures.forEach(([startX, endX, label]) => {
    pdf.line(startX, signatureLineY, endX, signatureLineY);
    pdf.text(label, (startX + endX) / 2, signatureLineY + 5, { align: "center" });
  });
  pdf.save(`${report.dcNo}-outward.pdf`);
}

async function createMasterQrPdf(kind, record) {
  const isMachine = kind === "machine";
  const code = isMachine ? record.machineCode : record.employeeCode;
  const name = isMachine ? record.machineName : record.employeeName;
  const link = `${window.location.origin}/production?${isMachine ? "machineCode" : "employeeCode"}=${encodeURIComponent(code)}`;
  const qrData = await QRCode.toDataURL(link, { width: 700, margin: 2, errorCorrectionLevel: "H" });
  const pdf = new jsPDF({ orientation: "portrait", format: "a5" });
  const width = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(18, 92, 75);
  pdf.rect(0, 0, width, 24, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Accessories Flow", width / 2, 10, { align: "center" });
  pdf.setFontSize(10);
  pdf.text(isMachine ? "MACHINE QR CARD" : "EMPLOYEE QR CARD", width / 2, 18, { align: "center" });
  pdf.addImage(qrData, "PNG", width / 2 - 43, 34, 86, 86);
  pdf.setTextColor(18, 60, 51);
  pdf.setFontSize(17);
  pdf.text(code, width / 2, 133, { align: "center" });
  pdf.setFontSize(13);
  pdf.text(name, width / 2, 143, { align: "center", maxWidth: width - 24 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const details = isMachine
    ? [`Type: ${record.machineType || "-"}`, `Section: ${record.section || "-"}`, `Capacity / Hr: ${record.capacityPerHour || "-"}`]
    : [`Employee No: ${code}`, `Department: ${record.department || "-"}`, `Section: ${record.section || "-"}`, `Shift: ${record.shift || "-"}`];
  details.forEach((detail, index) => pdf.text(detail, width / 2, 154 + index * 7, { align: "center" }));
  pdf.setFontSize(8);
  pdf.setTextColor(90, 105, 100);
  pdf.text("Scan this QR in Production Control", width / 2, 194, { align: "center" });
  return { pdf, code };
}

export async function downloadMasterQrPdf(kind, record) {
  const { pdf, code } = await createMasterQrPdf(kind, record);
  pdf.save(`${kind}-${code}.pdf`);
}

export async function printMasterQrPdf(kind, record) {
  const { pdf } = await createMasterQrPdf(kind, record);
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.width = "1px";
  printFrame.style.height = "1px";
  printFrame.style.opacity = "0";
  printFrame.src = pdf.output("bloburl");
  document.body.appendChild(printFrame);
  printFrame.onload = () => {
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();
    window.setTimeout(() => printFrame.remove(), 3000);
  };
}

export async function downloadSectionQrPdf(record) {
  const link = `${window.location.origin}/production?sectionCode=${encodeURIComponent(record.code)}`;
  const qrData = await QRCode.toDataURL(link, { width: 700, margin: 2, errorCorrectionLevel: "H" });
  const pdf = new jsPDF({ orientation: "portrait", format: "a5" });
  const width = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(18, 92, 75); pdf.rect(0, 0, width, 25, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
  pdf.text("Accessories Flow", width / 2, 11, { align: "center" });
  pdf.setFontSize(10); pdf.text("SECTION QR CARD", width / 2, 19, { align: "center" });
  pdf.addImage(qrData, "PNG", width / 2 - 43, 36, 86, 86);
  pdf.setTextColor(18, 60, 51); pdf.setFontSize(18); pdf.text(record.name, width / 2, 138, { align: "center" });
  pdf.setFontSize(13); pdf.text(`Section Code: ${record.code}`, width / 2, 150, { align: "center" });
  pdf.save(`section-${record.code}.pdf`);
}

export function printTransaction(targetId) {
  document.body.dataset.printTarget = targetId || "";
  window.requestAnimationFrame(() => {
    window.print();
    delete document.body.dataset.printTarget;
  });
}
export const printCurrentPage = printTransaction;

export async function downloadCuttingDcPdf(record) {
  const pdf = new jsPDF({ orientation: "landscape", format: "a4" });
  const rows = record.colours.flatMap((colour) => colour.sizes.map((size) => ({ ...size, colour: colour.colour })));
  pdf.setFillColor(18, 92, 75); pdf.rect(0, 0, 297, 6, "F");
  pdf.setTextColor(18, 60, 51); pdf.setFont("helvetica", "bold"); pdf.setFontSize(19); pdf.text("Accessories Flow", 14, 19);
  pdf.setFontSize(11); pdf.text("ELASTIC CUTTING DC", 14, 28);
  pdf.setFontSize(10); pdf.text(`DC No: ${record.dcNo}`, 218, 18); pdf.text(`Date: ${new Date(record.createdAt || Date.now()).toLocaleDateString()}`, 218, 27);
  pdf.setDrawColor(24, 130, 103); pdf.line(14, 34, 283, 34);
  pdf.setFontSize(9); pdf.text(`Item Name: ${record.itemName}`, 14, 44); pdf.text(`Item Code: ${record.itemCode || "-"}`, 105, 44); pdf.text(`Style: ${record.style}`, 190, 44); pdf.text(`Target: ${record.target || "-"}`, 250, 44);
  const x = [14, 31, 91, 126, 163, 211], widths = [17, 60, 35, 37, 48, 72], headers = ["S.No", "Colour", "Size", "PCS", "Measurement MTR/PCS", "Wanted MTR"];
  let y = 51; pdf.setFillColor(18, 92, 75); pdf.rect(14, y, 269, 10, "F"); pdf.setTextColor(255,255,255); pdf.setFontSize(8);
  headers.forEach((header, i) => pdf.text(header, x[i] + widths[i] / 2, y + 6.5, { align: "center" })); y += 10;
  pdf.setTextColor(25,45,40); pdf.setFont("helvetica", "normal");
  rows.forEach((row, index) => { if (index % 2) { pdf.setFillColor(247,250,249); pdf.rect(14,y,269,9,"F"); } pdf.setDrawColor(205,220,215); pdf.rect(14,y,269,9); x.slice(1).forEach((lineX) => pdf.line(lineX,y,lineX,y+9)); [index+1,row.colour,row.size,row.pcs,row.measurement,row.wantedMtr].forEach((value,i) => pdf.text(String(value),x[i]+widths[i]/2,y+6,{align:"center"})); y += 9; });
  pdf.setFont("helvetica", "bold"); pdf.text("TOTAL", 91, y + 7, { align: "right" }); pdf.text(String(record.totalPcs), 144.5, y + 7, { align: "center" }); pdf.text(`${record.totalMtr} MTR`, 247, y + 7, { align: "center" });
  pdf.setFontSize(8); pdf.text("Prepared By", 22, 184); pdf.text("Checked By", 135, 184); pdf.text("Authorised By", 248, 184);
  pdf.save(`${record.dcNo}-cutting-dc.pdf`);
}
