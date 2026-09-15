export default function StatCard({ label, value, icon }) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <i>{icon}</i>
    </div>
  );
}
