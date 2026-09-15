import bcrypt from "bcryptjs";
import User from "../models/User.js";
export const findUserByEmail = (email) =>
  User.findOne({ email: email.toLowerCase() });
export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) =>
  bcrypt.compare(password, hash);
