import { request } from "./axiosInstance.js";

export const getPublicInward = (inwardNo) =>
  request(`/public/inwards/${encodeURIComponent(inwardNo)}`);

export const createPublicOutward = (data) =>
  request("/public/outwards", {
    method: "POST",
    body: JSON.stringify(data),
  });
