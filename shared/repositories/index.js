import mongoose from 'mongoose';
import { SYSTEM_ACTOR_ID } from '../constants/index.js';
import { AppError, escapeRegex, paginationMeta, parsePagination } from '../utils/index.js';

export class BaseRepository {
  constructor(model, options = {}) {
    this.model = model;
    this.searchFields = options.searchFields ?? [];
    this.filterFields = new Set(options.filterFields ?? ['status']);
    this.sortFields = new Set(options.sortFields ?? ['createdAt', 'updatedAt', 'status']);
    this.populates = options.populates ?? [];
  }

  scopedFilter(scope, filter = {}, { includeDeleted = false } = {}) {
    if (filter.hubId !== undefined) throw new AppError('hubId is controlled by the authorization scope', 400, 'UNSAFE_TENANT_FILTER');
    return { ...scope, ...(includeDeleted ? {} : { deletedAt: null }), ...filter };
  }

  async findById(id, scope, options = {}) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid resource id', 400, 'INVALID_ID');
    let query = this.model.findOne(this.scopedFilter(scope, { _id: id }, options));
    for (const populate of this.populates) query = query.populate(populate);
    const document = await query;
    if (!document) throw new AppError(`${this.model.modelName} not found`, 404, 'NOT_FOUND');
    return document;
  }

  async list(scope, query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    for (const field of this.filterFields) {
      if (query[field] === undefined) continue;
      filter[field] = field === 'status' && typeof query[field] === 'string' ? query[field].trim().toUpperCase().replaceAll(' ', '_') : query[field];
    }
    if (query.search && this.searchFields.length) {
      const expression = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = this.searchFields.map((field) => ({ [field]: expression }));
    }
    const sortField = this.sortFields.has(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const scoped = this.scopedFilter(scope, filter);
    let itemsQuery = this.model.find(scoped).sort({ [sortField]: sortOrder, _id: sortOrder }).skip(skip).limit(limit);
    for (const populate of this.populates) itemsQuery = itemsQuery.populate(populate);
    const [items, total] = await Promise.all([
      itemsQuery,
      this.model.countDocuments(scoped),
    ]);
    return { items, meta: paginationMeta(total, page, limit) };
  }

  create(data, context = {}, session) {
    const payload = { ...data, hubId: context.hubId ?? data.hubId, createdBy: context.actorId ?? SYSTEM_ACTOR_ID, updatedBy: context.actorId ?? SYSTEM_ACTOR_ID };
    return this.model.create([payload], { session }).then(([document]) => document);
  }

  async updateById(id, scope, changes, context = {}, session) {
    const safeChanges = { ...changes };
    delete safeChanges.hubId;
    delete safeChanges.createdBy;
    delete safeChanges.deletedAt;
    const document = await this.model.findOneAndUpdate(
      this.scopedFilter(scope, { _id: id }),
      { $set: { ...safeChanges, updatedBy: context.actorId ?? null } },
      { new: true, runValidators: true, session },
    );
    if (!document) throw new AppError(`${this.model.modelName} not found`, 404, 'NOT_FOUND');
    return document;
  }

  async softDeleteById(id, scope, context = {}, session) {
    const document = await this.model.findOneAndUpdate(
      this.scopedFilter(scope, { _id: id }),
      { $set: { deletedAt: new Date(), status: 'DELETED', updatedBy: context.actorId ?? null } },
      { new: true, runValidators: true, session },
    );
    if (!document) throw new AppError(`${this.model.modelName} not found`, 404, 'NOT_FOUND');
    return document;
  }
}

export async function withTransaction(work, options = {}) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); }, options);
    return result;
  } finally {
    await session.endSession();
  }
}
