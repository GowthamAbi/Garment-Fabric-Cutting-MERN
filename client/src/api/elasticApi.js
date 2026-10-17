import {request} from "./axiosInstance.js";
const root="/erp/departments/elastic";
const post=(path,body)=>request(root+path,{
 method:"POST",headers:{"Idempotency-Key":crypto.randomUUID().replaceAll("-","")+"-elastic"},
 body:JSON.stringify(body)
});
export const elasticApi={
 overview:()=>request(root+"/overview"),
 material:data=>post("/materials",data),
 purchase:data=>post("/purchase",data),
 inward:data=>post("/inward",data),
 plan:data=>post("/plans",data),
 cut:data=>post("/cut",data),
 return:data=>post("/return",data),
 correction:data=>post("/corrections",data),
};
