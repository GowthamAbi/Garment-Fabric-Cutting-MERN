import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";

test("production MVC modules exist", async () => {
  await Promise.all([
    access(new URL("../src/controllers/productionController.js", import.meta.url)),
    access(new URL("../src/routes/production.routes.js", import.meta.url)),
    access(new URL("../src/models/ProductionJob.js", import.meta.url)),
    access(new URL("../src/models/PendingIssue.js", import.meta.url)),
    access(new URL("../src/models/SewingDelivery.js", import.meta.url)),
    access(new URL("../src/models/WarehouseStock.js", import.meta.url)),
    access(new URL("../src/controllers/warehouseController.js", import.meta.url)),
    access(new URL("../src/routes/warehouse.routes.js", import.meta.url)),
  ]);
  assert.ok(true);
});
