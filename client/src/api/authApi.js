import { request } from "./axiosInstance.js";

export const loginUser = (credentials) =>
  request("/auth/login", { method: "POST", body: JSON.stringify(credentials) });

export const registerUser = (userData) =>
  request("/auth/register", { method: "POST", body: JSON.stringify(userData) });
