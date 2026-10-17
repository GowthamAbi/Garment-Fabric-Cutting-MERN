import {request} from "./axiosInstance.js";

const prefix="/erp/departments/accessories";
const save=(route,body)=>request(prefix+route,{
  method:"POST",headers:{"Idempotency-Key":crypto.randomUUID().replaceAll("-","")+"-accessories"},
  body:JSON.stringify(body),
});
export const accessoriesApi={
  overview:()=>request(prefix+"/overview"),
  master:body=>save("/masters",body),
  purchase:body=>save("/purchase",body),
  receipt:body=>save("/receipt",body),
  issue:body=>save("/movement/issue",body),
  returnStock:body=>save("/movement/return",body),
  transfer:body=>save("/transfer",body),
  adjustment:body=>save("/adjustments",body),
};
