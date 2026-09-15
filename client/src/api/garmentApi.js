import { api } from "../api.js";

const query = (params = {}) => {
  const value = new URLSearchParams(Object.entries(params).filter(([, item]) => item !== "" && item != null)).toString();
  return value ? `?${value}` : "";
};

export const garmentApi = {
  dashboard: () => api("/garments/dashboard"),
  boms: (filters) => api(`/garments/boms${query(filters)}`),
  saveBom: (data, id) => api(`/garments/boms${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(data) }),
  approveBom: (id, status) => api(`/garments/boms/${id}/approval`, { method: "PATCH", body: JSON.stringify({ status }) }),
  removeBom: (id) => api(`/garments/boms/${id}`, { method: "DELETE" }),
  pos: (filters) => api(`/garments/pos${query(filters)}`),
  savePo: (data) => api("/garments/pos", { method: "POST", body: JSON.stringify(data) }),
  uploadPos: (data) => api("/garments/pos/upload", { method: "POST", body: JSON.stringify(data) }),
  materialStatus: (filters) => api(`/garments/materials-status${query(filters)}`),
  movements: (filters) => api(`/garments/movements${query(filters)}`),
  saveMovement: (data) => api("/garments/movements", { method: "POST", body: JSON.stringify(data) }),
};
