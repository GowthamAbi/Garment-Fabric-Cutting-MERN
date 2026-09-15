import { useEffect, useState } from "react";
import {
  Activity,
  Boxes,
  CheckSquare,
  Clock3,
  CreditCard,
  FileText,
  Users,
} from "lucide-react";
import { api } from "../../api.js";

export default function CompanyAdminDashboardPage({ notify, onPageChange }) {
  const [data, setData] = useState(null);
  const [department, setDepartment] = useState("");
  useEffect(() => {
    api("/dashboard/company-overview")
      .then(setData)
      .catch((e) => notify?.(e.message));
  }, []);
  if (!data) return <div className="loading">Loading company dashboard...</div>;
  const selected = data.departments.find((row) => row.name === department);
  return (
    <section className="executive-dashboard">
      <div className="executive-hero">
        <div>
          <small>COMPANY CONTROL CENTER</small>
          <h1>{data.company?.companyName}</h1>
          <p>
            Department performance, stock, timeline and approvals. Operational
            entry is restricted.
          </p>
        </div>
        <span>
          {data.subscription.plan} · {data.subscription.status}
        </span>
      </div>
      <div className="executive-stats">
        <Metric
          icon={<Users />}
          label="Active Users"
          value={data.counts.users}
        />
        <Metric
          icon={<Boxes />}
          label="Stock Quantity"
          value={data.counts.stock}
        />
        <Metric
          icon={<CheckSquare />}
          label="Approvals"
          value={data.counts.pendingApprovals}
        />
        <Metric
          icon={<Activity />}
          label="Recent Actions"
          value={data.counts.timeline}
        />
      </div>
      <div className="department-board">
        {data.departments.map((row) => (
          <button
            className={department === row.name ? "active" : ""}
            key={row.name}
            onClick={() =>
              setDepartment(department === row.name ? "" : row.name)
            }
          >
            <span>
              <b>{row.name}</b>
              <small>
                {row.users} users · {row.entries} entries
              </small>
            </span>
            <em>{row.status}</em>
          </button>
        ))}
      </div>
      {selected && (
        <div className="classic-card department-detail">
          <div>
            <h3>{selected.name} Department</h3>
            <span>{selected.activity} recent actions</span>
          </div>
          <div className="department-actions">
            <button onClick={() => onPageChange("Company Reports")}>
              <FileText /> Reports
            </button>
            <button onClick={() => onPageChange("Company Timeline")}>
              <Clock3 /> Timeline
            </button>
            <button onClick={() => onPageChange("Company Stock")}>
              <Boxes /> Stock
            </button>
            <button onClick={() => onPageChange("Company Approvals")}>
              <CheckSquare /> Approvals
            </button>
          </div>
        </div>
      )}
      <div className="classic-two-column">
        <div className="classic-card">
          <h3>Pending Master Approvals</h3>
          {data.approvals.length ? (
            data.approvals.map((row) => (
              <div className="approval-row" key={row._id}>
                <span>
                  <b>{row.itemName}</b>
                  <small>
                    {row.itemCode} · {row.fabricGroup}
                  </small>
                </span>
                <em>{row.status}</em>
              </div>
            ))
          ) : (
            <p className="empty">No pending approvals</p>
          )}
        </div>
        <div className="classic-card">
          <h3>Subscription Snapshot</h3>
          <div className="subscription-summary">
            <CreditCard />
            <div>
              <b>{data.subscription.plan}</b>
              <span>{data.subscription.status}</span>
              <small>
                {data.subscription.activeUsers} active users ·{" "}
                {data.subscription.factories} factories
              </small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
function Metric({ icon, label, value }) {
  return (
    <article>
      <i>{icon}</i>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </article>
  );
}
