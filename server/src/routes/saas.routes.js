import { Router } from "express";
import {
  addLeadActivity,
  approveSubscription,
  createSubscription,
  downloadBackup,
  getAuditHistory,
  getOwnerOverview,
  getSubscription,
  listLeads,
  listPlans,
  saveLead,
  savePlan,
  updateSubscriptionStatus,
  verifyRazorpayPayment,
  decideLeadRequest,
} from "../controllers/saasController.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emailInvoice, getInvoice, listInvoices } from "../controllers/invoiceController.js";
import { createSupportGrant, exchangeSupportGrant, listSupportGrants, revokeSupportGrant } from "../controllers/supportAccessController.js";

const router = Router();
router.get("/support-grants", allowRoles("company_admin"), asyncHandler(listSupportGrants));
router.post("/support-grants", allowRoles("company_admin"), asyncHandler(createSupportGrant));
router.patch("/support-grants/:id/revoke", allowRoles("company_admin"), asyncHandler(revokeSupportGrant));
router.post("/support-session", allowRoles("saas_super_admin"), asyncHandler(exchangeSupportGrant));
router.get("/invoices", allowRoles("company_admin", "admin", "management"), asyncHandler(listInvoices));
router.get("/invoices/:id", allowRoles("company_admin", "admin", "management"), asyncHandler(getInvoice));
router.post("/invoices/:id/email", allowRoles("company_admin", "admin"), asyncHandler(emailInvoice));
router.get(
  "/subscription",
  allowRoles("saas_super_admin", "company_admin", "admin"),
  asyncHandler(getSubscription),
);
router.post(
  "/subscription",
  allowRoles("saas_super_admin", "company_admin", "admin"),
  asyncHandler(createSubscription),
);
router.patch(
  "/subscription/status",
  allowRoles("saas_super_admin", "company_admin"),
  asyncHandler(updateSubscriptionStatus),
);
router.patch(
  "/subscription/:id/approve",
  allowRoles("saas_super_admin"),
  asyncHandler(approveSubscription),
);
router.post(
  "/subscription/verify-razorpay",
  allowRoles("saas_super_admin", "company_admin", "admin"),
  asyncHandler(verifyRazorpayPayment),
);
router.get(
  "/owner-overview",
  allowRoles("saas_super_admin"),
  asyncHandler(getOwnerOverview),
);
router.get("/plans", allowRoles("saas_super_admin"), asyncHandler(listPlans));
router.post("/plans", allowRoles("saas_super_admin"), asyncHandler(savePlan));
router.put(
  "/plans/:id",
  allowRoles("saas_super_admin"),
  asyncHandler(savePlan),
);
router.get("/leads", allowRoles("saas_super_admin"), asyncHandler(listLeads));
router.post("/leads", allowRoles("saas_super_admin"), asyncHandler(saveLead));
router.put(
  "/leads/:id",
  allowRoles("saas_super_admin"),
  asyncHandler(saveLead),
);
router.post(
  "/leads/:id/activity",
  allowRoles("saas_super_admin"),
  asyncHandler(addLeadActivity),
);
router.patch(
  "/leads/:id/decision",
  allowRoles("saas_super_admin"),
  asyncHandler(decideLeadRequest),
);
router.get(
  "/audit",
  allowRoles("saas_super_admin", "company_admin", "admin"),
  asyncHandler(getAuditHistory),
);
router.get(
  "/backup",
  allowRoles("saas_super_admin", "company_admin", "admin"),
  asyncHandler(downloadBackup),
);
export default router;
