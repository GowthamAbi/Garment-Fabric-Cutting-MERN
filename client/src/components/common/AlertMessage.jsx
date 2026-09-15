export default function AlertMessage({ message, type = "success" }) {
  return message ? (
    <div className={`alert-message ${type}`}>{message}</div>
  ) : null;
}
