import {Router} from "express";
import mongoose from "mongoose";
import {asyncHandler} from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {workspaceFilter} from "./service.js";
import {enabledDepartment} from "./departmentPolicy.js";
import {taskDepartmentFor,mayAssignTask,mayUpdateAssignedTask,validTaskTransition,validateTaskInput,TASK_STATUSES} from "./departmentTaskPolicy.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import DepartmentTask from "../models/DepartmentTask.js";

const router=Router();
async function scopeFor(req,department){
 const code=taskDepartmentFor(req.user,department);
 if(!code)throw new ApiError(403,"Department task access denied");
 const scope=workspaceFilter();
 if(String(scope.companyId)!==String(req.user.companyId)||String(scope.factoryId)!==String(req.user.factoryId))
  throw new ApiError(403,"Task factory session mismatch");
 const company=await Company.findById(scope.companyId).select("enabledDepartments departmentCatalogueVersion entitlements active").lean();
 if(!company?.active||!enabledDepartment(company,code))throw new ApiError(403,"Department is not in the active company subscription");
 return {code,scope};
}
router.get("/assignees",asyncHandler(async(req,res)=>{
 const {code,scope}=await scopeFor(req,req.query.department);
 if(!mayAssignTask(req.user,code))throw new ApiError(403,"Task assignment permission required");
 const users=await User.find({...scope,role:"department_entry",department:code,active:true})
  .select("_id name userId permissions").sort({name:1}).limit(200).lean();
 res.json({department:code,items:users.filter(u=>(u.permissions||[]).includes("department."+code.toLowerCase()+".write")).map(u=>({id:String(u._id),name:u.name,userId:u.userId}))});
}));
router.get("/",asyncHandler(async(req,res)=>{
 const {code,scope}=await scopeFor(req,req.query.department);
 const filter={...scope,department:code};
 if(req.user.role==="department_entry")filter.assigneeId=req.user.id;
 const status=req.query.status;
 if(status&& !TASK_STATUSES.includes(status))throw new ApiError(400,"Invalid task status filter");
 if(status)filter.status=status;
 const rows=await DepartmentTask.find(filter).sort({createdAt:-1}).limit(200).lean();
 res.json({department:code,items:rows,limitedTo:200});
}));
router.post("/",asyncHandler(async(req,res)=>{
 const {code,scope}=await scopeFor(req,req.body?.department);
 if(!mayAssignTask(req.user,code))throw new ApiError(403,"Only an authorized manager may assign tasks");
 const fields=validateTaskInput(req.body);
 if(!fields||!mongoose.isValidObjectId(req.body?.assigneeId))throw new ApiError(400,"Valid task title, staff assignee, priority and due date required");
 const assignee=await User.findOne({_id:req.body.assigneeId,...scope,department:code,role:"department_entry",active:true}).select("name permissions").lean();
 if(!assignee||!(assignee.permissions||[]).includes("department."+code.toLowerCase()+".write"))
  throw new ApiError(400,"Select an active staff member with department entry permission");
 const task=await DepartmentTask.create({...scope,department:code,...fields,assigneeId:assignee._id,assigneeName:assignee.name,createdById:req.user.id,createdByName:req.user.name||req.user.userId,status:"PENDING"});
 res.status(201).json(task);
}));
router.patch("/:id/status",asyncHandler(async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))throw new ApiError(400,"Invalid task ID");
 const {code,scope}=await scopeFor(req,req.user.department);
 if(!TASK_STATUSES.includes(req.body?.status))throw new ApiError(400,"Invalid task status");
 const task=await DepartmentTask.findOne({...scope,_id:req.params.id,department:code}).lean();
 if(!task)throw new ApiError(404,"Task not found");
 if(!mayUpdateAssignedTask(req.user,task))throw new ApiError(403,"Only the assigned department staff may update this task");
 if(!validTaskTransition(task.status,req.body.status))throw new ApiError(409,"Task status transition is not allowed");
 const fields={status:req.body.status,lastUpdatedById:req.user.id};
 if(req.body.status==="IN_PROGRESS")fields.startedAt=new Date();
 if(req.body.status==="DONE"){fields.completedAt=new Date();if(!task.startedAt)fields.startedAt=new Date();}
 const updated=await DepartmentTask.findOneAndUpdate({...scope,_id:task._id,assigneeId:req.user.id,status:task.status},{$set:fields},{new:true,runValidators:true});
 if(!updated)throw new ApiError(409,"Task was changed by another user. Refresh and retry");
 res.json(updated);
}));
export default router;
