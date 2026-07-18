import { z } from 'zod';
import { DRIVER_STATUS, ORDER_STATUSES, SYSTEM_ROLES } from '../constants/index.js';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB id');
export const hubIdSchema = z.string().trim().regex(/^HUB_[A-Z0-9_]+$/, 'Invalid hub id');
export const phoneSchema = z.string().trim().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number');
export const moneySchema = z.number().int().nonnegative();
export const coordinatesSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});
export const pointSchema = coordinatesSchema.transform(({ longitude, latitude }) => ({ type: 'Point', coordinates: [longitude, latitude] }));

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().trim().max(50).optional(),
}).strict();

export const orderListQuerySchema = paginationSchema.extend({
  orderStatus: z.enum(ORDER_STATUSES).optional(),
  merchantId: objectIdSchema.optional(),
  driverId: objectIdSchema.optional(),
}).strict();

const addressSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: phoneSchema.optional(),
  address: z.string().trim().min(3).max(500),
  instructions: z.string().trim().max(500).optional(),
  location: pointSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
}).strict();

export const createOrderSchema = z.object({
  hubId: hubIdSchema.optional(),
  merchantId: objectIdSchema.optional(),
  customer: z.object({ name: z.string().trim().min(2).max(120), phone: phoneSchema, email: z.email().optional() }).strict(),
  pickup: addressSchema,
  delivery: addressSchema,
  itemDescription: z.string().trim().min(2).max(1000),
  declaredValue: moneySchema.default(0),
  paymentMethod: z.enum(['COD', 'PREPAID']).default('COD'),
  codAmount: moneySchema.default(0),
  insurance: z.boolean().default(false),
  serviceType: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
  distanceKm: z.number().nonnegative().max(2_000).default(0),
  packageSize: z.enum(['SMALL', 'MEDIUM', 'LARGE']).default('MEDIUM'),
  batchGroup: z.string().trim().max(100).optional(),
}).strict().superRefine((data, context) => {
  if (data.paymentMethod === 'COD' && data.codAmount <= 0) context.addIssue({ code: 'custom', path: ['codAmount'], message: 'COD orders require a positive COD amount' });
});

export const quoteOrderSchema = z.object({
  distanceKm: z.number().nonnegative().max(2_000).default(0),
  codAmount: moneySchema.default(0),
  insurance: z.boolean().default(false),
  serviceType: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
}).strict();

export const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(500).optional() }).strict();
export const driverStatusSchema = z.object({ status: z.enum(DRIVER_STATUS) }).strict();
export const otpSchema = z.object({ otpId: objectIdSchema, code: z.string().regex(/^\d{4,6}$/) }).strict();
export const loginSchema = z.object({ identifier: z.string().trim().min(5).max(254), password: z.string().min(4).max(128) }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(32) }).strict();
export const credentialResetRequestSchema = z.object({ identifier: z.string().trim().min(5).max(254) }).strict();
export const passwordResetSchema = z.object({ otpId: objectIdSchema, code: z.string().regex(/^\d{6}$/), password: z.string().min(8).max(128) }).strict();
export const pinResetSchema = z.object({ otpId: objectIdSchema, code: z.string().regex(/^\d{6}$/), pin: z.string().regex(/^\d{4,8}$/) }).strict();
export const pinChangeSchema = z.object({ currentPin: z.string().regex(/^\d{4,8}$/), newPin: z.string().regex(/^\d{4,8}$/) }).strict();
export const userSchema = z.object({
  hubId: hubIdSchema,
  name: z.string().trim().min(2).max(120),
  email: z.email().optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(8).max(128).optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  role: z.enum(SYSTEM_ROLES),
  assignedHubIds: z.array(hubIdSchema).default([]),
}).strict().refine((value) => value.email || value.phone, { message: 'Email or phone is required' });

export const notificationCreateSchema = z.object({
  hubId: hubIdSchema.optional(),
  recipientType: z.enum(['USER', 'MERCHANT', 'DRIVER', 'CUSTOMER', 'HUB', 'HQ']),
  recipientId: objectIdSchema.optional(),
  orderId: objectIdSchema.optional(),
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(2_000),
  channels: z.array(z.enum(['IN_APP', 'PUSH', 'SMS', 'WHATSAPP', 'EMAIL'])).min(1).max(5).default(['IN_APP']),
  priority: z.enum(['NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict().superRefine((value, context) => {
  if (value.recipientType === 'USER' && !value.recipientId) context.addIssue({ code: 'custom', path: ['recipientId'], message: 'A user recipient is required' });
});

export const trackingSampleSchema = z.object({
  entityType: z.enum(['DRIVER', 'PACKAGE']),
  entityId: objectIdSchema,
  orderId: objectIdSchema.optional(),
  location: pointSchema,
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  battery: z.number().min(0).max(100).optional(),
  signal: z.number().min(0).max(100).optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
  source: z.enum(['APP', 'GPS_DEVICE', 'PROVIDER_WEBHOOK']).default('PROVIDER_WEBHOOK'),
}).strict();

export function validate(schema, source = 'body') {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request[source]);
    if (!parsed.success) {
      const error = new Error('Request validation failed');
      error.name = 'ValidationError';
      error.statusCode = 422;
      error.code = 'VALIDATION_FAILED';
      error.details = parsed.error.flatten();
      return next(error);
    }
    if (source === 'query') {
      // Express 5 exposes request.query as a getter on the request prototype.
      // Define the validated value on this request instead of assigning to the
      // getter, which throws in strict-mode ES modules.
      Object.defineProperty(request, 'query', {
        value: parsed.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      request[source] = parsed.data;
    }
    return next();
  };
}
