import Field from "../../components/common/Field.jsx";
import FormActions from "../../components/common/FormActions.jsx";
export default function PurchaseOrderForm({
  form,
  setForm,
  onSubmit,
  onCancel,
}) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {Object.keys(form).map((key) => (
        <Field key={key} label={key}>
          <input
            value={form[key] ?? ""}
            onChange={(event) =>
              setForm({ ...form, [key]: event.target.value })
            }
          />
        </Field>
      ))}
      <FormActions onCancel={onCancel} />
    </form>
  );
}
