export function generateReferenceNo(prefix) {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const uniqueNumber = Date.now().toString().slice(-5);

  return `${prefix}-${date}-${uniqueNumber}`;
}
