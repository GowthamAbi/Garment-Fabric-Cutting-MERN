import PageTitle from "../../components/common/PageTitle.jsx";
export default function InwardDetailsPage({ inward }) {
  return (
    <>
      <PageTitle
        title="Inward details"
        subtitle={inward?.referenceNo || "Select an inward"}
      />
      <pre className="card">{JSON.stringify(inward, null, 2)}</pre>
    </>
  );
}
