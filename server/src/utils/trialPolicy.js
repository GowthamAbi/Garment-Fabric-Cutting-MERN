export function trialEligible(company, registry, hasPaid) {
  return Boolean(company && registry && registry.status !== "ARCHIVED" && company.active !== false &&
    !hasPaid && !company.trialStartedAt && !registry.trialStartedAt &&
    company.subscriptionPlan !== "Trial");
}
