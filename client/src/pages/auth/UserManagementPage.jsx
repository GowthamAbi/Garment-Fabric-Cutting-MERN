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
  ["delivery_admin", "Delivery Admin"],
  ["delivery_entry", "Delivery Data Entry"],
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
              minLength="12"
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
                  "STITCHING", "INWARD", "CHECKING", "IRONING", "WAREHOUSE", "SHOP", "MARKETING",
                  "FINISHING",
                  "PACKING",
                  "DISPATCH",
                  "DELIVERY",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
<<<<<<< HEAD
          <fieldset><legend>Integrated ERP permissions</legend>{["department.stitching.read","department.stitching.write","department.inward.read","department.inward.write","department.checking.read","department.checking.write","department.ironing.read","department.ironing.write","department.packing.read","department.packing.write","department.dispatch.read","department.dispatch.write","department.warehouse.read","department.warehouse.write","department.shop.read","department.shop.write","department.marketing.read","department.marketing.write", "erp.read", "erp.purchase", "erp.sales", "erp.stock", "erp.quality", "erp.accounts", "erp.finance.read", "erp.masters", "erp.reverse", "erp.reconcile"].map(permission => <label key={permission}><input type="checkbox" checked={form.permissions.includes(permission)} onChange={e => setForm({ ...form, permissions: e.target.checked ? [...form.permissions, permission] : form.permissions.filter(p => p !== permission) })} />{permission}</label>)}</fieldset>
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
          <button className="primary">Create User</button>
        </form>
      </Card>
      <Card title="Accounts">
<<<<<<< HEAD
        <p>ERP permissions can be changed below. Updated users must sign in again.</p>
        {users.filter(u => u.role !== "saas_super_admin").map(u => <details key={u._id}><summary>{u.userId} · ERP permissions</summary><form onSubmit={async e => { e.preventDefault(); const permissions = [...e.currentTarget.querySelectorAll("input:checked")].map(input => input.value);const shopCodes=e.currentTarget.elements.shopCodes?.value||"";permissions.push(...shopCodes.split(",").map(v=>v.trim()).filter(Boolean).map(v=>"shop."+v)); await api(`/auth/users/${u._id}/permissions`, { method: "POST", body: JSON.stringify({ permissions }) }); await load(); notify("Permissions updated; user must sign in again"); }}>{["department.stitching.read","department.stitching.write","department.inward.read","department.inward.write","department.checking.read","department.checking.write","department.ironing.read","department.ironing.write","department.packing.read","department.packing.write","department.dispatch.read","department.dispatch.write","department.warehouse.read","department.warehouse.write","department.shop.read","department.shop.write","department.marketing.read","department.marketing.write", "erp.read", "erp.purchase", "erp.sales", "erp.stock", "erp.quality", "erp.accounts", "erp.finance.read", "erp.masters", "erp.reverse", "erp.reconcile"].map(p => <label key={p}><input type="checkbox" name="permission" value={p} defaultChecked={(u.permissions || []).includes(p)} />{p}</label>)}<label>Assigned shop keys, comma separated<input name="shopCodes" defaultValue={(u.permissions||[]).filter(p=>p.startsWith("shop.")).map(p=>p.slice(5)).join(",")}/></label><button>Save ERP permissions</button></form></details>)}
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
        <DataTable
          rows={users}
          columns={[
            { key: "userId", label: "User ID" },
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "department", label: "Department" },
            { key: "emailVerified", label: "Email Verified", render: (row) => row.emailVerified ? "Yes" : "Pending" },
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
