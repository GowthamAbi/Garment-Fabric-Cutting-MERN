import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateElasticMtr,
  calculateWantedWeight,
  calculateWaste,
  distributePieces,
  allocatePiecesByStock,
} from "../src/services/fabricFlowCalculations.js";

test("PCS are distributed across colours without losing pieces", () => {
  assert.deepEqual(distributePieces(10, 3), [4, 3, 3]);
  assert.equal(
    distributePieces(10, 3).reduce((sum, pcs) => sum + pcs, 0),
    10,
  );
});

test("fabric and elastic calculations keep three decimal precision", () => {
  assert.equal(calculateWantedWeight(100, 0.084), 8.4);
  assert.equal(calculateElasticMtr(111, 0.749), 83.139);
  assert.equal(calculateWaste(100, 92.555), 7.445);
});

test("invalid distribution input is rejected", () => {
  assert.throws(() => distributePieces(100, 0), TypeError);
});

test("production plan redistributes pieces away from a low-stock colour", () => {
  const rows = allocatePiecesByStock(100, 0.02, [
    { colour: "RED", availableWeightKg: 0.4 },
    { colour: "BLUE", availableWeightKg: 5 },
  ]);
  assert.deepEqual(
    rows.map((row) => row.plannedPcs),
    [20, 80],
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.plannedPcs, 0),
    100,
  );
});

test("production plan blocks when total selected stock is insufficient", () => {
  assert.throws(
    () =>
      allocatePiecesByStock(100, 0.02, [
        { colour: "RED", availableWeightKg: 0.4 },
        { colour: "BLUE", availableWeightKg: 0.4 },
      ]),
    RangeError,
  );
});
