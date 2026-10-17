import {request} from "./axiosInstance.js";
export const getStitchingOverview=()=>request("/erp/departments/stitching-overview");
