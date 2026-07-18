import test from 'node:test'; import assert from 'node:assert/strict'; import request from 'supertest'; import app from '../src/app.js';
test('merchant health uses the merchant prefix', async () => { const response = await request(app).get('/api/v1/merchant/health'); assert.equal(response.status, 200); assert.equal(response.body.data.service, 'wolan-merchant-api'); });
test('merchant orders require authentication', async () => { const response = await request(app).get('/api/v1/merchant/orders'); assert.equal(response.status, 401); assert.equal(response.body.error.code, 'UNAUTHENTICATED'); });
test('merchant payout and referral views require authentication', async () => {
  for (const path of ['/api/v1/merchant/payouts', '/api/v1/merchant/referrals']) {
    const response = await request(app).get(path);
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  }
});
test('merchant dual-tracking view requires authentication', async () => {
  const response = await request(app).get('/api/v1/merchant/orders/507f1f77bcf86cd799439011/tracking');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});
