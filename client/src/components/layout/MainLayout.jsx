import DisplayTools from '../common/DisplayTools.jsx';
import SubscriptionNotice from './SubscriptionNotice';
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
import { api } from "../../api.js";
import {DEPARTMENTS} from "../../../../shared/departmentCatalogue.js";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";

const navigation = [
  ["Integrated ERP", Factory, ["company_owner", "company_admin", "admin", "management", "view_only", "store", "quality", "production_planner", "production_operator", "production", "supervisor", "department_incharge", "department_entry", "fabric_admin", "fabric_entry", "cutting_admin", "cutting_entry", "accessories_admin", "accessories_entry", "elastic_admin", "elastic_entry", "stitching_admin", "stitching_entry", "delivery_admin", "delivery_entry"]],
  ["Production & Retail", Factory, ["company_owner", "company_admin", "admin", "management", "view_only", "store", "quality", "production_planner", "production_operator", "production", "supervisor", "department_incharge", "department_entry", "fabric_admin", "fabric_entry", "cutting_admin", "cutting_entry", "accessories_admin", "accessories_entry", "elastic_admin", "elastic_entry", "stitching_admin", "stitching_entry", "delivery_admin", "delivery_entry"]],
  ["Subscription Automation", Clock3, ["company_owner", "company_admin", "admin"]],
  ["Company Dashboard", LayoutDashboard, ["company_admin"]],
  [
    "Department Dashboard",
    LayoutDashboard,
    ["department_incharge", "department_entry"],
  ],
  ["Item Master", ClipboardList, ["company_owner", "company_admin", "admin"]],
  ["Company Reports", BarChart3, ["company_admin"]],
  ["Company Timeline", Clock3, ["company_admin"]],
  ["Company Stock", Boxes, ["company_admin"]],
  ["Company Approvals", ListChecks, ["company_admin"]],
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
  [
    "Audit & Backup",
    DatabaseBackup,
    ["saas_super_admin", "company_admin", "admin"],
  ],
  ["Setup Guide", ListChecks, ["saas_super_admin", "company_admin", "admin"]],
  ["SaaS Companies", Building2, ["saas_super_admin"]],
];

const departmentNavigation = {
  FABRIC: [
    { label: "Dashboard", icon: LayoutDashboard, page: "Fabric Dashboard" },
    { label: "Fabric Master", icon: Boxes, page: "Fabric Master" },
    {
      label: "Fabric Inward",
      icon: ArrowDownToLine,
      items: [
        "Fabric Inward Entry",
        "Fabric Roll QR Print",
        "Fabric Inward Print",
        "Fabric Inward History",
      ],
    },
    {
      label: "Production Plan",
      icon: ClipboardList,
      items: [
        "Fabric Entry",
        "Plan Print",
        "Folding Entry",
        "Folding Print",
        "Fabric Plan History",
      ],
    },
    {
      label: "Stock",
      icon: Boxes,
      items: ["Inward Stock", "Fabric Stock Balance"],
    },
  ],
  CUTTING: [
    { label: "Dashboard", icon: LayoutDashboard, page: "Cutting Dashboard" },
    {
      label: "Cutting Master",
      icon: Settings2,
      items: ["Machine Detail Entry & QR Print"],
    },
    {
      label: "Production Plan",
      icon: ClipboardList,
      items: [
        "Cutting Actual Entry",
        "Cutting Plan Print",
        "Cutting Plan History",
      ],
    },
    {
      label: "Machine Plan",
      icon: ClipboardList,
      items: ["Machine Plan Entry", "Plan Number Status", "Cutter Status"],
    },
    {
      label: "Stock",
      icon: Boxes,
      items: ["Cutting Pending", "Cutting Stock", "Cutting Waste"],
    },
    {
      label: "Time Status",
      icon: Clock3,
      items: [
        "Spreader Timeline",
        "Cutter Timeline",
        "Machine Reports",
        "Cutting Time History",
      ],
    },
  ],
  DELIVERY: [
    { label: "Dashboard", icon: LayoutDashboard, page: "Delivery Dashboard" },
    { label: "Vendor Master", icon: Users, items: ["Vendor Registration"] },
    {
      label: "Delivery Plan",
      icon: Truck,
      items: ["Delivery Plan Details", "Section Plan", "Section History"],
    },
  ],
  ELASTIC: [
    { label: "Dashboard", icon: LayoutDashboard, page: "Elastic Dashboard" },
    {
      label: "Elastic Requirement",
      icon: Activity,
      page: "Elastic Requirement",
    },
    {
      label: "Masters",
      icon: Settings2,
      items: ["Production Masters", "Machine Register", "Employee Register"],
    },
    {
      label: "Production Planning",
      icon: ClipboardList,
      page: "Production Planning",
    },
    { label: "Cutting DC", icon: Scissors, page: "Cutting DC" },
    { label: "Production Control", icon: Activity, page: "Production Control" },
    { label: "Status", icon: Clock3, page: "Status" },
    {
      label: "Warehouse",
      icon: Boxes,
      items: [
        "Production Ready",
        "Rework Warehouse",
        "Rejection Warehouse",
        "Balance Elastic",
        "Section Delivery",
      ],
    },
    { label: "Pending & Issues", icon: Wrench, page: "Pending & Issues" },
    { label: "Reports", icon: BarChart3, page: "Reports" },
  ],
  ACCESSORIES: [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      page: "Accessories Dashboard",
    },
    { label: "Inward", icon: ArrowDownToLine, page: "Inward" },
    { label: "PO", icon: ShoppingCart, page: "PO" },
    { label: "PO Pending", icon: Clock3, page: "PO Pending" },
    { label: "Print", icon: Printer, page: "Print" },
    { label: "Stock", icon: Boxes, page: "Stock" },
    { label: "History", icon: FileClock, page: "History" },
    { label: "Master Data", icon: Settings2, page: "Master Data" },
    { label: "Reports", icon: BarChart3, page: "Reports" },
  ],
  ADMIN: [
    { label: "Dashboard", icon: LayoutDashboard, page: "Admin Dashboard" },
    {
      label: "Department Approvals",
      icon: ListChecks,
      page: "Department Approvals",
    },
    { label: "Item Master", icon: ClipboardList, page: "Item Master" },
    { label: "User Management", icon: Users, page: "User Management" },
    { label: "Audit & Backup", icon: DatabaseBackup, page: "Audit & Backup" },
    { label: "Setup Guide", icon: ListChecks, page: "Setup Guide" },
  ],
  COMPANY_ADMIN: [
    {label:"Factory Management",icon:Factory,page:"Factory Management"},
    {label:"Production Departments",icon:Factory,page:"Production Departments"},
    {label:"Warehouse Management",icon:Boxes,page:"Warehouse Management"},
    {label:"Shop Management",icon:ShoppingCart,page:"Shop Management"},
    {label:"Marketing Analysis",icon:BarChart3,page:"Marketing Analysis"},
    {label:"Company Purchase Orders",icon:ClipboardList,page:"Company Purchase Orders"},
    {
      label: "Company Dashboard",
      icon: LayoutDashboard,
      page: "Company Dashboard",
    },
    { label: "Company Reports", icon: BarChart3, page: "Company Reports" },
    { label: "Company Timeline", icon: Clock3, page: "Company Timeline" },
    { label: "Company Stock", icon: Boxes, page: "Company Stock" },
    { label: "Company Approvals", icon: ListChecks, page: "Company Approvals" },
    {
      label: "Company Subscription",
      icon: CreditCard,
      items: [
        "Subscription Plan",
        "Subscription Purchase",
        "Subscription Bills",
        "Subscription Usage",
        "Support Access",
      ],
    },
    { label: "Modules", icon: Sparkles, page: "Modules" },
    { label: "SaaS Companies", icon: Building2, page: "SaaS Companies" },
  ],
};

const groupedSidebarPages = new Set(
  Object.values(departmentNavigation).flatMap((groups) =>
    groups.flatMap(({ page, items = [] }) => [page, ...items].filter(Boolean)),
  ),
);
groupedSidebarPages.add("Sewing Delivery");
[
  "Fabric Inward",
  "Production Plan",
  "Fabric Waste",
  "Fabric Stock",
  "Dashboard",
  "Masters",
  "Warehouse",
  "Subscription",
  "Company Subscription",
].forEach((page) => groupedSidebarPages.add(page));

const departmentRoles = {
  FABRIC: ["fabric_admin", "fabric_entry"],
  CUTTING: ["cutting_admin", "cutting_entry"],
  ELASTIC: [
    "elastic_admin",
    "elastic_entry",
    "production",
    "production_planner",
    "production_operator",
    "supervisor",
    "quality",
    "maintenance",
  ],
  ACCESSORIES: ["store", "accessories_admin", "accessories_entry"],
  DELIVERY: ["delivery_admin", "delivery_entry"],
  ADMIN: ["admin"],
  COMPANY_ADMIN: ["company_owner", "company_admin", "saas_super_admin"],
};

const departmentTitles = {
  FABRIC: "Fabric Department",
  CUTTING: "Cutting Department",
  ELASTIC: "Elastic Department",
  ACCESSORIES: "Accessories Department",
  DELIVERY: "Delivery Department",
  ADMIN: "Admin Department",
  COMPANY_ADMIN: "Company Admin",
};
const departmentOrder = [
  "FABRIC",
  "CUTTING",
  "ELASTIC",
  "ACCESSORIES",
  "DELIVERY",
  "ADMIN",
  "COMPANY_ADMIN",
];

export default function MainLayout({ page, onPageChange, children }) {
  const { user, logout } = useAuth();
  const [access,setAccess]=useState(null);
  useEffect(()=>{if(['saas_super_admin','support_viewer'].includes(user?.role))return;let alive=true;api('/saas/access-status').then(v=>{if(alive)setAccess(v);}).catch(()=>{});return()=>{alive=false;};},[user?._id,user?.role]);
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
  const [departmentOpen, setDepartmentOpen] = useState({
    "FABRIC-Fabric Inward": true,
    "FABRIC-Production Plan": true,
    "FABRIC-Stock": true,
    "CUTTING-Cutting Master": true,
    "CUTTING-Production Plan": true,
    "CUTTING-Machine Plan": true,
    "CUTTING-Stock": true,
    "CUTTING-Time Status": true,
    "DELIVERY-Vendor Master": true,
    "DELIVERY-Delivery Plan": true,
    "ELASTIC-Masters": true,
    "ELASTIC-Warehouse": true,
    "COMPANY_ADMIN-Company Subscription": true,
  });
  const visibleRole=user?.role==='company_owner'?'company_admin':user?.role;
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
      DELIVERY: [
        "Vendor Registration",
        "Delivery Plan Details",
        "Section Plan",
        "Section History",
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
            <b className="brand-title">UG SaaS</b>
            <small className="brand-subtitle">BUSINESS FLOW MANAGER</small>
          </div>
          <button aria-label="Close navigation" className="brand-close" onClick={() => setMenuOpen(false)}>
            <X />
          </button>
        </div>

        <nav>
          {Object.entries(departmentNavigation)
            .sort(
              ([a], [b]) =>
                departmentOrder.indexOf(a) - departmentOrder.indexOf(b),
            )
            .filter(
              ([department]) =>
                (!DEPARTMENTS.includes(department)||access?.accessAllowed&&access.enabledDepartments?.includes(department)&&(!user?.accessPolicyVersion||user.role==='company_owner'||user.permissions?.some(p=>['department.'+department.toLowerCase()+'.read','department.'+department.toLowerCase()+'.write'].includes(p))))&&
                (["saas_super_admin", "company_owner", "company_admin"].includes(user?.role) ||
                (user?.role === "admin" && department !== "COMPANY_ADMIN") ||
                user?.department === department ||
                departmentRoles[department]?.includes(user?.role)),
            )
            .map(([department, groups]) => (
              <section className="department-nav" key={department}>
                <div className="department-nav-title">
                  {departmentTitles[department]}
                </div>
                {groups.filter(g=>{const needed={'Warehouse Management':'WAREHOUSE','Shop Management':'SHOP','Marketing Analysis':'MARKETING'}[g.page];if(needed)return access?.accessAllowed&&access.enabledDepartments?.includes(needed)&&(!user.accessPolicyVersion||user.role==='company_owner'||user.permissions?.some(p=>['department.'+needed.toLowerCase()+'.read','department.'+needed.toLowerCase()+'.write'].includes(p)));if(g.page==='Company Purchase Orders')return access?.accessAllowed&&(user.role==='company_owner'||!user.accessPolicyVersion||user.permissions?.includes('erp.purchase'));if(g.page==='Production Departments')return access?.accessAllowed&&(user.role==='company_owner'||!user.accessPolicyVersion||user.permissions?.some(p=>p.startsWith('department.')));return true;}).map(
                  ({ label, icon: Icon, page: directPage, items }) => {
                    const key = `${department}-${label}`;
                    const active = directPage === page || items?.includes(page);
                    return items ? (
                      <div className="nav-group" key={key}>
                        <button
                          className={active ? "group-active" : ""}
                          onClick={() =>
                            setDepartmentOpen((old) => ({
                              ...old,
                              [key]: !old[key],
                            }))
                          }
                        >
                          <Icon />
                          <span>{label}</span>
                          <ChevronDown
                            className={
                              departmentOpen[key] ? "chevron open" : "chevron"
                            }
                          />
                        </button>
                        {departmentOpen[key] && (
                          <div className="nav-submenu">
                            {items.map((item) => (
                              <button
                                key={item}
                                className={page === item ? "active" : ""}
                                onClick={() => selectPage(item)}
                              >
                                {item
                                  .replace("Fabric ", "")
                                  .replace("Cutting ", "")}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        key={key}
                        className={active ? "active" : ""}
                        onClick={() => selectPage(directPage)}
                      >
                        <Icon />
                        {label}
                      </button>
                    );
                  },
                )}
              </section>
            ))}
          {navigation
            .filter(
              ([name, , roles]) =>
                !groupedSidebarPages.has(name) &&
                (roles.includes(visibleRole) ||
                  (["department_incharge", "department_entry"].includes(
                    user?.role,
                  ) &&
                    departmentPage.includes(name))) &&
                name !== "Garment Flow" &&
                !(
                  ["company_owner","company_admin"].includes(user?.role) &&
                  ![
                    "Company Dashboard",
                    "Integrated ERP",
                    "Subscription Automation",
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
                        "Support Access",
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
          <button aria-label="Logout" onClick={handleLogout}>
            <LogOut />
          </button>
        </div>
      </aside>

      {menuOpen && <div className="shade" onClick={() => setMenuOpen(false)} />}

      <main>
        <header className="topbar">
          <DisplayTools page={page} user={user} onProfile={()=>selectPage("Profile Settings")}/>
          <button aria-label="Open navigation" aria-expanded={menuOpen} className="menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>
          <div>
            <small>
              {user?.role?.includes("production")
                ? "Elastic Production"
                : "UG SaaS"}
            </small>
            <h1>{page === "Production Dashboard" ? "Dashboard" : page}</h1>
          </div>
        </header>

        <div className="page"><SubscriptionNotice user={user} onUpgrade={()=>selectPage("Subscription Purchase")}/>{children}</div>
      </main>
    </div>
  );
}
