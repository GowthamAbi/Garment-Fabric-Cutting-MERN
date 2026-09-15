export default function MinimumStockAlert({ items }) {
  return items.map((item) => (
    <div className="alert" key={item._id}>
      <div>
        <b>{item.description}</b>
        <small>{item.itemCode}</small>
      </div>
      <span>
        {item.stockQty} / {item.minimumQty} {item.unit}
      </span>
    </div>
  ));
}
