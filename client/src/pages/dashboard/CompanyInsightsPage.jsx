import { useEffect, useState } from "react";
import { Check, Download, X } from "lucide-react";
import { api, exportCsv } from "../../api.js";
import { fabricCuttingApi } from "../../api/fabricCuttingApi.js";

export default function CompanyInsightsPage({ mode, notify }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/dashboard/company-overview")
      .then(setData)
      .catch((e) => notify?.(e.message));
  }, []);
  if (!data)
    return <div className="loading">Loading {mode.toLowerCase()}...</div>;
  const titles = {
    "Company Reports": "Department Reports",
    "Company Timeline": "Company Timeline",
    "Company Stock": "Department Stock",
    "Company Approvals": "Master Approvals",
    "Department Approvals": "Department Approvals",
  };
  const rows =
    mode === "Company Timeline"
      ? data.timeline
      : ["Company Approvals", "Department Approvals"].includes(mode)
        ? data.approvals
        : data.departments;
  async function decision(id, status) {
    try {
      await fabricCuttingApi.approveItemMaster(id, status);
      setData(await api("/dashboard/company-overview"));
      notify?.(mode === "Department Approvals" && status === "APPROVED"
        ? "Admin approved; sent to Company Admin"
        : `Master ${status.toLowerCase()}`);
    } catch (error) {
      notify?.(error.message);
    }
  }
  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>MANAGEMENT VIEW</small>
          <h2>{titles[mode]}</h2>
          <p>Read-only department visibility with controlled approvals.</p>
        </div>
        <button
          className="secondary"
          onClick={() => exportCsv(`${mode}.csv`, rows)}
        >
          <Download /> Excel
        </button>
      </div>
      <div className="classic-card table-wrap">
        <table>
          <thead>
            <tr>
              {mode === "Company Timeline" ? (
                <>
                  <th>Date</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Status</th>
                </>
              ) : ["Company Approvals", "Department Approvals"].includes(mode) ? (
                <>
                  <th>Item</th>
                  <th>Fabric Group</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th>Approval Stage</th>
                  <th>Decision</th>
                </>
              ) : (
                <>
                  <th>Department</th>
                  <th>Users</th>
                  <th>Entries</th>
                  <th>Activity</th>
                  <th>Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {mode === "Company Timeline"
              ? rows.map((row) => (
                  <tr key={row._id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>{row.actorName}</td>
                    <td>{row.actorRole}</td>
                    <td>{row.action}</td>
                    <td>{row.entity}</td>
                    <td>{row.statusCode}</td>
                  </tr>
                ))
              : ["Company Approvals", "Department Approvals"].includes(mode)
                ? rows.map((row) => (
                    <tr key={row._id}>
                      <td>
                        {row.itemCode} · {row.itemName}
                      </td>
                      <td>{row.fabricGroup}</td>
                      <td>{new Date(row.updatedAt).toLocaleString()}</td>
                      <td>{row.status}</td>
                      <td>{row.approvalLevel === "ADMIN" ? "Admin Review" : "Company Admin Review"}</td>
                      <td>
                        <div className="row-actions">
                          <button onClick={() => decision(row._id, "APPROVED")}>
                            <Check />
                          </button>
                          <button
                            className="danger"
                            onClick={() => decision(row._id, "REJECTED")}
                          >
                            <X />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.users}</td>
                      <td>{row.entries}</td>
                      <td>{row.activity}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
