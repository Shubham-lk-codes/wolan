import { Router } from 'express';
import { authorize, validate } from '@wolan/shared/middleware';
import * as controller from '../controllers/settings.controller.js';
import { flexibleBody, route } from './route.utils.js';

export const settingsRoutes = Router();

settingsRoutes.put('/settings', authorize('setting:update', 'setting:*'), validate(flexibleBody), route(controller.saveSettings));
