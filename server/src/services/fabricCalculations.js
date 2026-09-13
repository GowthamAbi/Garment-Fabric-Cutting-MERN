export function calculatePerPieceFabric(cuttingWeightKg, foldingWeightKg) {
  return Number(cuttingWeightKg || 0) + Number(foldingWeightKg || 0);
}

export function calculateWantedWeight(pieces, weightPerPieceKg) {
  return Number((Number(pieces || 0) * Number(weightPerPieceKg || 0)).toFixed(3));
}

export function distributePiecesByColour(totalPieces, colours) {
  if (!Array.isArray(colours) || colours.length === 0) {
    throw new Error("At least one colour is required");
  }

  const total = Number(totalPieces || 0);
  const base = Math.floor(total / colours.length);
  const remainder = total - base * colours.length;

  return colours.map((colour, index) => ({
    colour,
    pieces: base + (index === colours.length - 1 ? remainder : 0),
  }));
}

export function calculateCuttingActual({
  issuedWeightKg,
  cutBundleWeightKg,
  returnedWeightKg = 0,
  plannedPieces,
  actualPieces,
}) {
  const wasteWeightKg = Math.max(
    0,
    Number(issuedWeightKg) - Number(cutBundleWeightKg) - Number(returnedWeightKg),
  );

  return {
    wasteWeightKg: Number(wasteWeightKg.toFixed(3)),
    wastePercentage: Number(
      (Number(issuedWeightKg) > 0
        ? (wasteWeightKg / Number(issuedWeightKg)) * 100
        : 0
      ).toFixed(2),
    ),
    piecesDifference: Number(actualPieces) - Number(plannedPieces),
  };
}

export function calculateFoldingRequirement(actualCutPieces, foldingWeightPerPieceKg) {
  return calculateWantedWeight(actualCutPieces, foldingWeightPerPieceKg);
}

export function allocateByPriorityAndAge(requirements, stockBundles) {
  const demands = [...requirements].sort(
    (a, b) => Number(a.priority || 1) - Number(b.priority || 1),
  );
  const stock = [...stockBundles]
    .map((row) => ({ ...row, remainingWeightKg: Number(row.availableWeightKg || 0) }))
    .sort((a, b) => new Date(a.inwardDate) - new Date(b.inwardDate));

  return demands.map((demand) => {
    let remaining = Number(demand.wantedWeightKg || 0);
    const allocations = [];

    for (const bundle of stock) {
      if (remaining <= 0) break;
      if (bundle.remainingWeightKg <= 0) continue;
      if (String(bundle.fabricCode).toUpperCase() !== String(demand.fabricCode).toUpperCase()) continue;
      if (String(bundle.colour).toUpperCase() !== String(demand.colour).toUpperCase()) continue;

      const issuedWeightKg = Math.min(remaining, bundle.remainingWeightKg);
      allocations.push({
        bundleNo: bundle.bundleNo,
        inwardNo: bundle.inwardNo,
        lotNo: bundle.lotNo,
        issuedWeightKg: Number(issuedWeightKg.toFixed(3)),
      });
      bundle.remainingWeightKg -= issuedWeightKg;
      remaining -= issuedWeightKg;
    }

    return {
      ...demand,
      allocations,
      allocatedWeightKg: Number((Number(demand.wantedWeightKg) - remaining).toFixed(3)),
      shortageWeightKg: Number(Math.max(0, remaining).toFixed(3)),
      status: remaining <= 0 ? "AVAILABLE" : allocations.length ? "PARTIALLY_AVAILABLE" : "NOT_AVAILABLE",
    };
  });
}
