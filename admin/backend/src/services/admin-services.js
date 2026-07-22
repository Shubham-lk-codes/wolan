import {
  AdminPortalService,
  NotificationService,
  OrderService,
  PublicPortalService,
  TrackingService,
  UploadService,
} from '@wolan/shared/services';
import { cloudinaryUploadProvider } from './upload-provider.js';

const publish = async (event, payload) => globalThis.wolanEventPublisher?.(event, payload);

export const adminPortal = new AdminPortalService();
export const notificationService = new NotificationService({ eventPublisher: publish });
export const orderService = new OrderService({ eventPublisher: publish });
export const publicPortal = new PublicPortalService();
export const trackingService = new TrackingService({ eventPublisher: publish });
export const uploadService = new UploadService(cloudinaryUploadProvider);
