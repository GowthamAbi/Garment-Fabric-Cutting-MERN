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

export function allocatePiecesByStock(totalPcs, perPieceKg, stockByColour) {
  const pcs = Number(totalPcs);
  const weight = Number(perPieceKg);
  if (
    !Number.isInteger(pcs) ||
    pcs <= 0 ||
    weight <= 0 ||
    !stockByColour.length
  )
    throw new TypeError(
      "Valid PCS, piece weight and selected colours are required",
    );

  const target = distributePieces(pcs, stockByColour.length);
  const allocations = stockByColour.map((stock, index) => {
    const capacity = Math.floor(
      (Number(stock.availableWeightKg) + 1e-9) / weight,
    );
    return {
      colour: stock.colour,
      plannedPcs: Math.min(target[index], capacity),
      capacity,
    };
  });

  let remaining =
    pcs - allocations.reduce((sum, row) => sum + row.plannedPcs, 0);
  while (remaining > 0) {
    const candidate = allocations
      .filter((row) => row.plannedPcs < row.capacity)
      .sort(
        (a, b) => b.capacity - b.plannedPcs - (a.capacity - a.plannedPcs),
      )[0];
    if (!candidate) break;
    candidate.plannedPcs += 1;
    remaining -= 1;
  }

  if (remaining > 0) {
    const availablePcs = pcs - remaining;
    throw new RangeError(
      `Fabric shortage: only ${availablePcs} PCS can be planned`,
    );
  }

  return allocations.map(({ capacity: _capacity, ...row }) => ({
    ...row,
    wantedWeightKg: calculateWantedWeight(row.plannedPcs, weight),
  }));
}
