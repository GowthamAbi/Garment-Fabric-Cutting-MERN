export function formatLabel(value) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "—";
}

export function formatInputDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
