import { useAuth } from "../../context/AuthContext.jsx";
import { Activity, Boxes, CheckSquare, Clock3, FileText } from "lucide-react";

export default function DepartmentDashboardPage({ onPageChange }) {
  const { user } = useAuth();
  const department =
    user?.department || departmentFromRole(user?.role) || "DEPARTMENT";
  return (
    <section className="executive-dashboard">
      <div className="executive-hero department">
        <div>
          <small>DEPARTMENT WORKSPACE</small>
          <h1>{department}</h1>
          <p>
            {user?.role === "department_incharge"
              ? "Monitor entries, stock, history, status and approvals."
              : "Fast data entry and print workspace."}
          </p>
        </div>
        <span>{user?.role}</span>
      </div>
      <div className="department-action-grid">
        {user?.role === "department_incharge" && (
          <>
            <Tile icon={<FileText />} title="Reports" />
            <Tile icon={<Clock3 />} title="Timeline" />
            <Tile icon={<Boxes />} title="Stock" />
            <Tile icon={<Activity />} title="Status" />
            <Tile icon={<CheckSquare />} title="Approvals" />
          </>
        )}
        <Tile
          icon={<FileText />}
          title="Department Entry"
          onClick={() => onPageChange(entryPage(department))}
        />
      </div>
    </section>
  );
}
function Tile({ icon, title, onClick }) {
  return (
    <button onClick={onClick}>
      <i>{icon}</i>
      <b>{title}</b>
      <small>Open {title.toLowerCase()}</small>
    </button>
  );
}
function departmentFromRole(role = "") {
  return role.split("_")[0]?.toUpperCase();
}
function entryPage(department) {
  return (
    {
      FABRIC: "Fabric Inward",
      CUTTING: "Production Plan Data Entry",
      ACCESSORIES: "Inward",
      ELASTIC: "Production Control",
    }[department] || "Dashboard"
  );
}
