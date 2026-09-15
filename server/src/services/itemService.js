import ApiError from "../utils/ApiError.js";
import { itemRepository } from "../repositories/itemRepository.js";

export const itemService = {
  getItems: () => itemRepository.findAll(),

  getItemByCode: async (itemCode) => {
    const item = await itemRepository.findByCode(itemCode);
    if (!item) throw new ApiError(404, "Item code not found");
    return item;
  },

  getItemByCodeAndColour: async (itemCode, colour) => {
    if (!itemCode?.trim() || !colour?.trim()) {
      throw new ApiError(400, "Item Code and Colour are required");
    }
    const item = await itemRepository.findByCodeAndColour(itemCode, colour);
    if (!item) throw new ApiError(404, "Item colour variant not found");
    return item;
  },

  createItem: (itemData) => itemRepository.create(itemData),

  updateItem: async (itemId, itemData) => {
    const item = await itemRepository.update(itemId, itemData);
    if (!item) throw new ApiError(404, "Item not found");
    return item;
  },

  deleteItem: async (itemId) => {
    const item = await itemRepository.remove(itemId);
    if (!item) throw new ApiError(404, "Item not found");
  },
};
