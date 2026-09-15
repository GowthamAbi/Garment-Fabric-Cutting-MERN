import { useEffect, useState } from "react";
import { Edit3, Save, Search, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { fabricCuttingApi as api } from "../../api/fabricCuttingApi.js";

const blankFabric = {
  fabricCode: "",
  fabricName: "",
  fabricGroup: "",
  companyName: "",
  companyType: "",
};
const blankProcess = { processType: "COMPACTING", code: "", name: "" };

export default function FabricMasterPage({ notify }) {
  const { user } = useAuth();
  const canManage = ["saas_super_admin", "company_admin", "admin"].includes(
    user?.role,
  );
  const canDelete = ["saas_super_admin", "company_admin", "admin"].includes(
    user?.role,
  );
  const [rows, setRows] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blankFabric);
  const [process, setProcess] = useState(blankProcess);

  async function load() {
    const [fabricRows, processRows] = await Promise.all([
      api.masters({ search }),
      api.processes(),
    ]);
    setRows(fabricRows);
    setProcesses(processRows);
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(event) {
    event.preventDefault();
    form._id
      ? await api.updateMaster(form._id, form)
      : await api.saveMaster(form);
    setForm(blankFabric);
    notify?.("Fabric master saved");
    load();
  }

  async function submitProcess(event) {
    event.preventDefault();
    await api.saveProcess(process, process._id);
    setProcess(blankProcess);
    notify?.("Code and name mapping saved");
    load();
  }

  return (
    <section className="classic-page">
      <div className="classic-title">
        <div>
          <small>MASTER CONTROL</small>
          <h2>Fabric & Process Masters</h2>
          <p>Codes always resolve to their approved names.</p>
        </div>
      </div>
      {canManage && (
        <div className="classic-two-column">
          <form className="classic-card" onSubmit={submit}>
            <h3>Fabric Master</h3>
            <div className="form-grid">
              {Object.keys(blankFabric).map((key) => (
                <label key={key}>
                  <span>{label(key)}</span>
                  <input
                    required={[
                      "fabricCode",
                      "fabricName",
                      "fabricGroup",
                    ].includes(key)}
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <button className="primary">
              <Save /> {form._id ? "Update" : "Save"} Fabric
            </button>
          </form>
          <form className="classic-card" onSubmit={submitProcess}>
            <h3>Compacting / Dyeing Code Master</h3>
            <div className="form-grid">
              <label>
                <span>Process</span>
                <select
                  value={process.processType}
                  onChange={(e) =>
                    setProcess({ ...process, processType: e.target.value })
                  }
                >
                  <option>COMPACTING</option>
                  <option>DYEING</option>
                </select>
              </label>
              <label>
                <span>Code</span>
                <input
                  required
                  value={process.code}
                  onChange={(e) =>
                    setProcess({ ...process, code: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Name</span>
                <input
                  required
                  value={process.name}
                  onChange={(e) =>
                    setProcess({ ...process, name: e.target.value })
                  }
                />
              </label>
            </div>
            <button className="primary">
              <Save /> Save Mapping
            </button>
          </form>
        </div>
      )}
      <div className="classic-card">
        <div className="table-toolbar">
          <h3>Fabric List</h3>
          <div>
            <input
              placeholder="Search fabric"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={load}>
              <Search />
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Fabric Name</th>
                <th>Group</th>
                <th>Company</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>{row.fabricCode}</td>
                  <td>{row.fabricName}</td>
                  <td>{row.fabricGroup}</td>
                  <td>{row.companyName || "—"}</td>
                  <td>{row.companyType || "—"}</td>
                  <td>
                    <div className="row-actions">
                      {canManage && (
                        <button onClick={() => setForm(row)}>
                          <Edit3 />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="danger"
                          onClick={async () => {
                            await api.deleteMaster(row._id);
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
      <div className="classic-card">
        <h3>Code → Name Directory</h3>
        <div className="master-chip-grid">
          {processes.map((row) => (
            <button key={row._id} onClick={() => canManage && setProcess(row)}>
              <small>{row.processType}</small>
              <b>{row.code}</b>
              <span>{row.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function label(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
