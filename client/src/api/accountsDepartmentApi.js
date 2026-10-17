import {request} from "./axiosInstance.js";
const base="/erp/departments/accounts";
export const getAccountsOverview=(days=30)=>request(base+"/overview?"+new URLSearchParams({days}));
export const postAccountsDocument=(body,key)=>request(base+"/post",{
 method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify(body)});
