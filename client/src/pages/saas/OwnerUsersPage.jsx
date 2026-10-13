import PageTitle from "../../components/common/PageTitle.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function OwnerUsersPage({ onPageChange }) {
  const { user } = useAuth();
  return <section className="classic-page">
    <PageTitle title="Platform owner account" subtitle="Platform administration and customer user accounts have separate scopes." />
    <div className="classic-card">
      <dl className="owner-subscription-details">
        <div><dt>Name</dt><dd>{user?.name || "—"}</dd></div>
        <div><dt>User ID</dt><dd>{user?.userId || "—"}</dd></div>
        <div><dt>Role</dt><dd>Platform owner</dd></div>
      </dl>
      <p>Manage your profile in Owner Settings. Customer administrators manage factory and department users inside their company workspace. New platform owners require the private administrator provisioning procedure.</p>
      <div className="row-actions">
        <button type="button" onClick={() => onPageChange("Owner Settings")}>Owner Settings</button>
        <button type="button" onClick={() => onPageChange("Companies")}>Company administrators</button>
      </div>
    </div>
  </section>;
}
