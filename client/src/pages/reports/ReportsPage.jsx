import { useEffect, useMemo, useState } from "react";
import { Download, FileSearch, Layers3, Printer, RefreshCw } from "lucide-react";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { downloadExcel } from "../../services/csvService.js";

const groups = {
  pos: "Purchase Orders", inwards: "Inwards", outwards: "Outwards",
  plans: "Production Plans", jobs: "Production", pending: "Pending & Issues",
  sewing: "Sewing Delivery", sewingHolds: "Sewing Holds",
  warehouse: "Warehouse Stock",
};
const initialFilters = { from: "", to: "", po: "", dc: "", item: "", colour: "", machine: "", employee: "", status: "" };
const hiddenFields = ["__v", "companyId", "factoryId", "password"];

export default function ReportsPage({ notify }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [activeGroup, setActiveGroup] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(event, nextFilters = filters) {
    event?.preventDefault();
    setLoading(true);
    try {
      const reportData = await api(`/reports?${new URLSearchParams(Object.entries(nextFilters).filter(([, value]) => value))}`);
      setData(reportData);
      setActiveGroup((current) => current && reportData[current] ? current : Object.keys(reportData)[0] || "");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const allRows = useMemo(() => Object.entries(data || {}).flatMap(([type, entries]) => entries.map((row) => ({ reportType: groups[type] || type, ...row }))), [data]);
  const activeRows = data?.[activeGroup] || [];
  const roleScope = ["saas_super_admin", "company_admin", "admin"].includes(user?.role)
    ? "Store + Production" : user?.role === "store" ? "Store Reports" : "Production Reports";
  const columns = activeRows.length ? Object.keys(activeRows[0]).filter((field) => !hiddenFields.includes(field)).slice(0, 14).map((field) => ({
    key: field,
    label: field.replace(/([A-Z])/g, " $1").trim(),
    render: (row) => typeof row[field] === "object" ? JSON.stringify(row[field]) : String(row[field] ?? ""),
  })) : [];

  return <>
    <PageTitle title="Reports" subtitle={`${roleScope} · date range, dropdown filters and Excel download`} />
    <div className="report-summary-grid">
      <div><Layers3 /><span><b>{Object.keys(data || {}).length}</b><small>Report Sections</small></span></div>
      <div><FileSearch /><span><b>{allRows.length}</b><small>Matching Records</small></span></div>
      <div><RefreshCw /><span><b>{loading ? "Loading" : "Ready"}</b><small>Report Status</small></span></div>
    </div>
    <Card title="Date Range & Report Filters"><form className="report-filters professional-report-filters" onSubmit={load}>
      {["from", "to"].map((key) => <label key={key}><span>{key === "from" ? "From Date" : "To Date"}</span><input type="date" value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} /></label>)}
      <div className="report-filter-actions"><button type="button" onClick={() => { setFilters(initialFilters); load(null, initialFilters); }}>Reset</button><button className="primary" disabled={loading}>{loading ? "Loading..." : "Apply Filters"}</button></div>
    </form></Card>
    {data && <Card title="Report Results">
      <div className="report-toolbar"><div className="report-tabs">{Object.keys(data).map((key) => <button type="button" className={activeGroup === key ? "active" : ""} onClick={() => setActiveGroup(key)} key={key}>{groups[key] || key}<b>{data[key].length}</b></button>)}</div><div className="row-actions"><button onClick={() => window.print()}><Printer /> Print / PDF</button><button className="primary" disabled={!allRows.length} onClick={() => downloadExcel("accessories-flow-report.xls", allRows)}><Download /> Download Excel</button></div></div>
      <div className="active-report-heading"><div><b>{groups[activeGroup] || activeGroup}</b><small>{activeRows.length} records · Click any column heading for dropdown filter</small></div>{activeRows.length > 0 && <button onClick={() => downloadExcel(`${activeGroup}-report.xls`, activeRows)}><Download /> This Report</button>}</div>
      <DataTable loading={loading} rows={activeRows} columns={columns} empty="No matching records" />
    </Card>}
  </>;
}
