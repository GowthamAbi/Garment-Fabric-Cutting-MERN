import { useEffect, useState } from "react";
import MainLayout from "./components/layout/MainLayout.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import PublicOutwardPage from "./pages/outward/PublicOutwardPage.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";
import ProductionControlPage from "./pages/production/ProductionControlPage.jsx";
import GlobalFeedback from "./components/common/GlobalFeedback.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import PrivacyPage from "./pages/legal/PrivacyPage.jsx";
import SuperAdminLayout from "./components/layout/SuperAdminLayout.jsx";

function Application() {
  const { token, user } = useAuth();
  const adminRoles = ["saas_super_admin", "admin"];
  const [page, setPage] = useState(
    window.location.pathname === "/production"
      ? "Production Control"
      : user?.role === "saas_super_admin"
        ? "SaaS Owner Dashboard"
        : user?.role === "company_admin"
          ? "Company Dashboard"
          : adminRoles.includes(user?.role)
            ? "Modules"
            : ["fabric_admin", "fabric_entry"].includes(user?.role)
              ? "Fabric Master"
              : ["cutting_admin", "cutting_entry"].includes(user?.role)
                ? "Fabric Cutting Plan"
                : ["elastic_admin", "elastic_entry"].includes(user?.role)
                  ? "Elastic Requirement"
                  : user?.role?.includes("production")
                    ? "Production Dashboard"
                    : "Dashboard",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !user) return;
    const nextPage =
      window.location.pathname === "/production"
        ? "Production Control"
        : user.role === "saas_super_admin"
          ? "SaaS Owner Dashboard"
          : user.role === "company_admin"
            ? "Company Dashboard"
            : adminRoles.includes(user.role)
              ? "Modules"
              : ["fabric_admin", "fabric_entry"].includes(user.role)
                ? "Fabric Master"
                : ["cutting_admin", "cutting_entry"].includes(user.role)
                  ? "Fabric Cutting Plan"
                  : ["elastic_admin", "elastic_entry"].includes(user.role)
                    ? "Elastic Requirement"
                    : ["department_incharge", "department_entry"].includes(
                          user.role,
                        )
                      ? "Department Dashboard"
                      : user.role?.includes("production") ||
                          [
                            "supervisor",
                            "quality",
                            "maintenance",
                            "sewing_coordinator",
                            "management",
                            "view_only",
                          ].includes(user.role)
                        ? "Production Dashboard"
                        : "Dashboard";
    setPage(nextPage);
  }, [token, user?._id, user?.role]);

  function notify(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2600);
  }

  if (!token) return <LoginPage />;

  const productionQrPage =
    window.location.pathname === "/production" &&
    new URLSearchParams(window.location.search).toString();
  if (productionQrPage) {
    return (
      <div className="standalone-production-page">
        <div className="standalone-production-brand">
          Accessories Flow <small>PRODUCTION</small>
        </div>
        <ProductionControlPage notify={notify} />
        {message && <div className="toast">{message}</div>}
      </div>
    );
  }

  if (user?.role === "saas_super_admin") {
    return (
      <>
        <SuperAdminLayout page={page} onPageChange={setPage}>
          <AppRoutes page={page} notify={notify} onPageChange={setPage} />
        </SuperAdminLayout>
        {message && <div className="toast">{message}</div>}
      </>
    );
  }

  return (
    <>
      <MainLayout page={page} onPageChange={setPage}>
        <AppRoutes page={page} notify={notify} onPageChange={setPage} />
      </MainLayout>

      {message && <div className="toast">{message}</div>}
    </>
  );
}

export default function App() {
  const inwardNo = new URLSearchParams(window.location.search).get("inwardNo");

  if (window.location.pathname === "/privacy") return <PrivacyPage />;

  if (window.location.pathname === "/outward" && inwardNo) {
    return (
      <>
        <GlobalFeedback />
        <PublicOutwardPage inwardNo={inwardNo} />
      </>
    );
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <GlobalFeedback />
        <Application />
      </AuthProvider>
    </LanguageProvider>
  );
}
