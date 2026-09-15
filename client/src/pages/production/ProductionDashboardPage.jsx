import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cog, PlayCircle } from "lucide-react";
import { getProductionSummary } from "../../api/productionApi.js";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

export default function ProductionDashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => { getProductionSummary().then(setData); }, []);
  if (!data) return <div className="loading">Loading production dashboard...</div>;
  const cards = [
    ["Machines Running", data.counts.running, PlayCircle],
    ["Machines Available", data.counts.available, CheckCircle2],
    ["Breakdown", data.counts.breakdown, Cog],
    ["Pending Issues", data.counts.pending, AlertTriangle],
    ["Today Planned Pcs", data.counts.todayPlannedPcs, PlayCircle],
    ["Today OK Pcs", data.counts.todayOkPcs, CheckCircle2],
    ["Rework Pcs", data.counts.reworkPcs, Cog],
    ["Rejection Pcs", data.counts.rejectionPcs, AlertTriangle],
    ["Sewing Hold", data.counts.sewingHold, AlertTriangle],
  ];
  return <>
    <PageTitle title="Dashboard" subtitle="Live machine, output and pending status" />
    <div className="stats">{cards.map(([label, value, Icon]) => <div className="stat" key={label}><div><span>{label}</span><b>{value}</b></div><i><Icon /></i></div>)}</div>
    <div className="dashboard-grid">
      <Card title="Machine availability">{data.machines.map((machine) => <div className="alert" key={machine._id}><div><b>{machine.machineCode} · {machine.machineName}</b><small>{machine.nextPlan || "No next plan"}</small></div><span>{machine.status}</span></div>)}</Card>
      <Card title="Critical production pending">{data.pendingIssues.length ? data.pendingIssues.map((issue) => <div className="alert" key={issue._id}><div><b>{issue.colour} · {issue.size || "All sizes"}</b><small>{issue.section} · {issue.reason}</small></div><span>{issue.priority}</span></div>) : <p className="empty">No active pending issues</p>}</Card>
    </div>
  </>;
}
