import crypto from "node:crypto";
import User from "../models/User.js";

const DEPARTMENT_CODES = {
  FABRIC: "FAB", CUTTING: "CUT", ACCESSORIES: "ACC", ELASTIC: "ELA",
  STITCHING: "STI", FINISHING: "FIN", PACKING: "PAC", DISPATCH: "DIS",
  DELIVERY: "DEL", MANAGEMENT: "MGT", PLATFORM: "OWN",
};

function nameCode(name) {
  const letters = String(name || "USR").replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters || "USR").slice(0, 3).padEnd(3, "X");
}

export async function generateUserId({ name, department, role }) {
  const departmentCode = role === "saas_super_admin"
    ? "OWN"
    : DEPARTMENT_CODES[String(department || "").toUpperCase()] || "USR";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = crypto.randomInt(1000, 10000);
    const userId = `UGS-${departmentCode}-${nameCode(name)}-${suffix}`;
    if (!(await User.exists({ userId }))) return userId;
  }
  throw new Error("Unable to generate a unique User ID");
}

