import {request} from "./axiosInstance.js";
export const getDispatchOverview=()=>request("/erp/departments/dispatch-overview");
export const transferDispatchCarton=body=>request("/erp/departments/transfer",{method:"POST",body:JSON.stringify(body)});
export const createDispatchPlan=body=>request("/erp/departments/dispatch-schedules",{method:"POST",body:JSON.stringify(body)});
export const createDispatchException=body=>request("/erp/departments/dispatch-exception-requests",{method:"POST",body:JSON.stringify(body)});
