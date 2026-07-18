import test from 'node:test'; import assert from 'node:assert/strict'; import request from 'supertest'; import app from '../src/app.js';
test('admin public health uses the versioned public prefix', async () => { const response = await request(app).get('/api/v1/public/health'); assert.equal(response.status, 200); assert.equal(response.body.success, true); assert.equal(response.body.data.service, 'wolan-admin-api'); });
test('admin resources require authentication', async () => { const response = await request(app).get('/api/v1/admin/orders'); assert.equal(response.status, 401); assert.equal(response.body.error.code, 'UNAUTHENTICATED'); });
test('admin refresh sessions require CSRF validation', async () => { const response = await request(app).post('/api/v1/admin/auth/refresh').send({}); assert.equal(response.status, 403); assert.equal(response.body.error.code, 'CSRF_VALIDATION_FAILED'); });
test('admin rejects nested MongoDB operators before validation', async () => {
  const response = await request(app).post('/api/v1/admin/auth/login').send({ identifier: 'admin@wolan.com', password: { $ne: null } });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'UNSAFE_INPUT');
});
test('tracking ingestion rejects unsigned payloads', async () => {
  const response = await request(app).post('/api/v1/tracking/device/location').send({ hubId: 'HUB_001', entityType: 'DRIVER', entityId: '507f1f77bcf86cd799439011', location: { longitude: 32.58, latitude: 0.34 }, source: 'APP' });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_WEBHOOK_TIMESTAMP');
});
