import { Download } from "lucide-react";
import { downloadCsv } from "../api/http.js";
export function PageTitle({ title, text, rows = [], file = "report.csv" }) { return <div className="page-title"><div><h2>{title}</h2><p>{text}</p></div>{rows.length > 0 && <button className="secondary" onClick={() => downloadCsv(file, rows)}><Download />Excel</button>}</div>; }
export function Empty({ loading, rows, text = "No records found" }) { if (loading) return <div className="empty">Loading data...</div>; if (!rows.length) return <div className="empty">{text}</div>; return null; }
export function Field({ label, children }) { return <label><span>{label}</span>{children}</label>; }
