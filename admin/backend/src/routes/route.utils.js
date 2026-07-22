import { objectIdSchema } from '@wolan/shared/validation';
import { z } from 'zod';

export const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const idParams = z.object({ id: objectIdSchema }).strict();
export const flexibleBody = z.record(z.string(), z.unknown());
