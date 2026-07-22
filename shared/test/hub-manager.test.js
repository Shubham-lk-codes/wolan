import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { normalizeRole, ROLES } from '../constants/index.js';
import { applyHubScope, authorizeRoles } from '../middleware/index.js';
import { hasPermission } from '../permissions/index.js';
import { BaseRepository } from '../repositories/index.js';
import { AuthService } from '../services/index.js';

const manager = { role: ROLES.HUB_MANAGER, hubId: 'HUB_001' };

test('hub manager permissions allow operations but deny destructive and global administration actions', () => {
  for (const permission of ['dashboard:read', 'hub:read', 'order:create', 'order:update', 'driver:create', 'driver:update', 'merchant:create', 'merchant:update', 'report:read', 'hub-setting:update']) {
    assert.equal(hasPermission(manager, permission), true, `${permission} should be allowed`);
  }
  for (const permission of ['order:delete', 'driver:delete', 'merchant:delete', 'hub:create', 'hub:update', 'hub:delete', 'user:read', 'user:create', 'setting:update', 'notification:create', 'notification:delete']) {
    assert.equal(hasPermission(manager, permission), false, `${permission} should be denied`);
  }
});

test('hub scope rejects a frontend attempt to select another hub', () => {
  const request = { user: manager, actor: { actorId: '507f1f77bcf86cd799439011', ...manager }, body: { hubId: 'HUB_002' }, query: {}, params: {} };
  let received;
  applyHubScope(request, {}, (error) => { received = error; });
  assert.equal(received?.code, 'HUB_ACCESS_DENIED');
  assert.equal(request.scope, undefined);
});

test('hub scope is derived from the authenticated manager when the client omits hubId', () => {
  const request = { user: manager, actor: { actorId: '507f1f77bcf86cd799439011', ...manager }, body: {}, query: {}, params: {} };
  let received;
  applyHubScope(request, {}, (error) => { received = error; });
  assert.equal(received, undefined);
  assert.deepEqual(request.scope, { hubId: 'HUB_001' });
  assert.equal(request.actor.hubId, 'HUB_001');
});

test('repository creation gives authenticated hub context precedence over input', async () => {
  let created;
  const repository = new BaseRepository({
    create(documents) { [created] = documents; return Promise.resolve(documents); },
  });
  await repository.create({ hubId: 'HUB_002', name: 'Injected tenant' }, { hubId: 'HUB_001', actorId: '507f1f77bcf86cd799439011' });
  assert.equal(created.hubId, 'HUB_001');
});

test('admin access tokens expose userId, role, and hubId for the existing auth flow', () => {
  const auth = new AuthService({ accessSecret: 'a-secret-that-is-long-enough', refreshSecret: 'another-secret-that-is-long-enough' });
  const accessToken = auth.signAccess({ _id: { toString: () => '507f1f77bcf86cd799439011' }, role: ROLES.HUB_MANAGER, hubId: 'HUB_001', tokenVersion: 2 });
  const payload = jwt.decode(accessToken);
  assert.equal(payload.userId, '507f1f77bcf86cd799439011');
  assert.equal(payload.role, ROLES.HUB_MANAGER);
  assert.equal(payload.hubId, 'HUB_001');
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
});

test('hub-manager-only routes reject non-admin roles', () => {
  const middleware = authorizeRoles(ROLES.HUB_MANAGER);
  let error;
  middleware({ user: { role: ROLES.OPS_COORDINATOR } }, {}, (received) => { error = received; });
  assert.equal(error?.code, 'FORBIDDEN');
});

test('legacy admin retains super-admin access across permission and role gates', () => {
  const admin = { role: 'admin', hubId: 'HUB_001' };
  assert.equal(normalizeRole(admin.role), ROLES.SUPER_ADMIN);
  assert.equal(hasPermission(admin, 'merchant:read'), true);
  assert.equal(hasPermission(admin, 'driver:delete'), true);

  const middleware = authorizeRoles(ROLES.HUB_MANAGER);
  let error;
  middleware({ user: admin }, {}, (received) => { error = received; });
  assert.equal(error, undefined);
});

test('legacy role casing is canonicalized before permissions and hub-manager routing', () => {
  assert.equal(normalizeRole('hub_manager'), ROLES.HUB_MANAGER);
  assert.equal(normalizeRole('hub-manager'), ROLES.HUB_MANAGER);
  assert.equal(hasPermission({ role: 'hub_manager', hubId: 'HUB_001' }, 'order:read'), true);

  const middleware = authorizeRoles(ROLES.HUB_MANAGER);
  let error;
  middleware({ user: { role: 'hub_manager' } }, {}, (received) => { error = received; });
  assert.equal(error, undefined);
});
