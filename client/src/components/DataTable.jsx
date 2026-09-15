import { useMemo, useState } from "react";

export default function DataTable({
  columns,
  rows,
  onEdit,
  onDelete,
  empty = "No records found",
  loading = false,
}) {
  const [columnFilters, setColumnFilters] = useState({});
  const [openFilter, setOpenFilter] = useState("");
  const valueFor = (row, column) =>
    typeof column.filterValue === "function"
      ? column.filterValue(row)
      : row[column.key];

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        columns.every((column) => {
          const filter = (columnFilters[column.key] || "").trim().toLowerCase();
          if (!filter) return true;
          return String(valueFor(row, column) ?? "").toLowerCase() === filter;
        }),
      ),
    [rows, columns, columnFilters],
  );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="filterable-heading">
                <button
                  type="button"
                  className={columnFilters[column.key] ? "active" : ""}
                  onClick={() => setOpenFilter((current) => current === column.key ? "" : column.key)}
                >
                  {column.label} <span>▼</span>
                </button>
                {openFilter === column.key && (
                  <select
                    autoFocus
                    value={columnFilters[column.key] || ""}
                    onChange={(event) => {
                      setColumnFilters((current) => ({ ...current, [column.key]: event.target.value }));
                      setOpenFilter("");
                    }}
                    onBlur={() => setOpenFilter("")}
                  >
                    <option value="">All</option>
                    {[...new Set(rows.map((row) => String(valueFor(row, column) ?? "")))]
                      .filter(Boolean)
                      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                      .map((value) => <option key={value} value={value.toLowerCase()}>{value}</option>)}
                  </select>
                )}
              </th>
            ))}
            {(onEdit || onDelete) && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                className="table-loading"
                colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
              >
                <span className="table-loading-spinner" />
                <b>Loading data...</b>
              </td>
            </tr>
          ) : filteredRows.length ? (
            filteredRows.map((row) => (
              <tr key={row._id || row.referenceNo || row.itemCode}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {typeof column.render === "function"
                      ? column.render(row)
                      : (row[column.key] ?? "—")}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="row-actions">
                    {onEdit && (
                      <button onClick={() => onEdit(row)}>Edit</button>
                    )}
                    {onDelete && (
                      <button className="danger" onClick={() => onDelete(row)}>
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td className="empty" colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
