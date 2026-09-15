export default function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal confirm">
        <p>{message}</p>
        <button onClick={onCancel}>Cancel</button>
        <button className="danger" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </div>
  );
}
