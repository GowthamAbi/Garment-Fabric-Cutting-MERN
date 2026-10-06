const COMMON_PASSWORDS = new Set([
  "password", "password123", "password@123", "admin123", "admin@123", "welcome123",
  "qwerty123", "letmein123", "ugs@12345",
]);

export function validateStrongPassword(password, user = {}) {
  const value = String(password || "");
  const errors = [];
  if (value.length < 12) errors.push("at least 12 characters");
  if (!/[A-Z]/.test(value)) errors.push("one uppercase letter");
  if (!/[a-z]/.test(value)) errors.push("one lowercase letter");
  if (!/\d/.test(value)) errors.push("one number");
  if (!/[^A-Za-z0-9]/.test(value)) errors.push("one special character");
  if (/\s/.test(value)) errors.push("no spaces");
  if (COMMON_PASSWORDS.has(value.toLowerCase())) errors.push("a non-common password");
  const personal = [user.userId, user.name, user.email]
    .filter(Boolean)
    .flatMap((part) => String(part).toLowerCase().split(/[^a-z0-9]+/))
    .filter((part) => part.length >= 4);
  if (personal.some((part) => value.toLowerCase().includes(part)))
    errors.push("must not contain your name, User ID or email");
  return { valid: errors.length === 0, errors };
}

export function assertStrongPassword(password, user = {}) {
  const result = validateStrongPassword(password, user);
  if (!result.valid) {
    const error = new Error(`Password requires ${result.errors.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  return true;
}
