import PageTitle from "../../components/common/PageTitle.jsx";
export default function StockDetailsPage({ item }) {
  return (
    <>
      <PageTitle
        title={item?.description || "Stock details"}
        subtitle={item?.itemCode || "Select an item"}
      />
      <pre className="card">{JSON.stringify(item, null, 2)}</pre>
    </>
  );
}
