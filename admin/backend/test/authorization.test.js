import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { ROLES } from '@wolan/shared/constants';
import { authorize, authorizeRoles } from '@wolan/shared/middleware';

const protectedReads = Object.freeze([
  ['/merchants', 'merchant:read'],
  ['/drivers', 'driver:read'],
  ['/orders', 'order:read'],
  ['/notifications', 'notification:read'],
  ['/notifications/unread-count', 'notification:read'],
  ['/hubs', 'hub:read'],
]);

function authorizationHarness(role) {
  const app = express();
  app.use((request_, _response, next) => {
    request_.user = { role, hubId: 'HUB_001', permissions: [] };
    next();
  });
  for (const [path, permission] of protectedReads) {
    app.get(path, authorize(permission), (_request, response) => response.json({ ok: true }));
  }
  app.post('/hubs', authorize('hub:create'), (_request, response) => response.status(201).json({ ok: true }));
  app.delete('/drivers/:id', authorize('driver:delete'), (_request, response) => response.status(204).end());
  app.get('/hub-manager/dashboard', authorizeRoles(ROLES.HUB_MANAGER), (_request, response) => response.json({ ok: true }));
  app.use((error, _request, response, _next) => response.status(error.statusCode ?? 500).json({ code: error.code }));
  return app;
}

test('legacy ADMIN can read every admin resource and bypass a role-only gate', async () => {
  const app = authorizationHarness('ADMIN');
  for (const [path] of [...protectedReads, ['/hub-manager/dashboard']]) {
    const response = await request(app).get(path);
    assert.equal(response.status, 200, `${path} should be available to ADMIN`);
  }
  assert.equal((await request(app).post('/hubs')).status, 201);
});

test('hub-manager permissions remain non-destructive after admin compatibility mapping', async () => {
  const app = authorizationHarness('hub_manager');
  for (const [path] of protectedReads) {
    const response = await request(app).get(path);
    assert.equal(response.status, 200, `${path} should be available to HUB_MANAGER`);
  }
  const denied = await request(app).delete('/drivers/507f1f77bcf86cd799439011');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'FORBIDDEN');
  assert.equal((await request(app).post('/hubs')).status, 403);
});
