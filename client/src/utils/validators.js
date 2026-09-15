export const required = (value) => String(value ?? "").trim().length > 0;
export const positiveNumber = (value) => Number(value) > 0;
