import {request} from "./axiosInstance.js";
const base="/erp/departments/hr";
const post=(p,body)=>request(base+p,{method:"POST",body:JSON.stringify(body)});
export const getHrOverview=(period)=>request(base+"/overview?"+new URLSearchParams({period}));
export const hrCreateEmployee=body=>post("/employees",body);
export const hrRecordAttendance=body=>post("/attendance",body);
export const hrCreateRecord=body=>post("/records",body);
