export default function CategoryStockChart({ categories = [] }) {
  return (
    <div className="category-chart">
      {categories.map((item) => (
        <div key={item.category}>
          <span>{item.category}</span>
          <progress
            value={item.quantity}
            max={Math.max(...categories.map((x) => x.quantity), 1)}
          />
        </div>
      ))}
    </div>
  );
}
