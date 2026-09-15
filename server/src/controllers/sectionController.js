import Section from "../models/Section.js";
export const getSections = async (_req, res) =>
  res.json(await Section.find().sort({ name: 1 }));
export const createSection = async (req, res) =>
  res.status(201).json(await Section.create(req.body));
export const deleteSection = async (req, res) => {
  await Section.findByIdAndDelete(req.params.id);
  res.json({ message: "Section deleted" });
};
