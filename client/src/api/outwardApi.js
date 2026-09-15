import { request } from "./axiosInstance.js";
export const createOutward = (data) =>
  request("/transactions/outward", {
    method: "POST",
    body: JSON.stringify(data),
  });
