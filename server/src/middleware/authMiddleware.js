import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import { tenantContext } from "../utils/tenantContext.js";
import User from "../models/User.js";

const SESSION_COOKIE_NAMES = ["__Host-ug_session", "ug_session"];

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function readSessionToken(request) {
  for (const name of SESSION_COOKIE_NAMES) {
    const token = readCookie(request, name);
    if (token) return token;
  }

  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function requireAuth(request, _response, next) {
  const token = readSessionToken(request);

  if (!token) {
    return next(new ApiError(401, "Please login to continue"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "ug-saas-api",
      audience: "ug-saas-web",
    });
    const activeUser = await User.findById(payload.id)
      .select("+sessionVersion active role companyId factoryId")
      .lean();

    if (!activeUser?.active) {
      throw new Error("Inactive session");
    }

    if (
      Number(activeUser.sessionVersion || 0) !==
      Number(payload.sessionVersion || 0)
    ) {
      throw new Error("Revoked session");
    }

    request.user = {
      ...payload,
      role: activeUser.role,
      companyId: activeUser.companyId,
      factoryId: activeUser.factoryId,
    };
    tenantContext.run(request.user, next);
  } catch {
    next(new ApiError(401, "Your login is invalid or expired"));
  }
}
