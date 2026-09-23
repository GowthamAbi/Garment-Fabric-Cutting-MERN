import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, Clock3, FileText, RefreshCw, TrendingUp, Users } from "lucide-react";
import { api } from "../../api.js";

const definitions = {
  FABRIC: {
    title: "Fabric Department Dashboard",
    subtitle: "Live inward, production plan, folding and stock overview",
    sources: ["/fabric-cutting/inwards", "/fabric-cutting/plans", "/fabric-cutting/stock/balance"],
    actions: [["New Inward", "Fabric Inward Entry"], ["Production Plan", "Fabric Entry"], ["Folding Entry", "Folding Entry"], ["Stock Balance", "Fabric Stock Balance"]],
  },
  CUTTING: {
    title: "Cutting Department Dashboard",
    subtitle: "Cutting plans, actual production, stock and pending status",
    sources: ["/fabric-cutting/plans", "/fabric-cutting/actuals", "/delivery/cutting-stock"],
    actions: [["Actual Entry", "Cutting Actual Entry"], ["Machine Plan", "Machine Plan Entry"], ["Cutting Stock", "Cutting Stock"], ["Time Status", "Cutter Timeline"]],
  },
  DELIVERY: {
    title: "Delivery Department Dashboard",
    subtitle: "Vendor, eligible plan, challan and section delivery overview",
    sources: ["/delivery/vendors", "/delivery/plans", "/delivery/history"],
    actions: [["Vendor Registration", "Vendor Registration"], ["Plan Details", "Delivery Plan Details"], ["Section Plan", "Section Plan"], ["History", "Section History"]],
  },
  ADMIN: {
    title: "Admin Department Dashboard",
    subtitle: "User access, setup, subscription and system-control overview",
    sources: ["/auth/users"],
    actions: [["Item Master", "Item Master"], ["User Management", "User Management"], ["Subscription", "Subscription"], ["Audit & Backup", "Audit & Backup"]],
  },
};

const safeArray = (value) => Array.isArray(value) ? value : value?.rows || value?.items || [];
const ageDays = (date) => Math.max(0, Math.floor((Date.now() - new Date(date || Date.now())) / 86400000));

export default function DepartmentOverviewPage({ department, notify, onPageChange }) {
  const config = definitions[department];
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(config.sources.map((path) => api(path)));
    setSources(results.map((result) => result.status === "fulfilled" ? safeArray(result.value) : []));
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) notify?.(`${failed.length} dashboard source could not be loaded`);
    setUpdatedAt(new Date());
    setLoading(false);
  }, [config, notify]);
  useEffect(() => { load(); }, [load]);
  const dashboard = useMemo(() => buildDashboard(department, sources), [department, sources]);

  return <section className="department-overview">
    <header className="department-overview-hero">
      <div><small>LIVE DEPARTMENT CONTROL</small><h1>{config.title}</h1><p>{config.subtitle}</p></div>
      <div className="dashboard-refresh"><span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Loading live data"}</span><button onClick={load} disabled={loading}><RefreshCw className={loading ? "spin" : ""}/> Refresh</button></div>
    </header>

    <div className="overview-metrics">
      {dashboard.cards.map(({ label, value, note, tone }, index) => {
        const Icon = [Boxes, Clock3, CheckCircle2, TrendingUp][index % 4];
        return <article className={tone || ""} key={label}><i><Icon/></i><div><span>{label}</span><b>{value}</b><small>{note}</small></div></article>;
      })}
    </div>

    <div className="overview-layout">
      <article className="overview-panel"><div className="panel-heading"><div><small>7-DAY VIEW</small><h3>Activity Trend</h3></div><TrendingUp/></div><div className="mini-chart">{dashboard.trend.map((bar) => <div className="mini-chart-column" key={bar.label}><span title={`${bar.value} entries`} style={{height:`${Math.max(8, bar.percent)}%`}}></span><b>{bar.value}</b><small>{bar.label}</small></div>)}</div></article>
      <article className="overview-panel"><div className="panel-heading"><div><small>ATTENTION</small><h3>Alerts & Pending</h3></div><AlertTriangle/></div><div className="overview-alerts">{dashboard.alerts.length ? dashboard.alerts.map((alert, index) => <div key={`${alert.title}-${index}`}><i className={alert.level || "warning"}></i><span><b>{alert.title}</b><small>{alert.detail}</small></span></div>) : <div><i className="healthy"></i><span><b>No critical alert</b><small>Current department data is healthy.</small></span></div>}</div></article>
    </div>

    <div className="overview-layout bottom">
      <article className="overview-panel"><div className="panel-heading"><div><small>LATEST UPDATES</small><h3>Recent Activity</h3></div><FileText/></div><div className="recent-activity">{dashboard.recent.length ? dashboard.recent.map((row, index) => <div key={row.id || index}><span><b>{row.title}</b><small>{row.detail}</small></span><time>{row.date ? new Date(row.date).toLocaleDateString() : "—"}</time></div>) : <p className="empty">No recent activity available.</p>}</div></article>
      <article className="overview-panel"><div className="panel-heading"><div><small>SHORTCUTS</small><h3>Quick Actions</h3></div><Users/></div><div className="overview-actions">{config.actions.map(([label,page]) => <button key={page} onClick={() => onPageChange?.(page)}><span>{label}</span><small>Open module →</small></button>)}</div></article>
    </div>
  </section>;
}

function trendFrom(rows) {
  const points = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6-index)); return { key: date.toISOString().slice(0,10), label: date.toLocaleDateString(undefined,{weekday:"short"}), value: 0 }; });
  rows.forEach((row) => { const point = points.find((item) => item.key === new Date(row.createdAt || row.deliveryDate || 0).toISOString().slice(0,10)); if (point) point.value += 1; });
  const max = Math.max(1, ...points.map((x) => x.value));
  return points.map((x) => ({...x, percent:(x.value/max)*100}));
}
function recentRows(rows, mapper) { return [...rows].sort((a,b)=>new Date(b.createdAt||b.deliveryDate)-new Date(a.createdAt||a.deliveryDate)).slice(0,6).map(mapper); }
function buildDashboard(department, [first=[], second=[], third=[]]) {
  if (department === "FABRIC") {
    const pending = second.filter((x) => x.status !== "COMPLETED").length;
    const balance = third.reduce((sum,x)=>sum+Number(x.balanceWeightKg||x.balanceKg||0),0);
    return { cards:[{label:"Fabric Inwards",value:first.length,note:"Total inward records"},{label:"Open Plans",value:pending,note:"Plans awaiting completion",tone:pending?"warn":""},{label:"Completed Plans",value:second.length-pending,note:"Production completed",tone:"good"},{label:"Balance Stock KG",value:balance.toFixed(2),note:"Available fabric balance"}], trend:trendFrom(first), alerts:[...second.filter(x=>x.status!=="COMPLETED").slice(0,4).map(x=>({title:`Plan ${x.planNo} pending`,detail:`${x.itemName||x.itemCode} · ${ageDays(x.createdAt)} days`,level:"warning"})), ...(balance<=0?[{title:"No fabric balance",detail:"Check inward and issue entries.",level:"danger"}]:[])], recent:recentRows(first,x=>({id:x._id,title:`Inward ${x.inwardNo}`,detail:`${x.fabricName||x.fabricCode||"Fabric"} · ${x.totalWeightKg||0} KG`,date:x.createdAt})) };
  }
  if (department === "CUTTING") {
    const completed = second.filter(x=>x.status==="COMPLETED"); const pending=Math.max(0,first.length-completed.length); const stock=third.reduce((s,x)=>s+Number(x.balancePcs||0),0);
    return {cards:[{label:"Cutting Plans",value:first.length,note:"Total plans created"},{label:"Pending Plans",value:pending,note:"Actual entry pending",tone:pending?"warn":""},{label:"Completed Actuals",value:completed.length,note:"Cutting completed",tone:"good"},{label:"Available Cutting PCS",value:stock,note:"Awaiting section delivery"}],trend:trendFrom(second),alerts:first.filter(p=>!second.some(a=>a.planNo===p.planNo&&a.status==="COMPLETED")).slice(0,5).map(p=>({title:`${p.planNo} actual pending`,detail:`DC ${p.dcNo} · ${ageDays(p.createdAt)} days`,level:"warning"})),recent:recentRows(second,x=>({id:x._id,title:`Actual ${x.actualNo}`,detail:`${x.planNo} · ${x.totalActualPcs||0} PCS`,date:x.createdAt}))};
  }
  if (department === "DELIVERY") {
    const eligible=second.filter(x=>x.eligible&&x.cuttingBalancePcs>0); const delivered=third.reduce((s,x)=>s+Number(x.totalPcs||0),0);
    return {cards:[{label:"Active Vendors",value:first.filter(x=>x.active!==false).length,note:"Registered vendors"},{label:"Eligible Plans",value:eligible.length,note:"Cutting + Folding completed",tone:eligible.length?"good":""},{label:"Delivery Challans",value:third.length,note:"Total challans generated"},{label:"Delivered PCS",value:delivered,note:"Issued to sections"}],trend:trendFrom(third),alerts:[...eligible.slice(0,4).map(x=>({title:`${x.planNo} ready for delivery`,detail:`${x.itemName} · ${x.cuttingBalancePcs} PCS`,level:"healthy"})),...second.filter(x=>!x.eligible).slice(0,2).map(x=>({title:`${x.planNo} not ready`,detail:`Cutting: ${x.cuttingStatus}, Folding: ${x.foldingStatus}`,level:"warning"}))],recent:recentRows(third,x=>({id:x._id,title:`Challan ${x.challanNo}`,detail:`${x.vendorName} · ${x.totalPcs} PCS`,date:x.deliveryDate||x.createdAt}))};
  }
  const active=first.filter(x=>x.active!==false).length, admins=first.filter(x=>String(x.role).includes("admin")).length;
  return {cards:[{label:"Total Users",value:first.length,note:"Created accounts"},{label:"Active Users",value:active,note:"Currently enabled",tone:"good"},{label:"Admin Users",value:admins,note:"Administrative access"},{label:"Inactive Users",value:first.length-active,note:"Access disabled",tone:first.length-active?"warn":""}],trend:trendFrom(first),alerts:first.filter(x=>x.active===false).slice(0,5).map(x=>({title:`${x.name} is inactive`,detail:x.email,level:"warning"})),recent:recentRows(first,x=>({id:x._id,title:x.name,detail:`${x.role} · ${x.department||"All departments"}`,date:x.createdAt}))};
}
