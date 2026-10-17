import {request} from "./axiosInstance.js";
export const getCheckingOverview=()=>request("/erp/departments/checking-overview");
export const saveCheckingInspection=(body)=>request("/erp/departments/check",{
 method:"POST",body:JSON.stringify(body)
});
export const advanceCheckingStage=(body)=>request("/erp/departments/advance",{
 method:"POST",body:JSON.stringify(body)
});
export const requestQualityHold=(body)=>request("/erp/departments/checking-hold-requests",{
 method:"POST",body:JSON.stringify(body)
});
