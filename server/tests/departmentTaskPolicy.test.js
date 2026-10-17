import test from "node:test";
import assert from "node:assert/strict";
import {taskDepartmentFor,mayAssignTask,mayUpdateAssignedTask,validTaskTransition,validateTaskInput,TASK_STATUSES} from "../src/erp/departmentTaskPolicy.js";

const staff={id:"111",role:"department_entry",department:"FABRIC",accessScope:"DEPARTMENT",accessPolicyVersion:1,permissions:["department.fabric.read","department.fabric.write"]};
const head={...staff,id:"112",role:"department_incharge",permissions:["department.fabric.read","approval.head.fabric"]};
const manager={role:"management",department:"",accessScope:"LOCATION",accessPolicyVersion:1,factoryId:"fac1",assignedFactoryIds:["fac1"],permissions:["erp.read","users.manage"]};
const owner={id:"manager",role:"company_owner",permissions:[]};

test("staff and head only access their own licensed department",()=>{
 assert.equal(taskDepartmentFor(staff,"FABRIC"),"FABRIC");
 assert.equal(taskDepartmentFor(staff,"CUTTING"),null);
 assert.equal(taskDepartmentFor(head,"CUTTING"),null);
 assert.equal(taskDepartmentFor({...staff,permissions:[]},"FABRIC"),null);
 assert.equal(taskDepartmentFor({...staff,accessScope:"SELF"},"FABRIC"),null);
 assert.equal(taskDepartmentFor({...staff,role:"saas_super_admin"},"FABRIC"),null);
 assert.equal(taskDepartmentFor(staff,"HR"),null);
 assert.equal(taskDepartmentFor(staff,"DESPATCH"),null);
});
test("managers may assign but heads and staff cannot",()=>{
 assert.equal(mayAssignTask(owner,"FABRIC"),true);
 assert.equal(mayAssignTask(manager,"FABRIC"),true);
 assert.equal(mayAssignTask({...manager,assignedFactoryIds:["different"]},"FABRIC"),false);
 assert.equal(mayAssignTask(head,"FABRIC"),false);
 assert.equal(mayAssignTask(staff,"FABRIC"),false);
 assert.equal(mayAssignTask({...manager,permissions:["erp.read"]},"FABRIC"),false);
});
test("only selected department staff can change assigned task status",()=>{
 const task={department:"FABRIC",assigneeId:"111",status:"PENDING"};
 assert.equal(mayUpdateAssignedTask(staff,task),true);
 assert.equal(mayUpdateAssignedTask(head,task),false);
 assert.equal(mayUpdateAssignedTask(owner,task),false);
 assert.equal(mayUpdateAssignedTask({...staff,id:"someone_else"},task),false);
 assert.equal(mayUpdateAssignedTask(staff,{...task,department:"CUTTING"}),false);
 assert.equal(mayUpdateAssignedTask({...staff,permissions:["department.fabric.read"]},task),false);
});
test("status updates cannot reopen completed tasks or skip backwards",()=>{
 assert.deepEqual(TASK_STATUSES,["PENDING","IN_PROGRESS","DONE"]);
 assert.equal(validTaskTransition("PENDING","IN_PROGRESS"),true);
 assert.equal(validTaskTransition("PENDING","DONE"),true);
 assert.equal(validTaskTransition("IN_PROGRESS","DONE"),true);
 assert.equal(validTaskTransition("DONE","PENDING"),false);
 assert.equal(validTaskTransition("DONE","DONE"),false);
 assert.equal(validTaskTransition("IN_PROGRESS","PENDING"),false);
});
test("task creation validates priority, title, reference, and date",()=>{
 assert.deepEqual(validateTaskInput({title:" Review DC ",reference:" 222 ",priority:"HIGH",dueAt:"2026-10-20"}),{
 title:"Review DC",notes:"",reference:"222",priority:"HIGH",dueAt:new Date("2026-10-20")
 });
 assert.equal(validateTaskInput({title:""}),null);
 assert.equal(validateTaskInput({title:"x".repeat(161)}),null);
 assert.equal(validateTaskInput({title:"Hello",notes:"x".repeat(1001)}),null);
 assert.equal(validateTaskInput({title:"Hello",priority:"DELETE_STOCK"}),null);
 assert.equal(validateTaskInput({title:"Hello",dueAt:"not-a-date"}),null);
});
