import { request } from "./axiosInstance.js";
export const getDashboard = () => request("/dashboard");
