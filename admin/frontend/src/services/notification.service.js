import api from './api';

const bulkRecipientTypes = { Merchants: 'MERCHANT', Riders: 'DRIVER', Customers: 'CUSTOMER' };

export const notificationService = {
  async list(params = {}, signal) {
    const { data } = await api.get('/notifications', { params: { limit: 100, ...params }, signal });
    return data?.items || data || [];
  },
  async unreadCount(signal) {
    const { data } = await api.get('/notifications/unread-count', { signal });
    return data?.count || 0;
  },
  async send(payload) {
    const recipientType = payload.recipientType === 'user' ? 'USER' : bulkRecipientTypes[payload.recipientGroup] || 'HQ';
    const body = {
      recipientType,
      ...(payload.recipientId ? { recipientId: payload.recipientId } : {}),
      title: payload.title,
      message: payload.message,
      channels: [String(payload.channel || 'IN_APP').toUpperCase().replaceAll('-', '_')],
      priority: String(payload.priority || 'NORMAL').toUpperCase(),
      metadata: { recipientGroup: payload.recipientGroup, category: payload.category },
    };
    const { data } = await api.post('/notifications', body);
    return data;
  },
  async markRead(id) {
    const { data } = await api.patch(`/notifications/${encodeURIComponent(id)}/read`);
    return data;
  },
  async markAllRead() {
    const { data } = await api.patch('/notifications/read-all');
    return data;
  },
  async remove(id) { await api.delete(`/notifications/${encodeURIComponent(id)}`); },
};
