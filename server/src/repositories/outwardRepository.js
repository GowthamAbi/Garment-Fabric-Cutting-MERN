import Outward from "../models/Outward.js";
export const outwardRepository = {
  findAll: () => Outward.find().sort({ outwardDate: -1 }),
  create: (data) => Outward.create(data),
};
