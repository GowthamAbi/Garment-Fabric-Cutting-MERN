import {request} from "./axiosInstance.js";
export const getInwardOverview=()=>request("/erp/departments/inward-overview");
export const advanceInwardBundle=(data)=>request("/erp/departments/advance",{
 method:"POST",body:JSON.stringify(data)
});
export const createInwardDiscrepancy=(data)=>request("/erp/departments/inward-discrepancies",{
 method:"POST",body:JSON.stringify(data)
});
