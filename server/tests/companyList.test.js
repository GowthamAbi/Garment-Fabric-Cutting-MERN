import test from 'node:test';
import assert from 'node:assert/strict';
import TenantRegistry from '../src/models/TenantRegistry.js';
import User from '../src/models/User.js';
import { getCompanies } from '../src/controllers/companyController.js';
import { runWithTenant, getTenant } from '../src/utils/tenantContext.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

test('owner company list resolves legacy admin in the correct tenant and hides database names', async (t) => {
  const records = [
    { companyKey: 'company-one', databaseName: 'ugs_tenant_company_one', companyName: 'One' },
    { companyKey: 'company-two', databaseName: 'ugs_tenant_company_two', companyName: 'Two', adminUserId: 'existing' },
    { companyKey: 'company-three', databaseName: 'ugs_tenant_company_three', companyName: 'Three' },
  ];
  t.mock.method(TenantRegistry, 'find', () => ({
    select(fields) {
      const selected = records.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => fields.split(' ').includes(key))));
      return { sort: () => ({ lean: async () => selected }) };
    },
  }));
  let lookups = 0;
  const userModel = runWithTenant({ companyKey: 'company-one', databaseName: 'ugs_tenant_company_one' }, () => User.model('User'));
  t.mock.method(userModel.base.Model, 'findOne', function () {
    lookups++;
    const tenant = getTenant();
    assert.equal(this.db.name, tenant.databaseName);
    return { select: () => ({ lean: async () => tenant.companyKey === 'company-one' ? { userId: 'legacy', name: 'Admin', email: 'admin@example.com' } : null }) };
  });
  let result;
  await getCompanies({ user: { role: 'saas_super_admin' } }, { json: value => { result = value; } });
  assert.equal(lookups, 2);
  assert.equal(result[0].adminUserId, 'legacy');
  assert.equal(result[1].adminUserId, 'existing');
  assert.equal(result[2].adminUserId, undefined);
  assert.ok(result.every(row => !('databaseName' in row)));
  assert.deepEqual(getTenant(), {});
});

test('production errors stay generic while logging server diagnostics', (t) => {
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const log = t.mock.method(console, 'error', () => {});
  try {
    let status, body;
    const error = new Error('Company lookup failed');
    errorHandler(error, {}, { status(value) { status = value; return this; }, json(value) { body = value; } }, () => {});
    assert.equal(status, 500);
    assert.deepEqual(body, { success: false, message: 'Unexpected server error' });
    assert.equal(log.mock.calls.length, 1);
    assert.equal(log.mock.calls[0].arguments[1], error.stack);
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
});

 test('one invalid legacy workspace does not break the owner company list', async (t) => {
  t.mock.method(TenantRegistry, 'find', () => ({ select: () => ({ sort: () => ({ lean: async () => [
    {companyKey:'broken',databaseName:'invalid/database',companyName:'Broken'},
    {companyKey:'valid',databaseName:'ugs_tenant_valid',companyName:'Valid',adminUserId:'UGS-MGT-VAL-1234'},
  ] }) }) }));
  const log=t.mock.method(console,'error',()=>{});
  let result;
  await getCompanies({user:{role:'saas_super_admin'}},{json:value=>{result=value;}});
  assert.equal(result.length,2);
  assert.equal(result[0].adminLookupStatus,'UNAVAILABLE');
  assert.equal(result[1].adminUserId,'UGS-MGT-VAL-1234');
  assert.ok(result.every(row=>!('databaseName' in row)));
  assert.equal(log.mock.calls.length,1);
  assert.deepEqual(getTenant(),{});
});
