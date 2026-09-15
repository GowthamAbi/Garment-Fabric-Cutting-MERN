import { useEffect, useState } from "react";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

const blank = {
  name: "",
  email: "",
  password: "",
  role: "store",
  department: "",
};
const roles = [
  ["company_admin", "Company Admin"],
  ["store", "Store User"],
  ["production_planner", "Production Planner"],
  ["production_operator", "Production Operator"],
  ["supervisor", "Supervisor"],
  ["quality", "Quality User"],
  ["fabric_admin", "Fabric Admin"],
  ["fabric_entry", "Fabric Data Entry"],
  ["cutting_admin", "Cutting Admin"],
  ["cutting_entry", "Cutting Data Entry"],
  ["accessories_admin", "Accessories Admin"],
  ["accessories_entry", "Accessories Data Entry"],
  ["elastic_admin", "Elastic Admin"],
  ["elastic_entry", "Elastic Data Entry"],
  ["stitching_admin", "Stitching Admin"],
  ["stitching_entry", "Stitching Data Entry"],
  ["department_incharge", "Department In-charge"],
  ["department_entry", "Department Data Entry"],
  ["maintenance", "Maintenance User"],
  ["sewing_coordinator", "Sewing Coordinator"],
  ["management", "Management"],
  ["view_only", "View Only"],
];

export default function UserManagementPage({ notify }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  async function load() {
    setUsers(await api("/auth/users"));
  }
  useEffect(() => {
    load();
  }, []);
  async function submit(event) {
    event.preventDefault();
    await api("/auth/users", { method: "POST", body: JSON.stringify(form) });
    setForm(blank);
    await load();
    notify("User account created");
  }
  return (
    <>
      <PageTitle
        title="User Management"
        subtitle="Company roles and action-level access accounts"
      />
      <Card title="Create User">
        <form className="production-start-grid" onSubmit={submit}>
          <label>
            <span>Name</span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label>
            <span>Temporary Password</span>
            <input
              type="password"
              minLength="6"
              required
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </label>
          <label>
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value })
              }
            >
              {roles.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {["department_incharge", "department_entry"].includes(form.role) && (
            <label>
              <span>Department</span>
              <select
                required
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
              >
                <option value="">Select</option>
                {[
                  "FABRIC",
                  "CUTTING",
                  "ACCESSORIES",
                  "ELASTIC",
                  "STITCHING",
                  "FINISHING",
                  "PACKING",
                  "DISPATCH",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          <button className="primary">Create User</button>
        </form>
      </Card>
      <Card title="Accounts">
        <DataTable
          rows={users}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "department", label: "Department" },
            {
              key: "createdAt",
              label: "Created",
              render: (row) => new Date(row.createdAt).toLocaleDateString(),
            },
          ]}
        />
      </Card>
    </>
  );
}
