import { request } from "./axiosInstance.js";
export const getHistory = (filters = {}) => {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  );
  return request(`/transactions?${query}`);
};
