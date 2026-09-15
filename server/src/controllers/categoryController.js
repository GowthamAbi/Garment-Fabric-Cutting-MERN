import Category from "../models/Category.js";
export const getCategories = async (_req, res) =>
  res.json(await Category.find().sort({ name: 1 }));
export const createCategory = async (req, res) =>
  res.status(201).json(await Category.create(req.body));
export const deleteCategory = async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ message: "Category deleted" });
};
