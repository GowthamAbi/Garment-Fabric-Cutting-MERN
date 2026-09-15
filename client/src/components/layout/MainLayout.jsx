import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  Clock3,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShoppingCart,
  Printer,
  Activity,
  Factory,
  Wrench,
  Scissors,
  Users,
  ClipboardList,
  ChevronDown,
  BarChart3,
  Building2,
  Sparkles,
  X,
  ShieldCheck,
  DatabaseBackup,
  ListChecks,
  PackageCheck,
  Truck,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";

const navigation = [
  ["Company Dashboard", LayoutDashboard, ["company_admin"]],
  [
    "Department Dashboard",
    LayoutDashboard,
    ["department_incharge", "department_entry"],
  ],
  ["Item Master", ClipboardList, ["company_admin", "admin"]],
  ["Company Reports", BarChart3, ["company_admin"]],
  ["Company Timeline", Clock3, ["company_admin"]],
  ["Company Stock", Boxes, ["company_admin"]],
  ["Company Approvals", ListChecks, ["company_admin"]],
  ["Company Subscription", CreditCard, ["company_admin"]],
  [
    "Fabric Master",
    Boxes,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "fabric_admin",
      "fabric_entry",
    ],
  ],
  [
    "Fabric Inward",
    ArrowDownToLine,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "fabric_admin",
      "fabric_entry",
    ],
  ],
  [
    "Production Plan",
    ClipboardList,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "cutting_admin",
      "cutting_entry",
    ],
  ],
  [
    "Cutting Actual Entry",
    Scissors,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "cutting_admin",
      "cutting_entry",
    ],
  ],
  [
    "Fabric Waste",
    Boxes,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "fabric_admin",
      "cutting_admin",
      "management",
      "view_only",
    ],
  ],
  [
    "Elastic Requirement",
    Activity,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "elastic_admin",
      "elastic_entry",
    ],
  ],
  ["Department History", FileClock, ["fabric_admin", "fabric_entry"]],
  ["Department Print", Printer, ["fabric_admin", "fabric_entry"]],
  [
    "Fabric Stock",
    Boxes,
    ["saas_super_admin", "admin", "fabric_admin", "fabric_entry"],
  ],
  ["Modules", Sparkles, ["saas_super_admin", "admin"]],
  [
    "Dashboard",
    LayoutDashboard,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
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
    ],
  ],
  [
    "Inward",
    ArrowDownToLine,
    ["saas_super_admin", "company_admin", "admin", "store"],
  ],
  ["PO", ShoppingCart, ["saas_super_admin", "company_admin", "admin", "store"]],
  [
    "PO Pending",
    Clock3,
    ["saas_super_admin", "company_admin", "admin", "store"],
  ],
  ["Print", Printer, ["saas_super_admin", "company_admin", "admin", "store"]],
  [
    "Stock",
    Boxes,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "store",
      "management",
      "view_only",
    ],
  ],
  [
    "History",
    FileClock,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "store",
      "management",
      "view_only",
    ],
  ],
  [
    "Master Data",
    Settings2,
    ["saas_super_admin", "company_admin", "admin", "store"],
  ],
  [
    "Masters",
    Settings2,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "production_planner",
      "maintenance",
    ],
  ],
  [
    "Production Planning",
    ClipboardList,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "production_planner",
      "supervisor",
    ],
  ],
  [
    "Cutting DC",
    Scissors,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "production_planner",
      "supervisor",
    ],
  ],
  [
    "Production Control",
    Activity,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "production_operator",
      "supervisor",
    ],
  ],
  [
    "Status",
    Clock3,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "production_planner",
      "production_operator",
      "supervisor",
      "quality",
      "maintenance",
      "management",
      "view_only",
    ],
  ],
  [
    "Warehouse",
    Boxes,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "production_planner",
      "production_operator",
      "supervisor",
      "quality",
      "management",
      "view_only",
    ],
  ],
  [
    "Pending & Issues",
    Wrench,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "production_planner",
      "supervisor",
      "quality",
      "maintenance",
      "sewing_coordinator",
    ],
  ],
  [
    "Sewing Delivery",
    Scissors,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
      "production",
      "sewing_coordinator",
    ],
  ],
  [
    "Reports",
    BarChart3,
    [
      "saas_super_admin",
      "company_admin",
      "admin",
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
    ],
  ],
  ["User Management", Users, ["saas_super_admin", "company_admin", "admin"]],
  ["Subscription", ShieldCheck, ["saas_super_admin", "company_admin", "admin"]],
  [
    "Audit & Backup",
    DatabaseBackup,
    ["saas_super_admin", "company_admin", "admin"],
  ],
  ["Setup Guide", ListChecks, ["saas_super_admin", "company_admin", "admin"]],
  ["SaaS Companies", Building2, ["saas_super_admin"]],
];

export default function MainLayout({ page, onPageChange, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(
    ["Production Masters", "Machine Register", "Employee Register"].includes(
      page,
    ),
  );
  const [warehouseOpen, setWarehouseOpen] = useState(
    [
      "Production Ready",
      "Rework Warehouse",
      "Rejection Warehouse",
      "Balance Elastic",
      "Section Delivery",
    ].includes(page),
  );
  const [subscriptionOpen, setSubscriptionOpen] = useState(
    [
      "Subscription Plan",
      "Subscription Purchase",
      "Subscription Bills",
      "Subscription Usage",
    ].includes(page),
  );
  const [productionPlanOpen, setProductionPlanOpen] = useState(
    [
      "Production Plan Data Entry",
      "Production Plan Print",
      "Production Plan History",
    ].includes(page),
  );
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const departmentPage =
    {
      FABRIC: [
        "Fabric Master",
        "Fabric Inward",
        "Fabric Stock",
        "Department History",
        "Department Print",
      ],
      CUTTING: ["Production Plan", "Cutting Actual Entry", "Fabric Waste"],
      ACCESSORIES: [
        "Dashboard",
        "Inward",
        "PO",
        "PO Pending",
        "Print",
        "Stock",
        "History",
        "Master Data",
      ],
      ELASTIC: [
        "Production Dashboard",
        "Production Planning",
        "Cutting DC",
        "Production Control",
        "Status",
        "Warehouse",
        "Pending & Issues",
        "Reports",
      ],
    }[user?.department] || [];

  function selectPage(pageName) {
    onPageChange(pageName);
    setMenuOpen(false);
  }

  function handleLogout() {
    localStorage.removeItem("elastic_production_scan_draft");
    window.history.replaceState({}, "", "/");
    logout();
  }

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "open" : ""}>
        <div className="brand">
          <span className="brand-icon">
            <Sparkles />
          </span>
          <div className="brand-copy">
            <b className="brand-title">Accessories Flow</b>
            <small className="brand-subtitle">ACCESSORIES MANAGER</small>
          </div>
          <button className="brand-close" onClick={() => setMenuOpen(false)}>
            <X />
          </button>
        </div>

        <nav>
          {navigation
            .filter(
              ([name, , roles]) =>
                (roles.includes(user?.role) ||
                  (["department_incharge", "department_entry"].includes(
                    user?.role,
                  ) &&
                    departmentPage.includes(name))) &&
                name !== "Garment Flow" &&
                !(
                  user?.role === "company_admin" &&
                  ![
                    "Company Dashboard",
                    "Item Master",
                    "Fabric Master",
                    "Company Reports",
                    "Company Timeline",
                    "Company Stock",
                    "Company Approvals",
                    "Company Subscription",
                    "User Management",
                  ].includes(name)
                ),
            )
            .map(([name, Icon]) =>
              name === "Production Plan" ? (
                <div className="nav-group" key={name}>
                  <button
                    className={
                      page.startsWith("Production Plan ") ? "group-active" : ""
                    }
                    onClick={() => setProductionPlanOpen((open) => !open)}
                  >
                    <Icon />
                    <span>Production Plan</span>
                    <ChevronDown
                      className={
                        productionPlanOpen ? "chevron open" : "chevron"
                      }
                    />
                  </button>
                  {productionPlanOpen && (
                    <div className="nav-submenu">
                      {[
                        "Production Plan Data Entry",
                        "Production Plan Print",
                        "Production Plan History",
                      ].map((label) => (
                        <button
                          key={label}
                          className={page === label ? "active" : ""}
                          onClick={() => selectPage(label)}
                        >
                          {label.replace("Production Plan ", "")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : name === "Company Subscription" ? (
                <div className="nav-group" key={name}>
                  <button
                    className={
                      page.startsWith("Subscription ") ? "group-active" : ""
                    }
                    onClick={() => setSubscriptionOpen(!subscriptionOpen)}
                  >
                    <Icon />
                    <span>Subscription</span>
                    <ChevronDown
                      className={subscriptionOpen ? "chevron open" : "chevron"}
                    />
                  </button>
                  {subscriptionOpen && (
                    <div className="nav-submenu">
                      {[
                        "Subscription Plan",
                        "Subscription Purchase",
                        "Subscription Bills",
                        "Subscription Usage",
                      ].map((label) => (
                        <button
                          key={label}
                          className={page === label ? "active" : ""}
                          onClick={() => selectPage(label)}
                        >
                          {label.replace("Subscription ", "")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : name === "Masters" ? (
                <div className="nav-group" key={name}>
                  <button
                    className={
                      [
                        "Production Masters",
                        "Machine Register",
                        "Employee Register",
                      ].includes(page)
                        ? "group-active"
                        : ""
                    }
                    onClick={() => setMastersOpen((open) => !open)}
                  >
                    <Icon />
                    <span>Masters</span>
                    <ChevronDown
                      className={mastersOpen ? "chevron open" : "chevron"}
                    />
                  </button>
                  {mastersOpen && (
                    <div className="nav-submenu">
                      <button
                        className={
                          page === "Production Masters" ? "active" : ""
                        }
                        onClick={() => selectPage("Production Masters")}
                      >
                        Production Master
                      </button>
                      <button
                        className={page === "Machine Register" ? "active" : ""}
                        onClick={() => selectPage("Machine Register")}
                      >
                        Machine Register + QR
                      </button>
                      <button
                        className={page === "Employee Register" ? "active" : ""}
                        onClick={() => selectPage("Employee Register")}
                      >
                        Employee Register + QR
                      </button>
                    </div>
                  )}
                </div>
              ) : name === "Warehouse" ? (
                <div className="nav-group" key={name}>
                  <button
                    className={
                      [
                        "Production Ready",
                        "Rework Warehouse",
                        "Rejection Warehouse",
                        "Balance Elastic",
                        "Section Delivery",
                      ].includes(page)
                        ? "group-active"
                        : ""
                    }
                    onClick={() => setWarehouseOpen((open) => !open)}
                  >
                    <Icon />
                    <span>Warehouse</span>
                    <ChevronDown
                      className={warehouseOpen ? "chevron open" : "chevron"}
                    />
                  </button>
                  {warehouseOpen && (
                    <div className="nav-submenu">
                      <button
                        className={page === "Production Ready" ? "active" : ""}
                        onClick={() => selectPage("Production Ready")}
                      >
                        Production Ready
                      </button>
                      <button
                        className={page === "Rework Warehouse" ? "active" : ""}
                        onClick={() => selectPage("Rework Warehouse")}
                      >
                        Rework
                      </button>
                      <button
                        className={
                          page === "Rejection Warehouse" ? "active" : ""
                        }
                        onClick={() => selectPage("Rejection Warehouse")}
                      >
                        Rejection
                      </button>
                      <button
                        className={page === "Balance Elastic" ? "active" : ""}
                        onClick={() => selectPage("Balance Elastic")}
                      >
                        Balance Elastic
                      </button>
                      <button
                        className={page === "Section Delivery" ? "active" : ""}
                        onClick={() => selectPage("Section Delivery")}
                      >
                        Section Delivery
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className={page === name ? "active" : ""}
                  key={name}
                  onClick={() => selectPage(name)}
                >
                  <Icon />
                  {language === "ta" && name === "Dashboard"
                    ? "முகப்பு"
                    : language === "ta" && name === "Inward"
                      ? "உள்வரவு"
                      : language === "ta" && name === "Stock"
                        ? "இருப்பு"
                        : language === "ta" && name === "Reports"
                          ? "அறிக்கைகள்"
                          : name}
                </button>
              ),
            )}
        </nav>

        <div className="profile">
          <select
            aria-label="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="en">English</option>
            <option value="ta">தமிழ்</option>
          </select>
          <div>
            <b>{user?.name}</b>
            <small>{user?.role}</small>
          </div>
          <button onClick={handleLogout}>
            <LogOut />
          </button>
        </div>
      </aside>

      {menuOpen && <div className="shade" onClick={() => setMenuOpen(false)} />}

      <main>
        <header className="topbar">
          <button className="menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>
          <div>
            <small>
              {user?.role?.includes("production")
                ? "Elastic Production"
                : "Accessories Flow SaaS"}
            </small>
            <h1>{page === "Production Dashboard" ? "Dashboard" : page}</h1>
          </div>
        </header>

        <div className="page">{children}</div>
      </main>
    </div>
  );
}
