import {request} from "./axiosInstance.js";
export const getIroningOverview=()=>request("/erp/departments/ironing-overview");
export const saveIroningMovement=body=>request("/erp/departments/advance",{
 method:"POST",body:JSON.stringify(body)
});
export const saveIroningTarget=body=>request("/erp/departments/ironing-targets",{
 method:"POST",body:JSON.stringify(body)
});
export const saveIroningIssue=body=>request("/erp/departments/ironing-issue-requests",{
 method:"POST",body:JSON.stringify(body)
});
