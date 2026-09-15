import { formatDate } from "../../utils/dateFormatter.js";
export default function PODeliveryAlert({ orders }) {
  return orders.map((order) => (
    <div className="alert" key={order._id}>
      <div>
        <b>{order.poNo}</b>
        <small>{order.itemCode}</small>
      </div>
      <span>{formatDate(order.deliveryDate)}</span>
    </div>
  ));
}
