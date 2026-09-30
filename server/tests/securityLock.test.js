import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("business data routes are gated while limited lead forms stay public", async () => {
  const routes = await read("../src/routes/index.js");
  const authenticationGate = routes.indexOf("router.use(requireAuth");
  const formerlyPublicOutward = routes.indexOf(
    'router.use("/public", publicOutwardRoutes)',
  );
  const publicLeadForms = routes.indexOf(
    'router.use("/public/saas", publicSaasRoutes)',
  );

  assert.ok(authenticationGate > -1);
  assert.ok(formerlyPublicOutward > authenticationGate);
  assert.ok(publicLeadForms > -1);
  assert.ok(publicLeadForms < authenticationGate);
});

test("browser session uses a hardened HttpOnly cookie", async () => {
  const controller = await read("../src/controllers/authController.js");

  assert.match(controller, /httpOnly:\s*true/);
  assert.match(controller, /secure:\s*production/);
  assert.match(controller, /sameSite:\s*production \? "none" : "lax"/);
  assert.match(controller, /partitioned:\s*production/);
  assert.match(controller, /expiresIn:\s*"8h"/);
});

test("frontend API calls require cookie credentials and avoid cache", async () => {
  const api = await read("../../client/src/api.js");

  assert.match(api, /credentials:\s*"include"/);
  assert.match(api, /cache:\s*"no-store"/);
  assert.doesNotMatch(api, /Authorization:\s*`Bearer/);
});

test("anonymous session checks do not show an error popup or expire again", async () => {
  const authContext = await read("../../client/src/context/AuthContext.jsx");
  const requestClient = await read("../../client/src/api/axiosInstance.js");

  assert.match(authContext, /request\("\/auth\/session",\s*\{/);
  assert.match(authContext, /suppressGlobalError:\s*true/);
  assert.match(authContext, /suppressSessionExpired:\s*true/);
  assert.match(requestClient, /if \(!suppressGlobalError\)/);
  assert.match(
    requestClient,
    /response\.status === 401 && !suppressSessionExpired/,
  );
});

test("public trial remains pending until the SaaS Owner decides", async () => {
  const controller = await read("../src/controllers/saasController.js");
  const model = await read("../src/models/SalesLead.js");

  assert.match(controller, /status:\s*"TRIAL_PENDING"/);
  assert.match(controller, /pendingPasswordHash:\s*await bcrypt\.hash/);
  assert.match(controller, /Trial approved\. Customer can login now/);
  assert.match(model, /pendingPasswordHash:.*select:\s*false/);
});
