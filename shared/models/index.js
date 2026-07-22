import mongoose from 'mongoose';
import { DRIVER_STATUS, GLOBAL_HUB_ID, ORDER_STATUSES, ROLES, SYSTEM_ROLES } from '../constants/index.js';
import { addressSchema, auditFields, defineModel, mediaSchema, pointSchema, schemaOptions, tenantSchema } from './base.js';

const objectId = mongoose.Schema.Types.ObjectId;

const RoleSchema = tenantSchema({
  name: { type: String, required: true, uppercase: true, trim: true },
  permissions: { type: [String], default: [] },
  description: String,
  system: { type: Boolean, default: false },
});
RoleSchema.index({ hubId: 1, name: 1, deletedAt: 1 }, { unique: true });

const UserSchema = tenantSchema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, select: false },
  pinHash: { type: String, select: false },
  role: { type: String, enum: SYSTEM_ROLES, required: true, index: true },
  permissions: { type: [String], default: [] },
  assignedHubIds: { type: [String], default: [] },
  merchantId: { type: objectId, ref: 'Merchant', index: true },
  driverId: { type: objectId, ref: 'Driver', index: true },
  tokenVersion: { type: Number, default: 0, select: false },
  failedLoginCount: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, select: false },
  lastLoginAt: Date,
  passwordChangedAt: Date,
}, { collection: 'users' });
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null, email: { $type: 'string' } } });
UserSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { deletedAt: null, phone: { $type: 'string' } } });

const HubSchema = tenantSchema({
  hubId: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  location: pointSchema,
  address: String,
  phone: String,
  email: { type: String, lowercase: true, trim: true },
  city: { type: String, default: 'Kampala' },
  region: { type: String, index: true },
  zoneCoverage: { type: [String], default: [] },
  managerId: { type: objectId, ref: 'User' },
  dailyTarget: { type: Number, min: 0, default: 150 },
  suspendedAt: Date,
  suspensionReason: String,
});
HubSchema.pre('validate', function applyHubCode() { if (!this.hubId && this.code) this.hubId = this.code; });
HubSchema.index({ hubId: 1 }, { unique: true });
HubSchema.index({ code: 1 }, { unique: true });
HubSchema.index({ slug: 1 }, { unique: true });
HubSchema.index({ location: '2dsphere' });

const MerchantSchema = tenantSchema({
  userId: { type: objectId, ref: 'User', index: true },
  merchantCode: { type: String, required: true, uppercase: true },
  businessName: { type: String, required: true, trim: true },
  shopName: String,
  building: String,
  phone: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  ownerName: String,
  location: pointSchema,
  address: String,
  tier: { type: String, enum: ['STARTER', 'ACTIVE', 'PRIORITY', 'ELITE'], default: 'STARTER', index: true },
  referralCode: { type: String, uppercase: true },
  referredByMerchantId: { type: objectId, ref: 'Merchant' },
  referralEarnings: { type: Number, min: 0, default: 0 },
  codBalance: { type: Number, min: 0, default: 0 },
  kycStatus: { type: String, enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
  logo: mediaSchema,
  qrCodeUrl: String,
});
MerchantSchema.index({ hubId: 1, merchantCode: 1 }, { unique: true });
MerchantSchema.index({ hubId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' }, deletedAt: null } });
MerchantSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

const DriverSchema = tenantSchema({
  userId: { type: objectId, ref: 'User', index: true },
  driverCode: { type: String, required: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  plateNumber: String,
  nationalId: String,
  stage: String,
  yearsExperience: { type: Number, min: 0, default: 0 },
  district: String,
  division: String,
  stageChairmanContact: String,
  nextOfKin: { name: String, phone: String, relationship: String },
  documents: { type: [mediaSchema], default: [] },
  securityBond: { type: Number, min: 0, default: 0 },
  availability: { type: String, enum: DRIVER_STATUS, default: 'OFFLINE', index: true },
  autoAccept: { type: Boolean, default: false },
  currentLocation: pointSchema,
  lastHeartbeatAt: Date,
  rating: { type: Number, min: 0, max: 5, default: 5 },
  completedDeliveries: { type: Number, min: 0, default: 0 },
  failedDeliveries: { type: Number, min: 0, default: 0 },
  codHeld: { type: Number, min: 0, default: 0 },
  finesTotal: { type: Number, min: 0, default: 0 },
  dailyEarnings: { type: Number, min: 0, default: 0 },
  gpsDeviceId: { type: objectId, ref: 'GPSDevice' },
  vehicleId: { type: objectId, ref: 'Vehicle' },
  zones: { type: [String], default: [] },
});
DriverSchema.index({ hubId: 1, driverCode: 1 }, { unique: true });
DriverSchema.index({ hubId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' }, deletedAt: null } });
DriverSchema.index({ hubId: 1, availability: 1, status: 1 });
DriverSchema.index({ currentLocation: '2dsphere' });

const timelineSchema = new mongoose.Schema({
  status: { type: String, required: true },
  note: String,
  actorId: { type: objectId, ref: 'User' },
  location: pointSchema,
  at: { type: Date, default: Date.now },
}, { _id: true });

const OrderSchema = tenantSchema({
  orderNumber: { type: String, required: true, uppercase: true },
  merchantId: { type: objectId, ref: 'Merchant', required: true, index: true },
  driverId: { type: objectId, ref: 'Driver', index: true },
  customerId: { type: objectId, ref: 'Customer', index: true },
  customer: { name: { type: String, required: true }, phone: { type: String, required: true }, email: String },
  pickup: { type: addressSchema, required: true },
  delivery: { type: addressSchema, required: true },
  itemDescription: { type: String, required: true },
  declaredValue: { type: Number, min: 0, default: 0 },
  orderStatus: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
  paymentMethod: { type: String, enum: ['COD', 'PREPAID'], default: 'COD' },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  codAmount: { type: Number, min: 0, default: 0 },
  pricing: { baseFee: Number, distanceFee: Number, codFee: Number, insuranceFee: Number, returnFee: Number, total: Number, currency: { type: String, default: 'UGX' } },
  insurance: { enabled: { type: Boolean, default: false }, fee: Number, coverageAmount: Number },
  packageId: { type: objectId, ref: 'Package' },
  riderTrackingId: { type: String, required: true },
  packageTrackingId: { type: String, required: true },
  publicTrackingTokenHash: { type: String, required: true, select: false },
  pickupSecretHash: { type: String, required: true, select: false },
  timeline: { type: [timelineSchema], default: [] },
  batchGroup: { type: String, index: true },
  failureReason: String,
  returnReason: String,
  assignedAt: Date,
  acceptedAt: Date,
  pickedUpAt: Date,
  atHubAt: Date,
  outForDeliveryAt: Date,
  deliveredAt: Date,
  failedAt: Date,
  returnedAt: Date,
  cancelledAt: Date,
  pickupVerifiedAt: Date,
  hubScannedAt: Date,
  merchantSentOffAt: Date,
});
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ hubId: 1, orderNumber: 1 });
OrderSchema.index({ riderTrackingId: 1 }, { unique: true });
OrderSchema.index({ packageTrackingId: 1 }, { unique: true });
OrderSchema.index({ hubId: 1, merchantId: 1, createdAt: -1 });
OrderSchema.index({ hubId: 1, driverId: 1, orderStatus: 1 });

const PackageSchema = tenantSchema({
  packageTrackingId: { type: String, required: true, uppercase: true },
  orderId: { type: objectId, ref: 'Order', required: true, index: true },
  description: { type: String, required: true },
  category: String,
  size: { type: String, enum: ['SMALL', 'MEDIUM', 'LARGE'], default: 'MEDIUM' },
  weightKg: { type: Number, min: 0 },
  fragile: { type: Boolean, default: false },
  gpsDeviceId: { type: objectId, ref: 'GPSDevice' },
  custodyStatus: { type: String, enum: ['AT_MERCHANT', 'WITH_PICKUP_AGENT', 'AT_HUB', 'WITH_DRIVER', 'DELIVERED', 'RETURNED', 'LOST'], default: 'AT_MERCHANT' },
  sealNumber: String,
  tamperedAt: Date,
});
PackageSchema.index({ packageTrackingId: 1 }, { unique: true });

const TrackingSchema = tenantSchema({
  entityType: { type: String, enum: ['DRIVER', 'PACKAGE'], required: true },
  entityId: { type: objectId, required: true, index: true },
  orderId: { type: objectId, ref: 'Order', index: true },
  location: { type: pointSchema, required: true },
  altitude: Number,
  speed: Number,
  heading: Number,
  accuracy: Number,
  battery: Number,
  signal: Number,
  recordedAt: { type: Date, required: true, default: Date.now },
  source: { type: String, enum: ['APP', 'GPS_DEVICE', 'PROVIDER_WEBHOOK'], required: true },
});
TrackingSchema.index({ location: '2dsphere' });
TrackingSchema.index({ hubId: 1, entityType: 1, entityId: 1, recordedAt: -1 });
TrackingSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const PaymentSchema = tenantSchema({
  paymentNumber: { type: String, required: true },
  orderId: { type: objectId, ref: 'Order', index: true },
  merchantId: { type: objectId, ref: 'Merchant', index: true },
  driverId: { type: objectId, ref: 'Driver', index: true },
  type: { type: String, enum: ['DELIVERY_FEE', 'COD', 'PAYOUT', 'REFUND', 'FINE', 'BONUS', 'REFERRAL'], required: true },
  amount: { type: Number, min: 0, required: true },
  currency: { type: String, default: 'UGX' },
  provider: String,
  providerReference: String,
  idempotencyKey: { type: String, required: true },
  paidAt: Date,
  failedAt: Date,
  failureReason: String,
});
PaymentSchema.index({ idempotencyKey: 1 }, { unique: true });
PaymentSchema.index({ provider: 1, providerReference: 1 }, { unique: true, sparse: true });

const CODSchema = tenantSchema({
  orderId: { type: objectId, ref: 'Order', required: true, index: true },
  driverId: { type: objectId, ref: 'Driver', required: true, index: true },
  merchantId: { type: objectId, ref: 'Merchant', required: true, index: true },
  amount: { type: Number, min: 0, required: true },
  serviceFee: { type: Number, min: 0, required: true },
  merchantPayout: { type: Number, min: 0, required: true },
  businessDate: { type: String, required: true },
  collectedAt: Date,
  reconciledAt: Date,
  paidOutAt: Date,
  reconciliationNote: String,
});
CODSchema.index({ hubId: 1, driverId: 1, status: 1, businessDate: 1 });

const NotificationSchema = tenantSchema({
  recipientType: { type: String, enum: ['USER', 'MERCHANT', 'DRIVER', 'CUSTOMER', 'HUB', 'HQ'], required: true },
  recipientId: { type: objectId, index: true },
  orderId: { type: objectId, ref: 'Order' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  channels: { type: [String], default: ['IN_APP'] },
  priority: { type: String, enum: ['NORMAL', 'HIGH', 'CRITICAL'], default: 'NORMAL' },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  readAt: Date,
  sentAt: Date,
  deliveryErrors: { type: [String], default: [] },
});
NotificationSchema.index({ hubId: 1, recipientId: 1, readAt: 1, createdAt: -1 });

const IncidentSchema = tenantSchema({
  incidentNumber: { type: String, required: true },
  type: { type: String, enum: ['ACCIDENT', 'THEFT', 'MECHANICAL_FAILURE', 'POLICE_STOP', 'PACKAGE_DAMAGE', 'BROKEN_SEAL', 'LOST_PACKAGE', 'OTHER'], required: true },
  driverId: { type: objectId, ref: 'Driver', index: true },
  orderId: { type: objectId, ref: 'Order', index: true },
  packageId: { type: objectId, ref: 'Package' },
  description: { type: String, required: true },
  location: pointSchema,
  photos: { type: [mediaSchema], default: [] },
  liability: { type: String, enum: ['UNDETERMINED', 'MERCHANT', 'WOLAN', 'DRIVER'], default: 'UNDETERMINED' },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  resolution: String,
});
IncidentSchema.index({ hubId: 1, incidentNumber: 1 }, { unique: true });

const RatingSchema = tenantSchema({
  orderId: { type: objectId, ref: 'Order', required: true, index: true },
  targetType: { type: String, enum: ['DRIVER', 'MERCHANT', 'SERVICE'], required: true },
  targetId: { type: objectId },
  customerId: { type: objectId, ref: 'Customer' },
  score: { type: Number, min: 1, max: 5, required: true },
  comment: String,
});
RatingSchema.index({ orderId: 1, targetType: 1 }, { unique: true });

const OTPSchema = tenantSchema({
  purpose: { type: String, enum: ['DELIVERY', 'LOGIN', 'PASSWORD_RESET', 'PHONE_VERIFICATION'], required: true },
  recipient: { type: String, required: true },
  codeHash: { type: String, required: true, select: false },
  entityId: objectId,
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  expiresAt: { type: Date, required: true },
  consumedAt: Date,
});
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SettingSchema = tenantSchema({ key: { type: String, required: true }, value: mongoose.Schema.Types.Mixed, description: String });
SettingSchema.index({ hubId: 1, key: 1, deletedAt: 1 }, { unique: true });

const ReportSchema = tenantSchema({
  type: { type: String, required: true },
  format: { type: String, enum: ['JSON', 'CSV', 'XLSX', 'PDF'], required: true },
  filters: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  file: mediaSchema,
  generatedAt: Date,
  expiresAt: Date,
});

const ReferralSchema = tenantSchema({
  referrerMerchantId: { type: objectId, ref: 'Merchant', required: true },
  referredMerchantId: { type: objectId, ref: 'Merchant', required: true },
  referralCode: { type: String, required: true },
  rewardPerDelivery: { type: Number, default: 50 },
  qualifiedDeliveries: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 },
});
ReferralSchema.index({ referrerMerchantId: 1, referredMerchantId: 1 }, { unique: true });

const VehicleSchema = tenantSchema({
  driverId: { type: objectId, ref: 'Driver', index: true },
  type: { type: String, enum: ['MOTORCYCLE', 'CAR', 'VAN', 'BICYCLE'], required: true },
  make: String,
  model: String,
  plateNumber: { type: String, required: true, uppercase: true },
  color: String,
  logbook: mediaSchema,
});
VehicleSchema.index({ plateNumber: 1 }, { unique: true });

const GPSDeviceSchema = tenantSchema({
  serialNumber: { type: String, required: true, uppercase: true },
  imei: { type: String, required: true },
  provider: { type: String, required: true },
  deviceType: { type: String, enum: ['RIDER', 'PACKAGE'], required: true },
  assignedEntityId: objectId,
  lastLocation: pointSchema,
  lastHeartbeatAt: Date,
  battery: Number,
  signal: Number,
  tamperedAt: Date,
});
GPSDeviceSchema.index({ serialNumber: 1 }, { unique: true });
GPSDeviceSchema.index({ imei: 1 }, { unique: true });

const ZoneSchema = tenantSchema({
  code: { type: String, required: true, uppercase: true },
  name: { type: String, required: true },
  boundary: { type: { type: String, enum: ['Polygon'], required: true }, coordinates: { type: [[[Number]]], required: true } },
  deliveryFee: { type: Number, min: 0, default: 0 },
});
ZoneSchema.index({ boundary: '2dsphere' });
ZoneSchema.index({ hubId: 1, code: 1 }, { unique: true });

const AuditLogSchema = tenantSchema({
  actorId: { type: objectId, ref: 'User', index: true },
  actorRole: String,
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true, index: true },
  resourceId: objectId,
  requestId: String,
  ip: String,
  userAgent: String,
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed,
});
AuditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function preventAuditDeletion() { throw new Error('Audit logs are append-only'); });
AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function preventAuditUpdate() { throw new Error('Audit logs are append-only'); });
AuditLogSchema.pre('save', function preventAuditSave(next) { if (!this.isNew) return next(new Error('Audit logs are append-only')); return next(); });

const SessionSchema = tenantSchema({
  userId: { type: objectId, ref: 'User', required: true, index: true },
  refreshTokenHash: { type: String, required: true, select: false },
  familyId: { type: String, required: true, index: true },
  userAgent: String,
  ip: String,
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  replacedBySessionId: { type: objectId, ref: 'Session' },
});
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CustomerSchema = tenantSchema({
  name: { type: String, required: true }, phone: { type: String, required: true }, email: String, defaultAddress: addressSchema,
  orderCount: { type: Number, default: 0 }, totalSpend: { type: Number, default: 0 }, lastOrderAt: Date,
});
CustomerSchema.index({ hubId: 1, phone: 1 }, { unique: true });

const DeliveryProofSchema = tenantSchema({
  orderId: { type: objectId, ref: 'Order', required: true, unique: true },
  driverId: { type: objectId, ref: 'Driver', required: true },
  photos: { type: [mediaSchema], required: true },
  otpId: { type: objectId, ref: 'OTP', required: true },
  recipientName: String,
  location: pointSchema,
  deliveredAt: { type: Date, required: true },
});

const CustodyEventSchema = tenantSchema({
  orderId: { type: objectId, ref: 'Order', required: true, index: true }, packageId: { type: objectId, ref: 'Package', required: true },
  fromType: String, fromId: objectId, toType: { type: String, required: true }, toId: objectId,
  scanCode: String, location: pointSchema, occurredAt: { type: Date, default: Date.now },
});

const LocationSchema = tenantSchema({
  driverId: { type: objectId, ref: 'Driver', index: true }, packageId: { type: objectId, ref: 'Package', index: true }, orderId: { type: objectId, ref: 'Order', index: true },
  location: { type: pointSchema, required: true }, speed: Number, heading: Number, battery: Number, signal: Number,
  recordedAt: { type: Date, default: Date.now, index: true },
});
LocationSchema.index({ location: '2dsphere' });

const FinePenaltySchema = tenantSchema({ driverId: { type: objectId, ref: 'Driver', required: true, index: true }, orderId: { type: objectId, ref: 'Order' }, type: String, reason: { type: String, required: true }, amount: { type: Number, min: 0, required: true }, deductedFrom: { type: String, enum: ['BOND', 'COMMISSION', 'EARNINGS'] }, appliedAt: Date });
const DriverEarningSchema = tenantSchema({ driverId: { type: objectId, ref: 'Driver', required: true, index: true }, orderId: { type: objectId, ref: 'Order' }, type: { type: String, enum: ['DELIVERY', 'BONUS', 'ADJUSTMENT'], required: true }, amount: { type: Number, required: true }, businessDate: { type: String, required: true } });
const PayoutSchema = tenantSchema({ merchantId: { type: objectId, ref: 'Merchant', required: true, index: true }, amount: { type: Number, min: 0, required: true }, currency: { type: String, default: 'UGX' }, paymentIds: { type: [objectId], default: [] }, providerReference: String, scheduledFor: Date, processedAt: Date, failureReason: String });
const KYCDocumentSchema = tenantSchema({ ownerType: { type: String, enum: ['MERCHANT', 'DRIVER'], required: true }, ownerId: { type: objectId, required: true, index: true }, documentType: { type: String, required: true }, document: { type: mediaSchema, required: true }, verifiedAt: Date, rejectedAt: Date, rejectionReason: String });
const SecurityAlertSchema = tenantSchema({ type: { type: String, enum: ['DRIVER_DARK', 'BROKEN_SEAL', 'PACKAGE_MISMATCH', 'COD_LIMIT', 'GPS_TAMPER', 'CHAIN_OF_CUSTODY'], required: true }, severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true }, driverId: { type: objectId, ref: 'Driver' }, orderId: { type: objectId, ref: 'Order' }, packageId: { type: objectId, ref: 'Package' }, details: mongoose.Schema.Types.Mixed, acknowledgedAt: Date, resolvedAt: Date });
const SupportTicketSchema = tenantSchema({ merchantId: { type: objectId, ref: 'Merchant', index: true }, subject: { type: String, required: true }, message: { type: String, required: true }, priority: { type: String, enum: ['NORMAL', 'HIGH', 'CRITICAL'], default: 'NORMAL' }, assignedTo: { type: objectId, ref: 'User' }, resolvedAt: Date });
const RelayTransferSchema = tenantSchema({ orderId: { type: objectId, ref: 'Order', required: true }, packageId: { type: objectId, ref: 'Package', required: true }, sourceHubId: { type: String, required: true }, destinationHubId: { type: String, required: true }, requestedBy: { type: objectId, ref: 'User' }, acceptedBy: { type: objectId, ref: 'User' }, requestedAt: Date, acceptedAt: Date, transferredAt: Date, receivedAt: Date });
const OutboxEventSchema = tenantSchema({ eventId: { type: String, required: true }, eventType: { type: String, required: true, index: true }, aggregateType: { type: String, required: true }, aggregateId: { type: objectId, required: true }, payload: { type: mongoose.Schema.Types.Mixed, required: true }, availableAt: { type: Date, default: Date.now }, processedAt: Date, attempts: { type: Number, default: 0 }, lastError: String });
OutboxEventSchema.index({ eventId: 1 }, { unique: true });
OutboxEventSchema.index({ processedAt: 1, availableAt: 1 });
const IdempotencyKeySchema = tenantSchema({ key: { type: String, required: true }, actorId: { type: objectId, required: true }, requestHash: { type: String, required: true }, responseStatus: Number, responseBody: mongoose.Schema.Types.Mixed, expiresAt: { type: Date, required: true } });
IdempotencyKeySchema.index({ hubId: 1, actorId: 1, key: 1 }, { unique: true });
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Role = defineModel('Role', RoleSchema, 'roles');
export const User = defineModel('User', UserSchema, 'users');
export const Hub = defineModel('Hub', HubSchema, 'hubs');
export const Merchant = defineModel('Merchant', MerchantSchema, 'merchants');
export const Driver = defineModel('Driver', DriverSchema, 'drivers');
export const Rider = Driver;
export const Order = defineModel('Order', OrderSchema, 'orders');
export const Package = defineModel('Package', PackageSchema, 'packages');
export const Tracking = defineModel('Tracking', TrackingSchema, 'tracking');
export const Payment = defineModel('Payment', PaymentSchema, 'payments');
export const COD = defineModel('COD', CODSchema, 'cod');
export const Notification = defineModel('Notification', NotificationSchema, 'notifications');
export const Incident = defineModel('Incident', IncidentSchema, 'incidents');
export const Rating = defineModel('Rating', RatingSchema, 'ratings');
export const OTP = defineModel('OTP', OTPSchema, 'otps');
export const Setting = defineModel('Setting', SettingSchema, 'settings');
export const Report = defineModel('Report', ReportSchema, 'reports');
export const Referral = defineModel('Referral', ReferralSchema, 'referrals');
export const Vehicle = defineModel('Vehicle', VehicleSchema, 'vehicles');
export const GPSDevice = defineModel('GPSDevice', GPSDeviceSchema, 'gpsdevices');
export const PackageTracker = GPSDevice;
export const Zone = defineModel('Zone', ZoneSchema, 'zones');
export const AuditLog = defineModel('AuditLog', AuditLogSchema, 'auditlogs');
export const Session = defineModel('Session', SessionSchema, 'sessions');
export const Customer = defineModel('Customer', CustomerSchema, 'customers');
export const DeliveryProof = defineModel('DeliveryProof', DeliveryProofSchema, 'deliveryproofs');
export const CustodyEvent = defineModel('CustodyEvent', CustodyEventSchema, 'custodyevents');
export const DriverLocation = defineModel('DriverLocation', LocationSchema.clone(), 'driverlocations');
export const RiderLocation = DriverLocation;
export const PackageLocation = defineModel('PackageLocation', LocationSchema.clone(), 'packagelocations');
export const FinePenalty = defineModel('FinePenalty', FinePenaltySchema, 'finepenalties');
export const DriverEarning = defineModel('DriverEarning', DriverEarningSchema, 'driverearnings');
export const Payout = defineModel('Payout', PayoutSchema, 'payouts');
export const KYCDocument = defineModel('KYCDocument', KYCDocumentSchema, 'kycdocuments');
export const SecurityAlert = defineModel('SecurityAlert', SecurityAlertSchema, 'securityalerts');
export const SupportTicket = defineModel('SupportTicket', SupportTicketSchema, 'supporttickets');
export const RelayTransfer = defineModel('RelayTransfer', RelayTransferSchema, 'relaytransfers');
export const OutboxEvent = defineModel('OutboxEvent', OutboxEventSchema, 'outboxevents');
export const IdempotencyKey = defineModel('IdempotencyKey', IdempotencyKeySchema, 'idempotencykeys');

export const SHARED_MODELS = Object.freeze({ Role, User, Hub, Merchant, Driver, Rider, Order, Package, Tracking, Payment, COD, Notification, Incident, Rating, OTP, Setting, Report, Referral, Vehicle, GPSDevice, PackageTracker, Zone, AuditLog, Session, Customer, DeliveryProof, CustodyEvent, DriverLocation, RiderLocation, PackageLocation, FinePenalty, DriverEarning, Payout, KYCDocument, SecurityAlert, SupportTicket, RelayTransfer, OutboxEvent, IdempotencyKey });

export { addressSchema, auditFields, mediaSchema, pointSchema, schemaOptions, tenantSchema } from './base.js';
export { GLOBAL_HUB_ID, ROLES };
