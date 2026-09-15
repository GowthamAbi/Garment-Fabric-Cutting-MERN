import PageTitle from "../../components/common/PageTitle.jsx";
export default function CategoryMasterPage() {
  return (
    <>
      <PageTitle
        title="Category master"
        subtitle="Maintain yarn and accessories categories"
      />
      <div className="card empty">
        Add category CRUD using the shared master API pattern.
      </div>
    </>
  );
}
