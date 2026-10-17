import {request} from "./axiosInstance.js";
export const getPackingOverview=()=>request("/erp/departments/packing-overview");
export const savePackingCarton=body=>request("/erp/departments/pack",{
 method:"POST",body:JSON.stringify(body)
});
export const savePackingPlan=body=>request("/erp/departments/packing-plans",{
 method:"POST",body:JSON.stringify(body)
});
export const saveRepackingRequest=body=>request("/erp/departments/packing-repack-requests",{
 method:"POST",body:JSON.stringify(body)
});
