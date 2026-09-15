export default function FormActions({ onCancel }) {
  return (
    <div className="form-actions">
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}

      <button className="primary" type="submit">
        Save
      </button>
    </div>
  );
}
