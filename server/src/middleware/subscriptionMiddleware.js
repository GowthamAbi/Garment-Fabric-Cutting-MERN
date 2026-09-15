import Company from "../models/Company.js";
import ApiError from "../utils/ApiError.js";

export async function requireActiveSubscription(request, _response, next) {
  if (request.user?.role === "saas_super_admin") return next();
  if (request.path.startsWith("/saas/subscription")) return next();
  const company = await Company.findById(request.user?.companyId).lean();
  if (!company || !company.active) return next(new ApiError(403, "Company account is inactive"));
  const expired = company.subscriptionEndsAt && new Date(company.subscriptionEndsAt) < new Date();
  if (company.subscriptionStatus !== "Active" || expired) return next(new ApiError(402, "Subscription expired. Contact your administrator"));
  next();
}
