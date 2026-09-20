import { useEffect, useState } from "react";
import { Edit3, Search, Trash2 } from "lucide-react";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";

export default function ProductionPlanHistoryPage({ notify, onPageChange }) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    planNo: "",
    dcNo: "",
  });
  async function load() {
    try {
      setRows(await api.plans(filters));
    } catch (error) {
      notify?.(error.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function edit(row) {
    sessionStorage.setItem("fabric_production_plan_edit", JSON.stringify(row));
    onPageChange("Production Plan Data Entry");
  }
  async function remove(row) {
    if (
      !window.confirm(
        `Delete Plan ${row.planNo}? Reserved stock will be released.`,
      )
    )
      return;
    try {
      await api.deletePlan(row._id);
      notify?.("Plan deleted; stock reservation released");
      load();
    } catch (error) {
      notify?.(error.message);
    }
  }
  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>CUTTING DEPARTMENT</small>
          <h2>Production Plan · History</h2>
          <p>
            Only your company/factory records are visible. Edit or delete is
            blocked after fabric issue.
          </p>
        </div>
      </div>
      <div className="classic-card">
        <div className="filter-panel">
          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
          <label>
            Plan No
            <input
              value={filters.planNo}
              onChange={(e) =>
                setFilters({ ...filters, planNo: e.target.value })
              }
            />
          </label>
          <label>
            DC No
            <input
              value={filters.dcNo}
              onChange={(e) => setFilters({ ...filters, dcNo: e.target.value })}
            />
          </label>
          <button onClick={load}>
            <Search /> Apply
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Plan No</th>
                <th>Order No</th>
                <th>Item</th>
                <th>PCS</th>
                <th>Required KG</th>
                <th>Status</th>
                <th>Aging</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row._id}>
                  <td>{index + 1}</td>
                  <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td>{row.planNo}</td>
                  <td>{row.orderNo}</td>
                  <td>
                    {row.itemCode} · {row.itemName}
                  </td>
                  <td>{row.totalPlannedPcs}</td>
                  <td>{row.totalWantedWeightKg}</td>
                  <td>{row.status}</td>
                  <td>{Math.max(0, Math.floor((Date.now() - new Date(row.createdAt)) / 86400000))} days</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => edit(row)}>
                        <Edit3 /> Edit
                      </button>
                      <button className="danger" onClick={() => remove(row)}>
                        <Trash2 /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="empty">No production plans found.</p>}
        </div>
      </div>
    </section>
  );
}
