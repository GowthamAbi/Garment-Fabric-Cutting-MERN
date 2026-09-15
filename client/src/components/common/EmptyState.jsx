export default function EmptyState({ text = "No records found" }) {
  return <div className="empty">{text}</div>;
}
