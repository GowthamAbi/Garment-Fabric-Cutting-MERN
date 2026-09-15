import { itemService } from "../services/itemService.js";
import Inward from "../models/Inward.js";

export async function getItems(_request, response) {
  response.json(await itemService.getItems());
}

export async function getStockLots(_request, response) {
  const inwards = await Inward.find({ balanceQty: { $gt: 0 } })
    .sort({ inwardDate: -1 })
    .lean();
  response.json(
    inwards.map((inward) => {
      return {
        _id: inward._id,
        inwardNo: inward.inwardNo,
        poNo: inward.poNo || "",
        indentNo: inward.indentNo || "",
        itemCode: inward.itemCode,
        description: inward.description || inward.itemCode,
        brand: inward.brand || "",
        type: inward.type || "",
        colour: inward.colour || "",
        stockQty: inward.balanceQty,
        unit: inward.unit || "MTR",
        inwardDate: inward.inwardDate,
      };
    }),
  );
}

export async function getItemByCode(request, response) {
  response.json(await itemService.getItemByCode(request.params.itemCode));
}

export async function getItemByCodeAndColour(request, response) {
  response.json(
    await itemService.getItemByCodeAndColour(
      request.query.itemCode,
      request.query.colour,
    ),
  );
}

export async function createItem(request, response) {
  response.status(201).json(await itemService.createItem(request.body));
}

export async function updateItem(request, response) {
  response.json(
    await itemService.updateItem(request.params.itemId, request.body),
  );
}

export async function deleteItem(request, response) {
  await itemService.deleteItem(request.params.itemId);
  response.json({ message: "Item deleted successfully" });
}
