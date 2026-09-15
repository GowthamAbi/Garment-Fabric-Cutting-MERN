import Supplier from "../models/Supplier.js";
export const getSuppliers = async (_req, res) =>
  res.json(await Supplier.find().sort({ name: 1 }));
export const createSupplier = async (req, res) =>
  res.status(201).json(await Supplier.create(req.body));
export const deleteSupplier = async (req, res) => {
  await Supplier.findByIdAndDelete(req.params.id);
  res.json({ message: "Supplier deleted" });
};
