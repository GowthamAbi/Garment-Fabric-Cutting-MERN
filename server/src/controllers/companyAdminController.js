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

const departments = [
  "FABRIC",
  "CUTTING",
  "ACCESSORIES",
  "ELASTIC",
  "STITCHING",
  "FINISHING",
  "PACKING",
  "DISPATCH",
];

export async function getCompanyAdminOverview(request, response) {
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
    GarmentItemMaster.countDocuments({ status: "PENDING_APPROVAL" }),
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

  response.json({
    company,
    counts: {
      users: users.filter((user) => user.active).length,
      stock: itemStock[0]?.stock || 0,
      pendingApprovals,
      timeline: timeline.length,
    },
    departments: departments.map((name) => ({
      name,
      ...summary[name],
      users: users.filter((user) => user.department === name).length,
      activity: activityFor(name),
    })),
    approvals: await GarmentItemMaster.find({ status: "PENDING_APPROVAL" })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean(),
    timeline,
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
