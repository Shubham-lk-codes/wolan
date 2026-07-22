import { Router } from 'express';
import { authorize, validate } from '@wolan/shared/middleware';
import { paginationSchema, userSchema } from '@wolan/shared/validation';
import * as controller from '../controllers/user.controller.js';
import { flexibleBody, idParams, route } from './route.utils.js';

export const userRoutes = Router();

userRoutes.get('/users', authorize('user:read', 'hub:*'), validate(paginationSchema, 'query'), route(controller.listUsers));
userRoutes.post('/users', authorize('user:create', 'hub:*'), validate(userSchema), route(controller.createUser));
userRoutes.patch('/users/:id', authorize('user:update', 'hub:*'), validate(idParams, 'params'), validate(flexibleBody), route(controller.updateUser));
