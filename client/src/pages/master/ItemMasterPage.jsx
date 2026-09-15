import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import Card from "../../components/common/Card.jsx";
import Field from "../../components/common/Field.jsx";
import FormActions from "../../components/common/FormActions.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";
import { formatLabel } from "../../utils/formatters.js";

const emptyItem = {
  itemCode: "",
  brand: "",
  description: "",
  category: "",
  type: "",
  colour: "",
  unit: "PCS",
  minimumQty: 0,
};

export default function ItemMasterPage({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyItem);

  async function loadItems() {
    setLoading(true);
    try {
      setItems(await api("/items"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function openNewItem() {
    setEditingItem({});
    setForm(emptyItem);
  }

  function openEditItem(item) {
    setEditingItem(item);
    setForm(item);
  }

  async function saveItem(event) {
    event.preventDefault();

    const path = editingItem._id ? `/items/${editingItem._id}` : "/items";
    await api(path, {
      method: editingItem._id ? "PUT" : "POST",
      body: JSON.stringify(form),
    });

    setEditingItem(null);
    loadItems();
    notify("Master item saved");
  }

  async function deleteItem(item) {
    if (!confirm(`Delete ${item.itemCode}?`)) return;
    await api(`/items/${item._id}`, { method: "DELETE" });
    loadItems();
    notify("Master item deleted");
  }

  const columns = [
    ["itemCode", "Item code"],
    ["brand", "Brand"],
    ["description", "Description"],
    ["category", "Category"],
    ["type", "Type"],
    ["colour", "Colour"],
    ["minimumQty", "Minimum"],
    ["stockQty", "Stock"],
  ].map(([key, label]) => ({ key, label }));

  return (
    <>
      <PageTitle
        title="Master data"
        subtitle="Items entered here are used throughout the application"
        action={
          <button className="primary" onClick={openNewItem}>
            <Plus /> Add item
          </button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={items}
          loading={loading}
          onEdit={openEditItem}
          onDelete={deleteItem}
        />
      </Card>

      {editingItem && (
        <Modal
          title={editingItem._id ? "Edit item" : "Add item"}
          onClose={() => setEditingItem(null)}
        >
          <form className="form-grid" onSubmit={saveItem}>
            {Object.keys(emptyItem).map((key) => (
              <Field key={key} label={formatLabel(key)}>
                <input
                  required={["itemCode", "description", "category"].includes(
                    key,
                  )}
                  type={key === "minimumQty" ? "number" : "text"}
                  value={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </Field>
            ))}
            <FormActions onCancel={() => setEditingItem(null)} />
          </form>
        </Modal>
      )}
    </>
  );
}
