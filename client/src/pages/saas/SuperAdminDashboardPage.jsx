import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronRight,
  Factory,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "../../api.js";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

const roles = [
  "company_admin",
  "admin",
  "fabric_admin",
  "fabric_entry",
  "cutting_admin",
  "cutting_entry",
  "accessories_admin",
  "accessories_entry",
  "elastic_admin",
  "elastic_entry",
  "stitching_admin",
  "stitching_entry",
  "store",
  "production",
  "production_planner",
  "production_operator",
  "supervisor",
  "quality",
  "maintenance",
  "sewing_coordinator",
  "management",
  "view_only",
  "department_incharge",
  "department_entry",
];

const blankUser = {
  name: "",
  email: "",
  password: "",
  role: "fabric_entry",
  department: "",
};

export default function SuperAdminDashboardPage({ notify }) {
  const [companies, setCompanies] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [openDepartment, setOpenDepartment] = useState("");
  const [form, setForm] = useState(blankUser);

  async function load() {
    try {
      setCompanies(await api("/companies"));
    } catch (error) {
      notify?.(error.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openCompany(company) {
    try {
      setWorkspace(await api("/companies/" + company._id + "/workspace"));
      setOpenDepartment("");
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    try {
      await api("/auth/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          companyId: workspace.company._id,
          factoryId: workspace.company.factories?.[0]?._id,
        }),
      });
      setForm(blankUser);
      await openCompany(workspace.company);
      notify?.("Company user created");
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function toggleUser(user) {
    try {
      await api("/companies/" + workspace.company._id + "/users/" + user._id, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      await openCompany(workspace.company);
      notify?.(user.active ? "User disabled" : "User activated");
    } catch (error) {
      notify?.(error.message);
    }
  }

  const totals = useMemo(
    () => ({
      companies: companies.length,
      active: companies.filter(
        (company) => company.active && company.subscriptionStatus === "Active",
      ).length,
      users: companies.reduce(
        (sum, company) => sum + (company.userCount || 0),
        0,
      ),
      trials: companies.filter(
        (company) => company.subscriptionPlan === "Trial",
      ).length,
    }),
    [companies],
  );

  if (workspace) {
    const activity = new Map(
      (workspace.departmentActivity || []).map((row) => [row.department, row]),
    );

    return (
      <>
        <button className="owner-back" onClick={() => setWorkspace(null)}>
          ← All Companies
        </button>

        <PageTitle
          title={workspace.company.companyName}
          subtitle={
            workspace.company.subscriptionPlan +
            " · " +
            workspace.company.subscriptionStatus
          }
        />

        <div className="company-workspace-summary">
          <Summary
            icon={<Factory />}
            label="Factories"
            value={workspace.company.factories?.length || 0}
          />
          <Summary
            icon={<Users />}
            label="Users"
            value={workspace.users.length}
          />
          <Summary
            icon={<ShieldCheck />}
            label="Subscription"
            value={workspace.company.subscriptionStatus}
          />
          <Summary
            icon={<Activity />}
            label="Recent Actions"
            value={workspace.recentActivity?.length || 0}
          />
        </div>

        <Card title="Department Access, Users & Activity">
          <div className="department-accordion">
            {Object.entries(workspace.departments).map(
              ([department, users]) => {
                const departmentKey = department
                  .replace(" Store", "")
                  .replace(" Production", "")
                  .split(" / ")[0]
                  .toUpperCase();
                const usage = activity.get(departmentKey);

                return (
                  <section key={department}>
                    <button
                      onClick={() =>
                        setOpenDepartment(
                          openDepartment === department ? "" : department,
                        )
                      }
                    >
                      {openDepartment === department ? (
                        <ChevronDown />
                      ) : (
                        <ChevronRight />
                      )}
                      <span>
                        <b>{department}</b>
                        <small>
                          {users.length} users · {usage?.entries || 0} entries ·{" "}
                          {usage?.quantity || 0} processed
                        </small>
                      </span>
                    </button>

                    {openDepartment === department && (
                      <div className="department-users">
                        {users.length ? (
                          users.map((user) => (
                            <div key={user._id}>
                              <span>
                                <b>{user.name}</b>
                                <small>{user.email}</small>
                              </span>
                              <code>{user.role}</code>
                              <span
                                className={
                                  user.active ? "status-green" : "status-red"
                                }
                              >
                                {user.active ? "Active" : "Disabled"}
                              </span>
                              <button onClick={() => toggleUser(user)}>
                                {user.active ? "Disable" : "Activate"}
                              </button>
                            </div>
                          ))
                        ) : (
                          <p>No users in this department.</p>
                        )}
                      </div>
                    )}
                  </section>
                );
              },
            )}
          </div>
        </Card>

        <Card title="Add Department User">
          <form className="owner-user-form" onSubmit={createUser}>
            <input
              required
              placeholder="Full name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
            <input
              required
              minLength="8"
              type="password"
              placeholder="Temporary password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
            <select
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value })
              }
            >
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
            {["department_incharge", "department_entry"].includes(
              form.role,
            ) && (
              <select
                required
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
              >
                <option value="">Select department</option>
                {[
                  "FABRIC",
                  "CUTTING",
                  "ACCESSORIES",
                  "ELASTIC",
                  "STITCHING",
                  "FINISHING",
                  "PACKING",
                  "DISPATCH",
                ].map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </select>
            )}
            <button className="primary">
              <Plus />
              Create User
            </button>
          </form>
        </Card>

        <Card title="Latest Company Activity">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(workspace.recentActivity || []).map((row) => (
                  <tr key={row._id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>{row.actorName}</td>
                    <td>{row.actorRole}</td>
                    <td>{row.action}</td>
                    <td>{row.statusCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="SaaS Owner Dashboard"
        subtitle="Companies, subscriptions, department usage and access control"
      />

      <div className="owner-stats">
        <Summary
          icon={<Building2 />}
          label="Total Companies"
          value={totals.companies}
        />
        <Summary
          icon={<ShieldCheck />}
          label="Active Companies"
          value={totals.active}
        />
        <Summary icon={<Users />} label="Total Users" value={totals.users} />
        <Summary
          icon={<Factory />}
          label="Trial Companies"
          value={totals.trials}
        />
      </div>

      <Card title="Company Workspaces">
        <div className="company-flex-grid">
          {companies.map((company) => (
            <button key={company._id} onClick={() => openCompany(company)}>
              <div className="company-card-icon">
                <Building2 />
              </div>
              <div>
                <h3>{company.companyName}</h3>
                <p>
                  {company.factories
                    ?.map((factory) => factory.name)
                    .join(", ") || "No factory"}
                </p>
              </div>
              <span
                className={
                  company.active && company.subscriptionStatus === "Active"
                    ? "company-active"
                    : "company-inactive"
                }
              >
                {company.subscriptionStatus}
              </span>
              <footer>
                <small>{company.subscriptionPlan} Plan</small>
                <small>
                  {company.activeUsers || 0}/{company.userCount || 0} active
                  users
                </small>
              </footer>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

function Summary({ icon, label, value }) {
  return (
    <div>
      {icon}
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </div>
  );
}
