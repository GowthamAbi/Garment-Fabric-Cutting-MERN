import FactoryManagement from "../pages/auth/FactoryManagement.jsx";
import {rolePageAllowed} from "../config/roleDepartmentNavigation.mjs";
import {EXCEL_PAGE_PREFIX,excelOptionForUser,excelOptionTarget} from "../config/excelOptionNavigation.mjs";
import DepartmentRolePreview from "../pages/dashboard/DepartmentRolePreview.jsx";
import DepartmentApprovalQueue from "../pages/dashboard/DepartmentApprovalQueue.jsx";
import DepartmentTasksPage from "../pages/dashboard/DepartmentTasksPage.jsx";
import ManagementApprovalInbox from "../pages/dashboard/ManagementApprovalInbox.jsx";
import ApprovalGrantsPage from "../pages/dashboard/ApprovalGrantsPage.jsx";
import CompanyApprovalSettingsPage from "../pages/dashboard/CompanyApprovalSettingsPage.jsx";
import CompanyPurchaseOrders from "../pages/erp/CompanyPurchaseOrders.jsx";
import AccessoriesDepartmentPage from "../pages/erp/AccessoriesDepartmentPage.jsx";
import ElasticDepartmentPage from "../pages/erp/ElasticDepartmentPage.jsx";
import StitchingDepartmentPage from "../pages/erp/StitchingDepartmentPage.jsx";
import InwardDepartmentPage from "../pages/erp/InwardDepartmentPage.jsx";
import CheckingDepartmentPage from "../pages/erp/CheckingDepartmentPage.jsx";
import IroningDepartmentPage from "../pages/erp/IroningDepartmentPage.jsx";
import DashboardPage from "../pages/dashboard/DashboardPage.jsx";
import Departments from "../pages/erp/Departments.jsx";
import ErpWorkspace from "../pages/erp/ErpWorkspace.jsx";
import AutomationPage from "../pages/erp/AutomationPage.jsx";
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
import ProductionPlanEntryPage from "../pages/fabric/ProductionPlanEntryPage.jsx";
import ProductionPlanPrintPage from "../pages/fabric/ProductionPlanPrintPage.jsx";
import DepartmentRecordPage from "../pages/fabric/DepartmentRecordPage.jsx";
import ProductionPlanHistoryPage from "../pages/fabric/ProductionPlanHistoryPage.jsx";
import FabricStockPage from "../pages/fabric/FabricStockPage.jsx";
import DepartmentPlanPrintPage from "../pages/fabric/DepartmentPlanPrintPage.jsx";
import FoldingEntryPage from "../pages/fabric/FoldingEntryPage.jsx";
import CuttingStockPage from "../pages/fabric/CuttingStockPage.jsx";
import FabricQrPrintPage from "../pages/fabric/FabricQrPrintPage.jsx";
import FabricPlanMonitorPage from "../pages/fabric/FabricPlanMonitorPage.jsx";
import FabricIssueEntryPage from "../pages/fabric/FabricIssueEntryPage.jsx";
import FabricOperationsPage from "../pages/fabric/FabricOperationsPage.jsx";
import CuttingMachinePlanPage from "../pages/production/CuttingMachinePlanPage.jsx";
import CuttingMachineMasterPage from "../pages/production/CuttingMachineMasterPage.jsx";
import CuttingGanttOverviewPage from "../pages/production/CuttingGanttOverviewPage.jsx";
import CuttingTargetActualPage from "../pages/production/CuttingTargetActualPage.jsx";
import DeliveryDepartmentPage from "../pages/delivery/DeliveryDepartmentPage.jsx";
import DeliveryMonitoringPage from "../pages/delivery/DeliveryMonitoringPage.jsx";
import DepartmentOverviewPage from "../pages/dashboard/DepartmentOverviewPage.jsx";
import OwnerPlansPage from "../pages/saas/OwnerPlansPage.jsx";
import OwnerSalesPage from "../pages/saas/OwnerSalesPage.jsx";
import OwnerSubscriptionsPage from "../pages/saas/OwnerSubscriptionsPage.jsx";
import OwnerUsersPage from "../pages/saas/OwnerUsersPage.jsx";
import {DEPARTMENTS} from "../../../shared/departmentCatalogue.js";
import LeadCrmPage from "../pages/saas/LeadCrmPage.jsx";
import SupportAccessPage from "../pages/saas/SupportAccessPage.jsx";

export default function AppRoutes({ page, notify, onPageChange, _fromExcelOption=null }) {
  const { user } = useAuth();
  // Only a validated Excel option may forward to an already existing screen.
  // Backend permissions and subscription checks still enforce every API call.
  if(!_fromExcelOption&&!rolePageAllowed(user,page))return <p role="alert">This screen is outside your assigned department and role.</p>;
  if(page.startsWith(EXCEL_PAGE_PREFIX)){
    const excelId=page.slice(EXCEL_PAGE_PREFIX.length);
    const item=excelOptionForUser(user,excelId);
    if(!item||!rolePageAllowed(user,page))return <p role="alert">This Excel option is outside your assigned department or role.</p>;
    const existingPage=excelOptionTarget(item);
    return <section className="excel-option-workspace" aria-label={item.label}>
      <header className="excel-option-header">
        <div><small>{item.departmentCode} · {item.role} · Excel {item.id}</small><h2>{item.label}</h2></div>
        <span className="excel-option-status">{existingPage?"Existing workflow · QA pending":"Specific workflow pending development"}</span>
      </header>
      {existingPage
        ? <AppRoutes page={existingPage} notify={notify} onPageChange={onPageChange} _fromExcelOption={item.id}/>
        : <div className="erp-card">
            <p>This exact Excel requirement is tracked, but its dedicated screen and API have not yet been implemented. No fake save action or placeholder data is shown.</p>
            <p>Workbook reference: {item.id}. The department administrator can continue using existing approved workflows until this option passes staging acceptance.</p>
          </div>}
    </section>;
  }
  if(page.startsWith("Department Workspace:")){
    const department=page.slice("Department Workspace:".length);
    return DEPARTMENTS.includes(department) ? <div className="erp-shell"><Departments key={department} initialDepartment={department} notify={notify}/></div> : <p role="alert">Unknown department.</p>;
  }
  switch (page) {
    case "Company Approval Settings": return <CompanyApprovalSettingsPage />;
    case "Approval Authority": return <ApprovalGrantsPage />;
    case "Management Approval Inbox": return <ManagementApprovalInbox />;
    case "Department Tasks":
      return <DepartmentTasksPage />;
    case "Department Approval Requests": return <DepartmentApprovalQueue />;
    case "Department Sidebar Planning": return <DepartmentRolePreview />;
    case "Production & Retail": return <div className="erp-shell"><Departments notify={notify}/></div>;
    case "Integrated ERP": return <ErpWorkspace notify={notify} />;
    case "Subscription Automation": return <AutomationPage notify={notify} />;
    case "Fabric Operations Availability":
      return <FabricOperationsPage mode="availability"/>;
    case "Fabric Operations Inward":
      return <FabricOperationsPage mode="inward"/>;
    case "Fabric Operations Folding":
      return <FabricOperationsPage mode="folding"/>;
    case "Fabric Operations Batches":
      return <FabricOperationsPage mode="batches"/>;
    case "Fabric Operations History":
      return <FabricOperationsPage mode="history" onPageChange={onPageChange}/>;
    case "Fabric Operations Reports":
      return <FabricOperationsPage mode="reports"/>;
    case "Fabric Issue Entry":
      return <FabricIssueEntryPage notify={notify}/>;
    case "Fabric Plan Monitoring":
      return <FabricPlanMonitorPage mode="plans"/>;
    case "Fabric Issue Monitoring":
      return <FabricPlanMonitorPage mode="issues"/>;
    case "Fabric Dashboard":
      return (
        <DepartmentOverviewPage
          department="FABRIC"
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Cutting Dashboard":
      return (
        <DepartmentOverviewPage
          department="CUTTING"
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Delivery Dashboard":
      return (
        <DepartmentOverviewPage
          department="DELIVERY"
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Admin Dashboard":
      return (
        <DepartmentOverviewPage
          department="ADMIN"
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Accessories Dashboard":
      return <DashboardPage />;
    case "Elastic Dashboard":
      return <ProductionDashboardPage />;
    case "Delivery Completion Monitor":
      return <DeliveryMonitoringPage mode="completion" notify={notify} />;
    case "Delivery Vendor Status":
      return <DeliveryMonitoringPage mode="vendors" notify={notify} />;
    case "Delivery DC Monitor":
      return <DeliveryMonitoringPage mode="challans" notify={notify} />;
    case "Delivery Balance Monitor":
      return <DeliveryMonitoringPage mode="balance" notify={notify} />;
    case "Delivery Delay Monitor":
      return <DeliveryMonitoringPage mode="delays" notify={notify} />;
    case "Delivery Reports Monitor":
      return <DeliveryMonitoringPage mode="reports" notify={notify} />;
    case "Delivery Handover Workspace":
      return <DeliveryMonitoringPage mode="handover" notify={notify} />;
    case "Delivery Vendor Pending":
      return <DeliveryMonitoringPage mode="pending" notify={notify} />;
    case "Vendor Registration":
      return <DeliveryDepartmentPage mode="vendors" notify={notify} />;
    case "Delivery Plan Details":
      return (
        <DeliveryDepartmentPage
          mode="plans"
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Section Plan":
      return <DeliveryDepartmentPage mode="section" notify={notify} />;
    case "Section History":
      return <DeliveryDepartmentPage mode="history" notify={notify} />;
    case "Accessories Requirement":
      return <AccessoriesDepartmentPage mode="requirement" notify={notify} />;
    case "Accessories Purchase Status":
      return <AccessoriesDepartmentPage mode="purchaseStatus" notify={notify} />;
    case "Accessories Stock Availability":
      return <AccessoriesDepartmentPage mode="availability" notify={notify} />;
    case "Accessories Before Status":
      return <AccessoriesDepartmentPage mode="beforeStatus" notify={notify} />;
    case "Accessories After Status":
      return <AccessoriesDepartmentPage mode="afterStatus" notify={notify} />;
    case "Accessories Shortage":
      return <AccessoriesDepartmentPage mode="shortage" notify={notify} />;
    case "Accessories Reports":
      return <AccessoriesDepartmentPage mode="reports" notify={notify} />;
    case "Accessories Master Workspace":
      return <AccessoriesDepartmentPage mode="master" notify={notify} />;
    case "Accessories Purchase Entry":
      return <AccessoriesDepartmentPage mode="purchase" notify={notify} />;
    case "Accessories Stock Workspace":
      return <AccessoriesDepartmentPage mode="stock" notify={notify} />;
    case "Accessories Before Issue":
      return <AccessoriesDepartmentPage mode="before" notify={notify} />;
    case "Accessories After Issue":
      return <AccessoriesDepartmentPage mode="after" notify={notify} />;
    case "Accessories Return Transfer":
      return <AccessoriesDepartmentPage mode="return" notify={notify} />;
    case "Accessories Adjustment Request":
      return <AccessoriesDepartmentPage mode="adjustment" notify={notify} />;
    case "Accessories History":
      return <AccessoriesDepartmentPage mode="history" notify={notify} />;
    case "Elastic Plans Workspace":
      return <ElasticDepartmentPage mode="plans" notify={notify} />;
    case "Elastic Material Availability":
      return <ElasticDepartmentPage mode="availability" notify={notify} />;
    case "Elastic Target vs Actual":
      return <ElasticDepartmentPage mode="target" notify={notify} />;
    case "Elastic Progress Workspace":
      return <ElasticDepartmentPage mode="progress" notify={notify} />;
    case "Elastic Shortage Workspace":
      return <ElasticDepartmentPage mode="issues" notify={notify} />;
    case "Elastic Wastage Workspace":
      return <ElasticDepartmentPage mode="waste" notify={notify} />;
    case "Elastic Reports Workspace":
      return <ElasticDepartmentPage mode="reports" notify={notify} />;
    case "Elastic Material Workspace":
      return <ElasticDepartmentPage mode="master" notify={notify} />;
    case "Elastic Inward Workspace":
      return <ElasticDepartmentPage mode="inward" notify={notify} />;
    case "Elastic Cutting Plan Workspace":
      return <ElasticDepartmentPage mode="plan" notify={notify} />;
    case "Elastic Cutting Entry Workspace":
      return <ElasticDepartmentPage mode="cut" notify={notify} />;
    case "Elastic Issue Return Workspace":
      return <ElasticDepartmentPage mode="return" notify={notify} />;
    case "Elastic Stock Workspace":
      return <ElasticDepartmentPage mode="stock" notify={notify} />;
    case "Elastic Correction Workspace":
      return <ElasticDepartmentPage mode="correction" notify={notify} />;
    case "Elastic History Workspace":
      return <ElasticDepartmentPage mode="history" notify={notify} />;
    case "Stitching Orders Workspace":
      return <StitchingDepartmentPage mode="orders" notify={notify} />;
    case "Stitching Operation Workspace":
      return <StitchingDepartmentPage mode="operations" notify={notify} />;
    case "Stitching Vendor Workspace":
      return <StitchingDepartmentPage mode="vendor" notify={notify} />;
    case "Stitching Targets Workspace":
      return <StitchingDepartmentPage mode="targets" notify={notify} />;
    case "Stitching WIP Workspace":
      return <StitchingDepartmentPage mode="wip" notify={notify} />;
    case "Stitching Defects Workspace":
      return <StitchingDepartmentPage mode="defects" notify={notify} />;
    case "Stitching Reports Workspace":
      return <StitchingDepartmentPage mode="reports" notify={notify} />;
    case "Stitching Master Workspace":
      return <StitchingDepartmentPage mode="master" notify={notify} />;
    case "Stitching Assigned Workspace":
      return <StitchingDepartmentPage mode="assigned" notify={notify} />;
    case "Stitching Bulletin Workspace":
      return <StitchingDepartmentPage mode="bulletin" notify={notify} />;
    case "Stitching Start Workspace":
      return <StitchingDepartmentPage mode="start" notify={notify} />;
    case "Stitching Completion Workspace":
      return <StitchingDepartmentPage mode="completion" notify={notify} />;
    case "Stitching Completed Workspace":
      return <StitchingDepartmentPage mode="completed" notify={notify} />;
    case "Stitching Rework Workspace":
      return <StitchingDepartmentPage mode="rework" notify={notify} />;
    case "Stitching Handover Workspace":
      return <StitchingDepartmentPage mode="handover" notify={notify} />;
    case "Stitching Trace Workspace":
      return <StitchingDepartmentPage mode="trace" notify={notify} />;
    case "Inward Expected Workspace":
      return <InwardDepartmentPage mode="expected" notify={notify} />;
    case "Inward Vendor Workspace":
      return <InwardDepartmentPage mode="vendor" notify={notify} />;
    case "Inward Progress Workspace":
      return <InwardDepartmentPage mode="progress" notify={notify} />;
    case "Inward Balance Workspace":
      return <InwardDepartmentPage mode="balance" notify={notify} />;
    case "Inward Variance Workspace":
      return <InwardDepartmentPage mode="variance" notify={notify} />;
    case "Inward Rework Workspace":
      return <InwardDepartmentPage mode="rework" notify={notify} />;
    case "Inward Reports Workspace":
      return <InwardDepartmentPage mode="reports" notify={notify} />;
    case "Inward Entry Workspace":
      return <InwardDepartmentPage mode="entry" notify={notify} />;
    case "Inward Partial Workspace":
      return <InwardDepartmentPage mode="partial" notify={notify} />;
    case "Inward Scan Workspace":
      return <InwardDepartmentPage mode="scan" notify={notify} />;
    case "Inward Request Workspace":
      return <InwardDepartmentPage mode="request" notify={notify} />;
    case "Inward Pending Workspace":
      return <InwardDepartmentPage mode="pending" notify={notify} />;
    case "Inward History Workspace":
      return <InwardDepartmentPage mode="history" notify={notify} />;
    case "Inward Print Workspace":
      return <InwardDepartmentPage mode="print" notify={notify} />;
    case "Checking Plans Workspace":
      return <CheckingDepartmentPage mode="plans" notify={notify} />;
    case "Checking Pending Workspace":
      return <CheckingDepartmentPage mode="pending" notify={notify} />;
    case "Checking Results Workspace":
      return <CheckingDepartmentPage mode="results" notify={notify} />;
    case "Checking Defects Workspace":
      return <CheckingDepartmentPage mode="defects" notify={notify} />;
    case "Checking Followup Workspace":
      return <CheckingDepartmentPage mode="followup" notify={notify} />;
    case "Checking Holds Workspace":
      return <CheckingDepartmentPage mode="holds" notify={notify} />;
    case "Checking Reports Workspace":
      return <CheckingDepartmentPage mode="reports" notify={notify} />;
    case "Checking Bundles Workspace":
      return <CheckingDepartmentPage mode="bundles" notify={notify} />;
    case "Checking Entry Workspace":
      return <CheckingDepartmentPage mode="entry" notify={notify} />;
    case "Checking Split Workspace":
      return <CheckingDepartmentPage mode="split" notify={notify} />;
    case "Checking Classification Workspace":
      return <CheckingDepartmentPage mode="classify" notify={notify} />;
    case "Checking Oil Workspace":
      return <CheckingDepartmentPage mode="oil" notify={notify} />;
    case "Checking Recheck Workspace":
      return <CheckingDepartmentPage mode="recheck" notify={notify} />;
    case "Checking Hold Workspace":
      return <CheckingDepartmentPage mode="hold" notify={notify} />;
    case "Checking Scan Workspace":
      return <CheckingDepartmentPage mode="scan" notify={notify} />;
    case "Checking History Workspace":
      return <CheckingDepartmentPage mode="history" notify={notify} />;
    case "Ironing Queue Workspace":
      return <IroningDepartmentPage mode="queue" notify={notify} />;
    case "Ironing Targets Workspace":
      return <IroningDepartmentPage mode="targets" notify={notify} />;
    case "Ironing Status Workspace":
      return <IroningDepartmentPage mode="status" notify={notify} />;
    case "Ironing Issues Workspace":
      return <IroningDepartmentPage mode="issues" notify={notify} />;
    case "Ironing Handover Workspace":
      return <IroningDepartmentPage mode="handover" notify={notify} />;
    case "Ironing Delays Workspace":
      return <IroningDepartmentPage mode="delays" notify={notify} />;
    case "Ironing Reports Workspace":
      return <IroningDepartmentPage mode="reports" notify={notify} />;
    case "Ironing Received Workspace":
      return <IroningDepartmentPage mode="received" notify={notify} />;
    case "Ironing Entry Workspace":
      return <IroningDepartmentPage mode="entry" notify={notify} />;
    case "Ironing Completed Workspace":
      return <IroningDepartmentPage mode="completed" notify={notify} />;
    case "Ironing Damage Workspace":
      return <IroningDepartmentPage mode="damage" notify={notify} />;
    case "Ironing QR Workspace":
      return <IroningDepartmentPage mode="qr" notify={notify} />;
    case "Ironing History Workspace":
      return <IroningDepartmentPage mode="history" notify={notify} />;
    case "Ironing Print Workspace":
      return <IroningDepartmentPage mode="print" notify={notify} />;
    case "Fabric Inward Entry":
      return <FabricInwardPage notify={notify} />;
    case "Fabric Inward Print":
      return (
        <DepartmentRecordPage
          mode="print"
          departmentType="FABRIC"
          notify={notify}
        />
      );
    case "Fabric Roll QR Print":
      return <FabricQrPrintPage notify={notify} />;
    case "Fabric Inward History":
      return (
        <DepartmentRecordPage
          mode="history"
          departmentType="FABRIC"
          notify={notify}
        />
      );
    case "Fabric Entry":
    case "Fabric to Cutting Entry":
      return <ProductionPlanEntryPage notify={notify} />;
    case "Planning Machine Wise":
      return <ProductionPlanningPage notify={notify} />;
    case "Machine Plan Entry":
    case "Machine Plan":
      return <CuttingMachinePlanPage mode="plan" notify={notify} />;
    case "Plan Number Status":
      return <CuttingMachinePlanPage mode="plan-status" notify={notify} />;
    case "Cutter Status":
      return <CuttingMachinePlanPage mode="status" notify={notify} />;
    case "Folding Entry":
      return <FoldingEntryPage notify={notify} />;
    case "Plan Print":
    case "Fabric Plan Print":
      return <DepartmentPlanPrintPage type="fabric" notify={notify} />;
    case "Folding Print":
      return <DepartmentPlanPrintPage type="folding" notify={notify} />;
    case "Cutting Plan Print":
      return <DepartmentPlanPrintPage type="cutting" notify={notify} />;
    case "Elastic Plan Print":
      return <DepartmentPlanPrintPage type="elastic" notify={notify} />;
    case "Fabric Plan History":
    case "Cutting Plan History":
      return (
        <ProductionPlanHistoryPage
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Inward Stock":
    case "Fabric Stock Inward":
      return <FabricStockPage mode="inward" notify={notify} />;
    case "Fabric Stock Balance":
      return <FabricStockPage mode="balance" notify={notify} />;
    case "Fabric Stock Waste":
      return <FabricCuttingPage mode="waste" notify={notify} />;
    case "Cutting Gantt Overview":
      return <CuttingGanttOverviewPage notify={notify} />;
    case "Cutting Target vs Actual":
      return <CuttingTargetActualPage notify={notify} />;
    case "Cutting Machine Master":
      return <CuttingMachineMasterPage notify={notify} />;
    case "Machine Detail Entry & QR Print":
      return <ProductionSetupPage mode="machine" notify={notify} />;
    case "Cutting Pending":
      return <CuttingStockPage mode="pending" notify={notify} />;
    case "Cutting Stock":
      return <CuttingStockPage mode="stock" notify={notify} />;
    case "Cutting Waste":
      return <CuttingStockPage mode="waste" notify={notify} />;
    case "Spreader Timeline":
      return (
        <CuttingMachinePlanPage mode="timeline-spreader" notify={notify} />
      );
    case "Separator Timeline":
      return (
        <CuttingMachinePlanPage mode="timeline-spreader" notify={notify} />
      );
    case "Cutter Timeline":
      return <CuttingMachinePlanPage mode="timeline-cutter" notify={notify} />;
    case "Machine Reports":
      return <CuttingMachinePlanPage mode="machine-reports" notify={notify} />;
    case "Cutting Time History":
      return <CuttingMachinePlanPage mode="time-history" notify={notify} />;
    case "Fabric Master":
      return <FabricMasterPage notify={notify} />;
    case "Fabric Inward":
      return <FabricInwardPage notify={notify} />;
    case "Item Master":
      return <GarmentItemMasterPage notify={notify} />;
    case "Factory Management":return <FactoryManagement/>;
    case "Company Purchase Orders":return <CompanyPurchaseOrders/>;
    case "Warehouse Management":return <Departments key="warehouse" initialDepartment="WAREHOUSE" notify={notify}/>;
    case "Shop Management":return <Departments key="shop" initialDepartment="SHOP" notify={notify}/>;
    case "Marketing Analysis":return <Departments key="marketing" initialDepartment="MARKETING" notify={notify}/>;
    case "Production Departments":return <Departments notify={notify}/>;
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
    case "Department Approvals":
      return <CompanyInsightsPage mode={page} notify={notify} />;
    case "Subscription Plan":
    case "Subscription Purchase":
    case "Subscription Bills":
    case "Subscription Usage":
      return <SubscriptionCenterPage mode={page} onPageChange={onPageChange} />;
    case "Support Access":
      return <SupportAccessPage />;
    case "Production Plan Data Entry":
      return <ProductionPlanEntryPage notify={notify} />;
    case "Production Plan Print":
      return <ProductionPlanPrintPage notify={notify} />;
    case "Production Plan History":
      return (
        <ProductionPlanHistoryPage
          notify={notify}
          onPageChange={onPageChange}
        />
      );
    case "Fabric Stock":
      return <FabricStockPage notify={notify} />;
    case "Department History":
      return <DepartmentRecordPage mode="history" notify={notify} />;
    case "Department Print":
      return <DepartmentRecordPage mode="print" notify={notify} />;
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
      return user?.role === "saas_super_admin" ? <OwnerSubscriptionsPage /> : <SaasControlPage notify={notify} />;
    case "Plans":
      return <OwnerPlansPage notify={notify} />;
    case "Payments & Sales":
      return <OwnerSalesPage notify={notify} />;
    case "Lead CRM":
      return <LeadCrmPage notify={notify} />;
    case "Owner Users":
      return <OwnerUsersPage onPageChange={onPageChange} />;
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
      return user?.role === "saas_super_admin" ? <OwnerSubscriptionsPage /> : <SaasControlPage notify={notify} />;
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
