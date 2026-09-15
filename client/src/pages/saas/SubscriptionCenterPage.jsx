import { CreditCard, FileText, Gauge, ReceiptText } from "lucide-react";

export default function SubscriptionCenterPage({ mode }) {
  const content = {
    "Subscription Plan": [
      CreditCard,
      "Current Plan",
      "View plan limits, renewal date and available upgrades.",
    ],
    "Subscription Purchase": [
      FileText,
      "Purchase Subscription",
      "Create a subscription purchase request for SaaS Owner approval.",
    ],
    "Subscription Bills": [
      ReceiptText,
      "Bills & Payments",
      "Company subscription invoices and payment history.",
    ],
    "Subscription Usage": [
      Gauge,
      "Usage",
      "Users, factories, storage and monthly transaction usage.",
    ],
  }[mode] || [CreditCard, "Subscription", "Subscription account details"];
  const Icon = content[0];
  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>SUBSCRIPTION</small>
          <h2>{content[1]}</h2>
          <p>{content[2]}</p>
        </div>
      </div>
      <div className="classic-card subscription-placeholder">
        <Icon />
        <h3>{content[1]}</h3>
        <p>
          This page is read-only for Company Admin. Purchase requests are
          approved by SaaS Super Admin.
        </p>
      </div>
    </section>
  );
}
