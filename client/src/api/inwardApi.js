import { request } from "./axiosInstance.js";
export const createInward = (data) =>
  request("/transactions/inward", {
    method: "POST",
    body: JSON.stringify(data),
  });
