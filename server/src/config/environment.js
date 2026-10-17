import {validateStagingSafety} from "./stagingSafety.js";
const requiredVariables = ["MONGODB_URI", "JWT_SECRET"];

export function validateEnvironment() {
  validateStagingSafety(process.env);
  if (process.env.TENANT_CREDENTIAL_KEY && !/^[a-f0-9]{64}$/i.test(process.env.TENANT_CREDENTIAL_KEY)) throw new Error("TENANT_CREDENTIAL_KEY must be a 32-byte hexadecimal key");
  if (process.env.CUSTOMER_DB_MAX_CONNECTIONS && (!/^[1-9][0-9]{0,2}$/.test(process.env.CUSTOMER_DB_MAX_CONNECTIONS) || Number(process.env.CUSTOMER_DB_MAX_CONNECTIONS) > 500)) throw new Error("CUSTOMER_DB_MAX_CONNECTIONS must be an integer from 1 to 500");
  const missingVariables = requiredVariables.filter(
    (variableName) => !process.env[variableName],
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingVariables.join(", ")}`,
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    String(process.env.JWT_SECRET).length < 32
  ) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters in production",
    );
  }
}
