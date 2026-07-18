import mongoose from 'mongoose';
import { ACTIVE_STATUS, SYSTEM_ACTOR_ID } from '../constants/index.js';

export const auditFields = Object.freeze({
  hubId: { type: String, required: true, trim: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, default: SYSTEM_ACTOR_ID, index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, default: SYSTEM_ACTOR_ID },
  deletedAt: { type: Date, default: null, index: true },
  status: { type: String, required: true, default: ACTIVE_STATUS, trim: true, index: true },
});

export const schemaOptions = Object.freeze({
  timestamps: true,
  versionKey: false,
  strict: 'throw',
  minimize: false,
  toJSON: { virtuals: true, transform: (_document, value) => { delete value.passwordHash; delete value.pinHash; delete value.refreshTokenHash; return value; } },
  toObject: { virtuals: true },
});

export const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (coordinates) => coordinates.length === 2 && coordinates[0] >= -180 && coordinates[0] <= 180 && coordinates[1] >= -90 && coordinates[1] <= 90,
      message: 'Coordinates must be [longitude, latitude]',
    },
  },
}, { _id: false });

export const addressSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: { type: String, required: true, trim: true },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  instructions: String,
  location: pointSchema,
  scheduledAt: Date,
}, { _id: false });

export const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: String,
  resourceType: { type: String, default: 'image' },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

export function tenantSchema(fields = {}, options = {}) {
  const schema = new mongoose.Schema({ ...auditFields, ...fields }, { ...schemaOptions, ...options });
  schema.index({ hubId: 1, deletedAt: 1, status: 1, createdAt: -1 });
  return schema;
}

export function defineModel(name, schema, collection) {
  return mongoose.models[name] ?? mongoose.model(name, schema, collection);
}
