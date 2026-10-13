import {DepartmentBundle} from "../erp/departmentModels.js";
import {ErpBalance,ErpSku} from "../erp/models.js";
import {DEPARTMENTS} from "../../../shared/departmentCatalogue.js";
import {enabledDepartment,allowedDepartment} from "../erp/departmentPolicy.js";
import {getTenant,runWithTenant} from "../utils/tenantContext.js";
import {hasPermission,strictAccess} from "../utils/accessPolicy.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import Item from "../models/Item.js";
import Inward from "../models/Inward.js";
import Outward from "../models/Outward.js";
import FabricInwardLot from "../models/FabricInwardLot.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import FabricCutActual from "../models/FabricCutActual.js";
import GarmentItemMaster from "../models/GarmentItemMaster.js";
import ProductionJob from "../models/ProductionJob.js";

const departments=DEPARTMENTS;

export async function getCompanyAdminOverview(request, response) {
  if(request.user.accessScope==='COMPANY'&&getTenant().factoryId)return runWithTenant({...getTenant(),factoryId:undefined},()=>getCompanyAdminOverview(request,response));
  const company = await Company.findById(request.user.companyId).lean();
  const [
    users,
    timeline,
    itemStock,
    fabricInwards,
    cuttingPlans,
    cuttingActuals,
    pendingApprovals,
    accessoryInwards,
    accessoryOutwards,
    jobs,
  ] = await Promise.all([
    User.find({ companyId: request.user.companyId })
      .select("name role department active")
      .lean(),
    AuditLog.find({ companyId: request.user.companyId })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean(),
    Item.aggregate([
      ...(getTenant().factoryId?[{$match:{factoryId:getTenant().factoryId}}]:[]),
      {
        $group: {
          _id: null,
          stock: { $sum: "$stockQty" },
          entries: { $sum: 1 },
        },
      },
    ]),
    FabricInwardLot.countDocuments(),
    FabricCutPlan.countDocuments(),
    FabricCutActual.countDocuments(),
    GarmentItemMaster.countDocuments({
      status: "PENDING_APPROVAL",
      ...(request.user.role === "admin"
        ? { approvalLevel: "ADMIN" }
        : { approvalLevel: { $in: ["COMPANY_ADMIN", null] } }),
    }),
    Inward.countDocuments(),
    Outward.countDocuments(),
    ProductionJob.countDocuments(),
  ]);

  const activityFor = (department) =>
    timeline.filter((row) =>
      `${row.path || ""} ${row.entity || ""}`
        .toUpperCase()
        .includes(department),
    ).length;

  const summary = {
    FABRIC: { entries: fabricInwards, status: "Live" },
    CUTTING: { entries: cuttingPlans + cuttingActuals, status: "Live" },
    ACCESSORIES: {
      entries: accessoryInwards + accessoryOutwards,
      status: "Live",
    },
    ELASTIC: { entries: jobs, status: "Live" },
    STITCHING: { entries: 0, status: "Ready" },
    FINISHING: { entries: 0, status: "Ready" },
    PACKING: { entries: 0, status: "Ready" },
    DISPATCH: { entries: 0, status: "Ready" },
  };

  const factoryFilter=getTenant().factoryId?{factoryId:getTenant().factoryId}:{};
  const [productionWip,balances,skus]=await Promise.all([DepartmentBundle.aggregate([{$match:{...factoryFilter,qty:{$gt:0}}},{$group:{_id:'$stage',pieces:{$sum:'$qty'},bundles:{$sum:1}}},{$limit:1000}]),ErpBalance.find({qty:{$gt:0}}).limit(10000).lean(),ErpSku.find().limit(10000).lean()]);
  const skuUnits=new Map(skus.map(s=>[String(s.factoryId)+'/'+s.code,s.unit])),unitTotals=new Map();for(const b of balances){const unit=skuUnits.get(String(b.factoryId)+'/'+b.sku)||'UNCLASSIFIED';unitTotals.set(unit,(unitTotals.get(unit)||0)+b.qty);}
  response.json({
    company:company&&{...company,factories:request.user.role==='support_viewer'?company.factories.filter(f=>String(f._id)===String(request.user.factoryId)):request.user.role==='company_owner'||request.user.accessScope==='COMPANY'||!strictAccess(request.user)?company.factories:company.factories.filter(f=>request.user.assignedFactoryIds?.map(String).includes(String(f._id)))},
    reportingLimited:balances.length===10000||skus.length===10000||productionWip.length===1000,productionWip,stockByUnit:[...unitTotals].map(([unit,quantity])=>({unit,quantity:quantity/1000})),
    counts: {
      users: users.filter((user) => user.active).length,
      stock: itemStock[0]?.stock || 0,
      pendingApprovals,
      timeline: timeline.length,
    },
    departments: departments.filter(d=>enabledDepartment(company,d)).map((name) => ({
      name,
      entries:summary[name]?.entries ?? null,
      status:allowedDepartment(request.user,name,false)?"Configured":"Permission required",
      canOpen:allowedDepartment(request.user,name,false),
      users: users.filter((user) => user.department === name).length,
      activity: activityFor(name),
    })),
    approvals: await GarmentItemMaster.find({
      status: "PENDING_APPROVAL",
      ...(request.user.role === "admin"
        ? { approvalLevel: "ADMIN" }
        : { approvalLevel: { $in: ["COMPANY_ADMIN", null] } }),
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean(),
    timeline:request.user.role==='support_viewer'?[]:strictAccess(request.user)&&!hasPermission(request.user,"audit.read")?[]:timeline,
    subscription: {
      plan: company?.subscriptionPlan,
      status: company?.subscriptionStatus,
      startsAt: company?.subscriptionStartsAt,
      endsAt: company?.subscriptionEndsAt,
      activeUsers: users.filter((user) => user.active).length,
      factories: company?.factories?.length || 0,
    },
  });
}
