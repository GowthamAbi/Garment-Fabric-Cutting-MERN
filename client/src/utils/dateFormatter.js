export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN") : "—";
export const toInputDate = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
