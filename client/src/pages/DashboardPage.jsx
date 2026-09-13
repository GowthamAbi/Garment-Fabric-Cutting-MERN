import { useEffect, useState } from "react";
import { api } from "../api/http.js";
import { PageTitle } from "../components/Common.jsx";
export default function DashboardPage() {
  const [data, setData] = useState({ machineStatus: [], queue: [] });
  useEffect(() => { api("/dashboard").then(setData).catch(() => {}); }, []);
  return <><PageTitle title="Fabric and Cutting Dashboard" text="PO delivery, fabric stock, cutting queue and live machine status." /><div className="stats"><article><small>FABRIC AVAILABLE</small><strong>{data.fabricAvailableKg || 0} KG</strong></article><article><small>PO PENDING</small><strong>{data.poPendingPieces || 0} PCS</strong></article><article><small>CUTTING QUEUE</small><strong>{data.cuttingQueue || 0}</strong></article><article><small>RUNNING MACHINES</small><strong>{data.runningMachines || 0}</strong></article></div><section className="card"><h3>Live Machine Status</h3><div className="table"><table><thead><tr><th>Machine</th><th>Type</th><th>Outward DC</th><th>Status</th></tr></thead><tbody>{data.machineStatus.map((row) => <tr key={row._id}><td>{row.machineCode}</td><td>{row.machineType}</td><td>{row.currentOutwardNo || "-"}</td><td><span className={`tag ${row.status.toLowerCase()}`}>{row.status}</span></td></tr>)}</tbody></table></div></section></>;
}
