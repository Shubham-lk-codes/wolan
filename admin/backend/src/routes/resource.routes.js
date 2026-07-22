import { Router } from 'express';
import { authorize, validate } from '@wolan/shared/middleware';
import { paginationSchema } from '@wolan/shared/validation';
import * as controller from '../controllers/resource.controller.js';
import { flexibleBody, idParams, route } from './route.utils.js';

const resources = [
  'hubs', 'merchants', 'drivers', 'packages', 'trackers', 'payments', 'incidents',
  'notifications', 'settings', 'zones', 'reports', 'referrals', 'customers',
  'alerts', 'tickets', 'audit',
];

export const resourceRoutes = Router();

for (const resource of resources) {
  const singular = resource === 'hubs' ? 'hub' : resource.replace(/s$/, '');
  resourceRoutes.get(`/${resource}`, authorize(`${singular}:read`, `${singular}:*`), validate(paginationSchema, 'query'), route(controller.resourceList(resource)));
  resourceRoutes.get(`/${resource}/:id`, authorize(`${singular}:read`, `${singular}:*`), validate(idParams, 'params'), route(controller.resourceGet(resource)));
  if (resource !== 'audit') {
    if (resource !== 'notifications') {
      resourceRoutes.post(`/${resource}`, authorize(`${singular}:create`, `${singular}:*`), validate(flexibleBody), route(controller.resourceCreate(resource)));
    }
    resourceRoutes.patch(`/${resource}/:id`, authorize(`${singular}:update`, `${singular}:*`), validate(idParams, 'params'), validate(flexibleBody), route(controller.resourceUpdate(resource)));
    resourceRoutes.delete(`/${resource}/:id`, authorize(`${singular}:delete`, `${singular}:*`), validate(idParams, 'params'), route(controller.resourceDelete(resource)));
  }
}
