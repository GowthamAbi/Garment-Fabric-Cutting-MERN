import { useEffect, useState } from "react";
import { Check, Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";

const size = () => ({
  size: "",
  dia: "",
  cuttingPieceWeightKg: "",
  foldingPieceWeightKg: "",
  elasticMeasurementMtr: "",
});
const range = () => ({
  fromSize: "",
  toSize: "",
  elasticType: "",
  cuttingType: "",
  measurementMtr: "",
});
const accessory = (name) => ({
  name,
  required: false,
  type: "",
  measurement: "",
  unit: "PCS",
});
const blank = () => ({
  itemCode: "",
  itemName: "",
  fabricGroup: "",
  sizes: [size()],
  elasticRanges: [range()],
  accessories: [
    accessory("ELASTIC"),
    accessory("FS"),
    accessory("STAB"),
    accessory("BUCKLES"),
  ],
});

export default function GarmentItemMasterPage({ notify }) {
  const { user } = useAuth();
  const admin = ["saas_super_admin", "company_admin", "admin"].includes(
    user?.role,
  );
  const canEdit = admin;
  const [form, setForm] = useState(blank());
  const [rows, setRows] = useState([]);
  const load = async () => setRows(await api.itemMasters());
  useEffect(() => {
    load();
  }, []);

  function updateList(key, index, field, value) {
    setForm({
      ...form,
      [key]: form[key].map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    });
  }
  async function submit(event) {
    event.preventDefault();
    await api.saveItemMaster(form, form._id);
    setForm(blank());
    notify?.(
      admin
        ? "Item Master approved and saved"
        : "Sent for Company Admin approval",
    );
    load();
  }
  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>COMMON MASTER</small>
          <h2>Item Master & Accessories BOM</h2>
          <p>
            One item record controls size-wise fabric weight and accessories
            consumption.
          </p>
        </div>
      </div>
      {canEdit && (
        <form className="classic-card" onSubmit={submit}>
          <div className="form-grid">
            <label>
              <span>Item Code</span>
              <input
                required
                value={form.itemCode}
                onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
              />
            </label>
            <label>
              <span>Item Name</span>
              <input
                required
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
              />
            </label>
            <label>
              <span>Fabric Group</span>
              <input
                required
                value={form.fabricGroup}
                onChange={(e) =>
                  setForm({ ...form, fabricGroup: e.target.value })
                }
              />
            </label>
          </div>
          <Section
            title="Size-wise Measurements"
            add={() => setForm({ ...form, sizes: [...form.sizes, size()] })}
          >
            <table>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Dia</th>
                  <th>Cutting Piece KG</th>
                  <th>Folding Piece KG</th>
                  <th>Elastic MTR</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.sizes.map((row, index) => (
                  <tr key={index}>
                    {Object.keys(size()).map((key) => (
                      <td key={key}>
                        <input
                          required={["size", "dia"].includes(key)}
                          type={
                            ["size", "dia"].includes(key) ? "text" : "number"
                          }
                          step="0.001"
                          value={row[key]}
                          onChange={(e) =>
                            updateList("sizes", index, key, e.target.value)
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            sizes: form.sizes.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <X />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section
            title="Elastic Size Range"
            add={() =>
              setForm({
                ...form,
                elasticRanges: [...form.elasticRanges, range()],
              })
            }
          >
            <table>
              <thead>
                <tr>
                  <th>From Size</th>
                  <th>To Size</th>
                  <th>Elastic Type</th>
                  <th>Cutting Type</th>
                  <th>Measurement</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.elasticRanges.map((row, index) => (
                  <tr key={index}>
                    {Object.keys(range()).map((key) => (
                      <td key={key}>
                        <input
                          type={key === "measurementMtr" ? "number" : "text"}
                          step="0.001"
                          value={row[key]}
                          onChange={(e) =>
                            updateList(
                              "elasticRanges",
                              index,
                              key,
                              e.target.value,
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            elasticRanges: form.elasticRanges.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        <X />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section
            title="Accessories"
            add={() =>
              setForm({
                ...form,
                accessories: [...form.accessories, accessory("")],
              })
            }
          >
            <table>
              <thead>
                <tr>
                  <th>Accessory</th>
                  <th>Required</th>
                  <th>Type</th>
                  <th>Per Piece</th>
                  <th>Unit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.accessories.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        value={row.name}
                        onChange={(e) =>
                          updateList(
                            "accessories",
                            index,
                            "name",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.required}
                        onChange={(e) =>
                          updateList(
                            "accessories",
                            index,
                            "required",
                            e.target.checked,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={row.type}
                        onChange={(e) =>
                          updateList(
                            "accessories",
                            index,
                            "type",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={row.measurement}
                        onChange={(e) =>
                          updateList(
                            "accessories",
                            index,
                            "measurement",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={row.unit}
                        onChange={(e) =>
                          updateList(
                            "accessories",
                            index,
                            "unit",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            accessories: form.accessories.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        <X />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <button className="primary">
            <Save /> {form._id ? "Update" : "Save"} Item Master
          </button>
        </form>
      )}
      <div className="classic-card">
        <h3>Item Master List</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Fabric Group</th>
                <th>Sizes</th>
                <th>Accessories</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>{row.itemCode}</td>
                  <td>{row.itemName}</td>
                  <td>{row.fabricGroup}</td>
                  <td>{row.sizes.map((x) => x.size).join(", ")}</td>
                  <td>
                    {row.accessories
                      .filter((x) => x.required)
                      .map((x) => x.name)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${row.status?.toLowerCase()}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {canEdit && (
                        <button onClick={() => setForm(structuredClone(row))}>
                          <Edit3 />
                        </button>
                      )}
                      {admin && row.status === "PENDING_APPROVAL" && (
                        <button
                          onClick={async () => {
                            await api.approveItemMaster(row._id);
                            load();
                          }}
                        >
                          <Check />
                        </button>
                      )}
                      {admin && (
                        <button
                          className="danger"
                          onClick={async () => {
                            await api.deleteItemMaster(row._id);
                            load();
                          }}
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Section({ title, add, children }) {
  return (
    <div className="master-section">
      <div>
        <h3>{title}</h3>
        <button type="button" className="secondary" onClick={add}>
          <Plus /> Add Row
        </button>
      </div>
      <div className="table-wrap">{children}</div>
    </div>
  );
}
