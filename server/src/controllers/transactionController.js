import { createInward, createOutward } from "../services/stockService.js";
import { transactionRepository } from "../repositories/transactionRepository.js";
import Transaction from "../models/Transaction.js";
import Item from "../models/Item.js";
import Inward from "../models/Inward.js";
import Outward from "../models/Outward.js";
import ApiError from "../utils/ApiError.js";

function exactText(value) {
  return new RegExp(
    `^${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    "i",
  );
}

/**
 * Older public QR outward records were saved without tenant IDs. Recover only
 * rows whose source inward belongs to the currently logged-in company/factory.
 */
async function recoverLegacyQrOutwards(filter, request) {
  if (!request.user?.companyId) return [];

  const candidates = await Transaction.collection
    .find({ ...filter, companyId: { $exists: false } })
    .toArray();

  if (!candidates.length) return [];

  const inwardNumbers = [
    ...new Set(candidates.map((row) => row.inwardReference).filter(Boolean)),
  ];
  const ownedInwards = await Inward.find({
    inwardNo: { $in: inwardNumbers },
  }).lean();
  const inwardMap = new Map(
    ownedInwards.map((inward) => [inward.inwardNo, inward]),
  );
  const recovered = [];

  for (const row of candidates) {
    const inward = inwardMap.get(row.inwardReference);
    if (!inward) continue;

    const tenantFields = {
      companyId: inward.companyId,
      factoryId: inward.factoryId,
      colour: row.colour || inward.colour || "",
      updatedBy: request.user.name || "Tenant recovery",
    };

    await Transaction.collection.updateOne(
      { _id: row._id },
      { $set: tenantFields },
    );
    await Outward.collection.updateOne(
      { outwardNo: row.referenceNo, companyId: { $exists: false } },
      { $set: tenantFields },
    );
    recovered.push({ ...row, ...tenantFields });
  }

  return recovered;
}

export async function getTransactions(request, response) {
  const filter = {};

  if (request.query.kind) filter.kind = request.query.kind;
  if (request.query.itemCode) {
    filter.itemCode = request.query.itemCode.toUpperCase();
  }

  if (request.query.from || request.query.to) {
    filter.transactionDate = {
      ...(request.query.from && { $gte: new Date(request.query.from) }),
      ...(request.query.to && { $lte: new Date(request.query.to) }),
    };
  }

  response.json(await transactionRepository.findAll(filter));
}

export async function saveInward(request, response) {
  response.status(201).json(await createInward(request.body));
}

export async function saveOutward(request, response) {
  response.status(201).json(await createOutward(request.body));
}

export async function getTransactionByReference(request, response) {
  const referenceNo = request.params.referenceNo.toUpperCase();
  let transaction = await Transaction.findOne({ referenceNo }).lean();
  if (!transaction) {
    [transaction] = await recoverLegacyQrOutwards(
      { referenceNo: exactText(referenceNo), kind: "OUTWARD" },
      request,
    );
  }
  if (!transaction) {
    throw new ApiError(404, "Inward or outward number not found");
  }

  const item = await Item.findOne({ itemCode: transaction.itemCode }).lean();
  response.json({
    ...transaction,
    itemName: transaction.itemName || item?.description || transaction.itemCode,
    description: item?.description || "",
    brand: item?.brand || "",
    type: item?.type || "",
    colour: transaction.colour || item?.colour || "",
    unit: item?.unit || "",
  });
}

export async function getOutwardsByDcNo(request, response) {
  const dcNo = request.params.dcNo.trim();
  let transactions = await Transaction.find({
    kind: "OUTWARD",
    dcNo: {
      $regex: `^${dcNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  })
    .sort({ transactionDate: 1 })
    .lean();

  if (!transactions.length) {
    transactions = await recoverLegacyQrOutwards(
      { kind: "OUTWARD", dcNo: exactText(dcNo) },
      request,
    );
    transactions.sort(
      (left, right) => new Date(left.transactionDate) - new Date(right.transactionDate),
    );
  }

  if (!transactions.length) {
    throw new ApiError(404, "No outward entries found for this DC number");
  }

  const itemCodes = [...new Set(transactions.map((entry) => entry.itemCode))];
  const items = await Item.find({ itemCode: { $in: itemCodes } }).lean();
  const itemMap = new Map(items.map((item) => [item.itemCode, item]));

  const entries = transactions.map((entry, index) => {
    const item = itemMap.get(entry.itemCode);
    return {
      ...entry,
      serialNo: index + 1,
      description: item?.description || entry.itemCode,
      itemName: entry.itemName || item?.description || entry.itemCode,
      colour: entry.colour || item?.colour || "",
      unit: item?.unit || "",
    };
  });

  response.json({
    dcNo: transactions[0].dcNo,
    date: transactions[0].transactionDate,
    descriptions: [...new Set(entries.map((entry) => entry.description))],
    itemNames: [...new Set(entries.map((entry) => entry.itemName))],
    sectionNames: [
      ...new Set(entries.map((entry) => entry.section).filter(Boolean)),
    ],
    totalQuantity: entries.reduce((total, entry) => total + entry.quantity, 0),
    entries,
  });
}
