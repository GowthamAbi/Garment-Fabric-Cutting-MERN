const requiredVariables = ["MONGODB_URI", "JWT_SECRET"];

export function validateEnvironment() {
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
