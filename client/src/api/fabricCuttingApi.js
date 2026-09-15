import { api } from "../api.js";

const query = (params = {}) => {
  const value = new URLSearchParams(
    Object.entries(params).filter(([, item]) => item !== "" && item != null),
  ).toString();
  return value ? "?" + value : "";
};

export const fabricCuttingApi = {
  masters: (params) => api("/fabric-cutting/masters" + query(params)),
  master: (code) => api("/fabric-cutting/masters/" + encodeURIComponent(code)),
  saveMaster: (data) =>
    api("/fabric-cutting/masters", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMaster: (id, data) =>
    api("/fabric-cutting/masters/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteMaster: (id) =>
    api("/fabric-cutting/masters/" + id, { method: "DELETE" }),
  processes: (type = "") =>
    api("/fabric-cutting/process-masters" + (type ? `?type=${type}` : "")),
  process: (type, code) =>
    api(`/fabric-cutting/process-masters/${type}/${encodeURIComponent(code)}`),
  saveProcess: (data, id) =>
    api("/fabric-cutting/process-masters" + (id ? "/" + id : ""), {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    }),
  itemMasters: (search = "") =>
    api(
      "/fabric-cutting/item-masters" +
        (search ? `?search=${encodeURIComponent(search)}` : ""),
    ),
  saveItemMaster: (data, id) =>
    api("/fabric-cutting/item-masters" + (id ? "/" + id : ""), {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    }),
  approveItemMaster: (id, status = "APPROVED") =>
    api(`/fabric-cutting/item-masters/${id}/approval`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteItemMaster: (id) =>
    api(`/fabric-cutting/item-masters/${id}`, { method: "DELETE" }),
  inwards: (params) => api("/fabric-cutting/inwards" + query(params)),
  inward: (number) =>
    api("/fabric-cutting/inwards/" + encodeURIComponent(number)),
  bundles: (number) =>
    api("/fabric-cutting/inwards/" + encodeURIComponent(number) + "/bundles"),
  saveInward: (data, id) =>
    api("/fabric-cutting/inwards" + (id ? "/" + id : ""), {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    }),
  plans: (params) => api("/fabric-cutting/plans" + query(params)),
  planSetup: (itemCode, excludePlanId = "") =>
    api(
      "/fabric-cutting/plans/setup/" +
        encodeURIComponent(itemCode) +
        (excludePlanId
          ? `?excludePlanId=${encodeURIComponent(excludePlanId)}`
          : ""),
    ),
  plan: (number) => api("/fabric-cutting/plans/" + encodeURIComponent(number)),
  savePlan: (data) =>
    api("/fabric-cutting/plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePlan: (id, data) =>
    api("/fabric-cutting/plans/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePlan: (id) => api("/fabric-cutting/plans/" + id, { method: "DELETE" }),
  fabricStock: () => api("/fabric-cutting/stock"),
  issue: (number, data) =>
    api("/fabric-cutting/plans/" + encodeURIComponent(number) + "/issue", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  actuals: (params) => api("/fabric-cutting/actuals" + query(params)),
  saveActual: (data) =>
    api("/fabric-cutting/actuals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  elastic: (number) =>
    api("/fabric-cutting/elastic/" + encodeURIComponent(number)),
  waste: () => api("/fabric-cutting/waste"),
};
