import { request } from "./axiosInstance.js";
export const getPurchaseOrders = (pending = false) =>
  request(`/pos${pending ? "?pending=true" : ""}`);
export const createPurchaseOrder = (data) =>
  request("/pos", { method: "POST", body: JSON.stringify(data) });
export const updatePurchaseOrder = (id, data) =>
  request(`/pos/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deletePurchaseOrder = (id) =>
  request(`/pos/${id}`, { method: "DELETE" });
