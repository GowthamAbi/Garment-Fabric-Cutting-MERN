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
  plan: (number) => api("/fabric-cutting/plans/" + encodeURIComponent(number)),
  savePlan: (data) =>
    api("/fabric-cutting/plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
