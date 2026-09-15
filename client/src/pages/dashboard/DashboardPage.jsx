import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
} from "lucide-react";
import { api } from "../../api.js";
import Card from "../../components/common/Card.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import { formatDate } from "../../utils/formatters.js";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    api("/dashboard").then(setDashboard).catch(console.error);
  }, []);

  if (!dashboard) return <div className="loading">Loading dashboard...</div>;

  const cards = [
    ["Master items", dashboard.totalItems, Boxes],
    ["Today inward", dashboard.todayInward, ArrowDownToLine],
    ["Today outward", dashboard.todayOutward, ArrowUpFromLine],
    ["Low stock", dashboard.lowStock.length, AlertTriangle],
  ];

  return (
    <>
      <PageTitle
        title="Store overview"
        subtitle="Live inward, outward and purchase-order information"
      />

      <div className="stats">
        {cards.map(([label, value, Icon]) => (
          <div className="stat" key={label}>
            <div>
              <span>{label}</span>
              <b>{value}</b>
            </div>
            <i>
              <Icon />
            </i>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <Card title="Minimum quantity alerts">
          {dashboard.lowStock.length === 0 ? (
            <EmptyState text="All stock levels are healthy" />
          ) : (
            dashboard.lowStock.map((item) => (
              <div className="alert" key={item._id}>
                <div>
                  <b>{item.description}</b>
                  <small>{item.itemCode}</small>
                </div>
                <span>
                  {item.stockQty} / {item.minimumQty} {item.unit}
                </span>
              </div>
            ))
          )}
        </Card>

        <Card title="PO delivery within 10 days">
          {dashboard.duePOs.length === 0 ? (
            <EmptyState text="No PO due within 10 days" />
          ) : (
            dashboard.duePOs.map((purchaseOrder) => (
              <div className="alert" key={purchaseOrder._id}>
                <div>
                  <b>{purchaseOrder.poNo}</b>
                  <small>{purchaseOrder.itemCode}</small>
                </div>
                <span>{formatDate(purchaseOrder.deliveryDate)}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
