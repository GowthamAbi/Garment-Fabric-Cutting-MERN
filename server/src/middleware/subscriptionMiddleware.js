import {subscriptionAccess} from "../utils/subscriptionAccess.js";
import Company from "../models/Company.js";
import ApiError from "../utils/ApiError.js";

export async function requireActiveSubscription(request, _response, next) {
  if (request.user?.role === "saas_super_admin") return next();
  if (request.path.startsWith("/saas/subscription")) return next();
  const company = await Company.findById(request.user?.companyId).lean();
  if (!company || !company.active)
    return next(new ApiError(403, "Company account is inactive"));
  if (!subscriptionAccess(company).accessAllowed)
    return next(
      new ApiError(402, company.subscriptionStatus==="PaymentPending"?"Payment pending. Open Subscription Purchase to activate paid access":"Subscription expired or suspended. Open Subscription Purchase to renew"),
    );
  next();
}
