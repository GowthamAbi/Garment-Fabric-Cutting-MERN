import { useEffect, useState } from "react";
import { api, exportCsv } from "../../api.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

export default function StockPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadItems() {
      setLoading(true);
      try {
        setItems(await api("/items/stock-lots"));
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, []);

  const filteredItems = items.filter((item) => {
    const searchableText = `${item.poNo} ${item.indentNo} ${item.inwardNo} ${item.itemCode} ${item.description}`;
    return searchableText.toLowerCase().includes(search.toLowerCase());
  });

  const columns = [
    { key: "poNo", label: "PO no." },
    { key: "indentNo", label: "Indent no." },
    { key: "inwardNo", label: "Inward no." },
    { key: "itemCode", label: "Item code" },
    { key: "description", label: "Description" },
    { key: "brand", label: "Brand" },
    { key: "type", label: "Type" },
    { key: "colour", label: "Colour" },
    { key: "stockQty", label: "Balance" },
    { key: "unit", label: "Unit" },
  ];

  const action = (
    <div className="actions">
      <input
        placeholder="Search stock..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <button onClick={() => exportCsv("stock.csv", filteredItems)}>
        Export CSV
      </button>
    </div>
  );

  return (
    <>
      <PageTitle
        title="Current stock"
        subtitle="Inward minus outward balance"
        action={action}
      />
      <Card>
        <DataTable columns={columns} rows={filteredItems} loading={loading} />
      </Card>
    </>
  );
}
