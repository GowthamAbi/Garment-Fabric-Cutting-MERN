import { useState } from "react";
import { QrCode } from "lucide-react";
import { api } from "../../api.js";
import Card from "../../components/common/Card.jsx";
import Field from "../../components/common/Field.jsx";
import FormActions from "../../components/common/FormActions.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import { formatInputDate, formatLabel } from "../../utils/formatters.js";

const initialForm = {
  itemCode: "",
  inwardReference: "",
  dcNo: "",
  section: "",
  quantity: "",
  transactionDate: formatInputDate(new Date()),
  createdBy: "Store User",
};

export default function OutwardPage({ notify }) {
  const [form, setForm] = useState(initialForm);

  async function saveOutward(event) {
    event.preventDefault();

    const result = await api("/transactions/outward", {
      method: "POST",
      body: JSON.stringify(form),
    });

    notify(`Outward saved. Balance: ${result.balanceQty}`);
    setForm({ ...initialForm, transactionDate: form.transactionDate });
  }

  return (
    <>
      <PageTitle
        title="Outward entry"
        subtitle="Scan or enter the inward reference, then issue stock"
      />

      <div className="outward-grid">
        <Card title="QR / inward reference">
          <div className="scanner">
            <QrCode />
            <h3>Scan inward QR</h3>
            <p>The scanner value is entered in the inward-reference field.</p>
          </div>
        </Card>

        <Card title="Issue details">
          <form className="form-grid" onSubmit={saveOutward}>
            {Object.keys(initialForm).map((fieldName) => (
              <Field key={fieldName} label={formatLabel(fieldName)}>
                <input
                  required={["itemCode", "quantity"].includes(fieldName)}
                  type={
                    fieldName === "quantity"
                      ? "number"
                      : fieldName === "transactionDate"
                        ? "date"
                        : "text"
                  }
                  value={form[fieldName]}
                  onChange={(event) =>
                    setForm({ ...form, [fieldName]: event.target.value })
                  }
                />
              </Field>
            ))}
            <FormActions />
          </form>
        </Card>
      </div>
    </>
  );
}
