import Item from "../models/Item.js";

export const itemRepository = {
  findAll: () => Item.find().sort({ itemCode: 1 }),

  findByCode: (itemCode, session = null, colour = "") =>
    Item.findOne({
      itemCode: itemCode.toUpperCase(),
      ...(colour && { colour: colour.trim().toUpperCase() }),
    }).session(session),

  findByCodeAndColour: (itemCode, colour) =>
    Item.findOne({
      itemCode: itemCode.trim().toUpperCase(),
      colour: colour.trim().toUpperCase(),
    }),

  create: (itemData) => Item.create(itemData),

  update: (itemId, itemData) =>
    Item.findByIdAndUpdate(itemId, itemData, {
      new: true,
      runValidators: true,
    }),

  remove: (itemId) => Item.findByIdAndDelete(itemId),
};
