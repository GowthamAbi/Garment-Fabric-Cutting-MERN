import DashboardPage from "../pages/dashboard/DashboardPage.jsx";
import HistoryPage from "../pages/history/HistoryPage.jsx";
import InwardPage from "../pages/inward/InwardPage.jsx";
import ItemMasterPage from "../pages/master/ItemMasterPage.jsx";
import PrintPage from "../pages/print/PrintPage.jsx";
import PurchaseOrderPage from "../pages/purchase-order/PurchaseOrderPage.jsx";
import StockPage from "../pages/stock/StockPage.jsx";
import PendingPage from "../pages/production/PendingPage.jsx";
import ProductionControlPage from "../pages/production/ProductionControlPage.jsx";
import ProductionDashboardPage from "../pages/production/ProductionDashboardPage.jsx";
import ProductionSetupPage from "../pages/production/ProductionSetupPage.jsx";
import SewingDeliveryPage from "../pages/production/SewingDeliveryPage.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import UserManagementPage from "../pages/auth/UserManagementPage.jsx";
import CompanyManagementPage from "../pages/auth/CompanyManagementPage.jsx";
import ProductionPlanningPage from "../pages/production/ProductionPlanningPage.jsx";
import ReportsPage from "../pages/reports/ReportsPage.jsx";
import ProductionMasterPage from "../pages/master/ProductionMasterPage.jsx";
import ModuleSelectionPage from "../pages/dashboard/ModuleSelectionPage.jsx";
import MachineStatusPage from "../pages/production/MachineStatusPage.jsx";
import WarehousePage from "../pages/production/WarehousePage.jsx";
import CuttingDcPage from "../pages/production/CuttingDcPage.jsx";
import SaasControlPage from "../pages/saas/SaasControlPage.jsx";
import AuditBackupPage from "../pages/saas/AuditBackupPage.jsx";
import OnboardingPage from "../pages/saas/OnboardingPage.jsx";
import SuperAdminDashboardPage from "../pages/saas/SuperAdminDashboardPage.jsx";
import ProfileSettingsPage from "../pages/saas/ProfileSettingsPage.jsx";
import FabricCuttingPage from "../pages/fabric/FabricCuttingPage.jsx";
import FabricMasterPage from "../pages/fabric/FabricMasterPage.jsx";
import FabricInwardPage from "../pages/fabric/FabricInwardPage.jsx";
import GarmentItemMasterPage from "../pages/master/GarmentItemMasterPage.jsx";
import CompanyAdminDashboardPage from "../pages/dashboard/CompanyAdminDashboardPage.jsx";
import DepartmentDashboardPage from "../pages/dashboard/DepartmentDashboardPage.jsx";
import CompanyInsightsPage from "../pages/dashboard/CompanyInsightsPage.jsx";
import SubscriptionCenterPage from "../pages/saas/SubscriptionCenterPage.jsx";

export default function AppRoutes({ page, notify, onPageChange }) {
  const { user } = useAuth();
  switch (page) {
    case "Fabric Master":
      return <FabricMasterPage notify={notify} />;
    case "Fabric Inward":
      return <FabricInwardPage notify={notify} />;
    case "Item Master":
      return <GarmentItemMasterPage notify={notify} />;
    case "Company Dashboard":
      return (
        <CompanyAdminDashboardPage
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Department Dashboard":
      return <DepartmentDashboardPage onPageChange={onPageChange} />;
    case "Company Reports":
    case "Company Timeline":
    case "Company Stock":
    case "Company Approvals":
      return <CompanyInsightsPage mode={page} notify={notify} />;
    case "Subscription Plan":
    case "Subscription Purchase":
    case "Subscription Bills":
    case "Subscription Usage":
      return <SubscriptionCenterPage mode={page} />;
    case "Fabric Cutting Plan":
      return <FabricCuttingPage mode="plan" notify={notify} />;
    case "Cutting Actual Entry":
      return <FabricCuttingPage mode="actual" notify={notify} />;
    case "Fabric Waste":
      return <FabricCuttingPage mode="waste" notify={notify} />;
    case "Elastic Requirement":
      return <FabricCuttingPage mode="elastic" notify={notify} />;
    case "SaaS Owner Dashboard":
      return <SuperAdminDashboardPage notify={notify} />;
    case "Companies":
      return <CompanyManagementPage notify={notify} />;
    case "Subscriptions":
      return <SaasControlPage notify={notify} />;
    case "Owner Users":
      return <UserManagementPage notify={notify} />;
    case "Account Details":
      return <ProfileSettingsPage mode="details" notify={notify} />;
    case "Profile Settings":
      return <ProfileSettingsPage notify={notify} />;
    case "Owner Settings":
      return <ProfileSettingsPage mode="settings" notify={notify} />;
    case "Modules":
      return <ModuleSelectionPage onSelect={onPageChange} />;
    case "Inward":
      return <InwardPage notify={notify} />;
    case "PO":
      return <PurchaseOrderPage pending={false} notify={notify} />;
    case "PO Pending":
      return <PurchaseOrderPage pending notify={notify} />;
    case "Print":
      return <PrintPage notify={notify} />;
    case "Stock":
      return <StockPage />;
    case "History":
      return <HistoryPage />;
    case "Master Data":
      return <ItemMasterPage notify={notify} />;
    case "Production Masters":
      return <ProductionMasterPage notify={notify} />;
    case "Production Control":
      return <ProductionControlPage notify={notify} />;
    case "Status":
      return <MachineStatusPage />;
    case "Production Ready":
      return <WarehousePage initialType="PRODUCTION_READY" notify={notify} />;
    case "Rework Warehouse":
      return <WarehousePage initialType="REWORK" notify={notify} />;
    case "Rejection Warehouse":
      return <WarehousePage initialType="REJECTION" notify={notify} />;
    case "Balance Elastic":
      return <WarehousePage initialType="BALANCE_ELASTIC" notify={notify} />;
    case "Section Delivery":
      return <WarehousePage initialType="SECTION_DELIVERY" notify={notify} />;
    case "Production Planning":
      return <ProductionPlanningPage notify={notify} />;
    case "Cutting DC":
      return <CuttingDcPage notify={notify} />;
    case "Production Dashboard":
      return <ProductionDashboardPage />;
    case "Machine Register":
      return <ProductionSetupPage mode="machine" notify={notify} />;
    case "Employee Register":
      return <ProductionSetupPage mode="employee" notify={notify} />;
    case "Machine & Employee":
      return <ProductionSetupPage notify={notify} />;
    case "Pending & Issues":
      return <PendingPage notify={notify} />;
    case "Sewing Delivery":
      return <SewingDeliveryPage notify={notify} />;
    case "User Management":
      return <UserManagementPage notify={notify} />;
    case "SaaS Companies":
      return <CompanyManagementPage notify={notify} />;
    case "Subscription":
      return <SaasControlPage notify={notify} />;
    case "Audit & Backup":
      return <AuditBackupPage notify={notify} />;
    case "Setup Guide":
      return <OnboardingPage notify={notify} />;
    case "Reports":
    case "Reports & Traceability":
      return <ReportsPage notify={notify} />;
    default:
      return user?.role?.includes("production") ||
        [
          "supervisor",
          "quality",
          "maintenance",
          "sewing_coordinator",
          "management",
          "view_only",
        ].includes(user?.role) ? (
        <ProductionDashboardPage />
      ) : (
        <DashboardPage />
      );
  }
}
