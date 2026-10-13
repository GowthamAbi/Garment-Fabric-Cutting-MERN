import test from "node:test";
import assert from "node:assert/strict";
import BillingRequest from "../src/models/BillingRequest.js";
import TenantRegistry from "../src/models/TenantRegistry.js";
import { getSubscription } from "../src/controllers/saasController.js";

const query = value => ({ sort() {return this;}, limit() {return this;}, select() {return this;}, async lean() {return value;} });

test("owner billing uses central request IDs, resolves company names and hides quote entitlements", async t => {
  t.mock.method(BillingRequest, "find", () => query([
    {_id:"billing-1",companyKey:"tenant-one",referenceNo:"SUB-1",amount:118,status:"PENDING_APPROVAL",quote:{taxAmount:18,setupFee:0,entitlements:{modules:["FABRIC"]}}},
    {_id:"billing-2",companyKey:"archived-key",amount:20},
  ]));
  t.mock.method(TenantRegistry, "find", () => query([{companyKey:"tenant-one",companyName:"Factory One"}]));
  let result;
  // Deliberately no login company ID: owner billing must not depend on it.
  await getSubscription({user:{role:"saas_super_admin"}}, {json(value) {result=value;}});
  assert.equal(result.payments[0]._id,"billing-1");
  assert.equal(result.payments[0].companyId.companyName,"Factory One");
  assert.equal(result.payments[0].taxAmount,18);
  assert.equal(result.payments[1].companyId.companyName,"archived-key");
  assert.equal(result.payments[1].taxAmount,0);
  assert.equal("quote" in result.payments[0],false);
  assert.equal("company" in result,false);
});
