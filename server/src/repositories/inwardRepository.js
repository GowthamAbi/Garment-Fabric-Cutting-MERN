import Inward from "../models/Inward.js";
export const inwardRepository = {
  findAll: () => Inward.find().sort({ inwardDate: -1 }),
  findByNumber: (inwardNo) => Inward.findOne({ inwardNo }),
  create: (data) => Inward.create(data),
};
