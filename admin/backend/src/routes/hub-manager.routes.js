import { Router } from 'express';
import { ROLES } from '@wolan/shared/constants';
import { authorize, authorizeRoles, validate } from '@wolan/shared/middleware';
import { z } from 'zod';
import * as controller from '../controllers/hub-manager.controller.js';
import { route } from './route.utils.js';

const dispatchSettingsSchema = z.object({
  maxOrdersPerDriver: z.number().int().min(1).max(100).optional(),
  defaultDeliveryEtaMinutes: z.number().int().min(1).max(1_440).optional(),
  assignmentRadiusKm: z.number().min(0.1).max(100).optional(),
  idleAlertMinutes: z.number().int().min(1).max(1_440).optional(),
  gpsDarkAlertMinutes: z.number().int().min(1).max(1_440).optional(),
  codRemitDeadlineHours: z.number().int().min(1).max(720).optional(),
  autoAssignNearestDriver: z.boolean().optional(),
  prioritizeEliteMerchants: z.boolean().optional(),
  blockOfflineDrivers: z.boolean().optional(),
  allowDriverSelfAssignment: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one dispatch setting is required');

const notificationSettingsSchema = z.object({
  newOrder: z.boolean().optional(),
  driverOffline: z.boolean().optional(),
  failedDelivery: z.boolean().optional(),
  codAlert: z.boolean().optional(),
  delayAlert: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one notification setting is required');

const workingHoursSchema = z.object({
  mondayFriday: z.string().trim().min(3).max(80).optional(),
  saturday: z.string().trim().min(3).max(80).optional(),
  sunday: z.string().trim().min(3).max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one working-hours setting is required');

const hubSettingsSchema = z.object({
  dispatch: dispatchSettingsSchema.optional(),
  notifications: notificationSettingsSchema.optional(),
  workingHours: workingHoursSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one settings section is required');

export const hubManagerRoutes = Router();

hubManagerRoutes.use(authorizeRoles(ROLES.HUB_MANAGER));
hubManagerRoutes.get('/hub-manager/dashboard', authorize('dashboard:read'), route(controller.dashboard));
hubManagerRoutes.get('/hub-manager/context', authorize('hub:read'), route(controller.context));
hubManagerRoutes.get('/hub-manager/settings', authorize('hub-setting:read'), route(controller.settings));
hubManagerRoutes.put('/hub-manager/settings', authorize('hub-setting:update'), validate(hubSettingsSchema), route(controller.updateSettings));
