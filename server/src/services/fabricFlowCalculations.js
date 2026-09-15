export function distributePieces(totalPcs, colourCount) {
  const total = Number(totalPcs);
  const count = Number(colourCount);
  if (
    !Number.isInteger(total) ||
    total < 0 ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new TypeError("PCS and colour count must be valid whole numbers");
  const base = Math.floor(total / count);
  return Array.from(
    { length: count },
    (_, index) => base + (index < total % count ? 1 : 0),
  );
}

export function calculateWantedWeight(pcs, perPieceKg) {
  return Number((Number(pcs) * Number(perPieceKg)).toFixed(3));
}

export function calculateWaste(issuedKg, bundleKg) {
  return Number((Number(issuedKg) - Number(bundleKg)).toFixed(3));
}

export function calculateElasticMtr(actualPcs, measurementMtr) {
  return Number((Number(actualPcs) * Number(measurementMtr)).toFixed(3));
}
