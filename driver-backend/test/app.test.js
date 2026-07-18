import test from 'node:test'; import assert from 'node:assert/strict'; import request from 'supertest'; import app from '../src/app.js';
import { driverLoginSchema } from '../src/routes/auth.routes.js';
import { failureSchema } from '../src/routes/order.routes.js';
test('driver health uses the driver prefix', async () => { const response = await request(app).get('/api/v1/driver/health'); assert.equal(response.status, 200); assert.equal(response.body.data.service, 'wolan-driver-api'); });
test('driver dashboard requires authentication', async () => { const response = await request(app).get('/api/v1/driver/dashboard'); assert.equal(response.status, 401); assert.equal(response.body.error.code, 'UNAUTHENTICATED'); });
test('driver login accepts the phone and PIN shape from the app specification', () => {
  assert.equal(driverLoginSchema.safeParse({ phone: '+256700123456', pin: '1234' }).success, true);
  assert.equal(driverLoginSchema.safeParse({ phone: '+256700123456', pin: '12' }).success, false);
});
test('customer-unavailable failures require photo evidence', () => {
  assert.equal(failureSchema.safeParse({ reason: 'CUSTOMER_UNAVAILABLE', note: 'Customer did not answer', photos: [] }).success, false);
  assert.equal(failureSchema.safeParse({ reason: 'CUSTOMER_UNAVAILABLE', note: 'Customer did not answer', photos: [{ url: 'https://example.com/proof.jpg' }] }).success, true);
});
test('driver COD, delivery OTP, and notification state require authentication', async () => {
  const requests = [
    request(app).get('/api/v1/driver/cod'),
    request(app).post('/api/v1/driver/orders/507f1f77bcf86cd799439011/delivery-otp'),
    request(app).patch('/api/v1/driver/notifications/507f1f77bcf86cd799439012/read'),
  ];
  for (const pending of requests) {
    const response = await pending;
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  }
});
