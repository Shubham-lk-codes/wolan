import api from './api';
import axios from 'axios';

const title = value => String(value || 'PENDING').toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const normalizeOrder = payload => {
  const item = payload?.order ?? payload;
  if (!item) return item;
  return {
    ...item,
    publicTrackingToken: payload?.publicTrackingToken,
    id: item._id,
    orderNumber: item.orderNumber,
    merchant: item.merchantId?.businessName || item.merchantId?.shopName || item.merchantId?.merchantCode || item.merchantId,
    customer: item.customer?.name,
    phone: item.customer?.phone,
    address: item.delivery?.address,
    zone: item.delivery?.zoneId || 'Unzoned',
    value: item.declaredValue,
    fee: item.pricing?.total,
    payment: item.paymentMethod,
    rider: item.driverId?.name || null,
    riderId: item.driverId?._id || item.driverId || null,
    status: title(item.orderStatus),
    pickupVerified: Boolean(item.pickupVerifiedAt),
    hubScanned: Boolean(item.hubScannedAt),
    timeline: (item.timeline || []).map(event => ({ ...event, label: event.note || title(event.status), at: event.at })),
  };
};

export const orderService = {
  async list(params={}, signal) { const requestParams={search:params.search||params.q||undefined,orderStatus:params.status&&params.status!=='All'?String(params.status).toUpperCase().replaceAll(' ','_'):params.orderStatus,merchantId:params.merchantId||params.merchant||undefined,driverId:params.driverId||params.rider||undefined}; for(const key of Object.keys(requestParams)){if(!requestParams[key]||requestParams[key]==='Unassigned'||(key.endsWith('Id')&&!/^[a-f\d]{24}$/i.test(requestParams[key])))delete requestParams[key];} const { data } = await api.get('/orders', { params: requestParams, signal }); return (data?.items || data || []).map(normalizeOrder); },
  async create(payload) { const { data } = await api.post('/orders', payload); return normalizeOrder(data); },
  async quote(payload) { const { data } = await api.post('/orders/quote', payload); return data; },
  async verifyPickup(id, key) { const { data } = await api.patch(`/orders/${encodeURIComponent(id)}/verify-pickup`, { key }); return normalizeOrder(data); },
  async scanAtHub(id, code) { const { data } = await api.patch(`/orders/${encodeURIComponent(id)}/scan`, { code }); return normalizeOrder(data); },
  async assignRider(id, rider) { const { data } = await api.patch(`/orders/${encodeURIComponent(id)}/assign`, { driverId: rider._id || rider.id || rider }); return normalizeOrder(data); },
  async complete(id, otp) { const { data } = await api.patch(`/orders/${encodeURIComponent(id)}/complete`, { otp }); return normalizeOrder(data); },
  async setStatus(id, status, note) { const apiStatus = String(status).trim().toUpperCase().replaceAll(' ', '_'); const { data } = await api.patch(`/orders/${encodeURIComponent(id)}/status`, { status: apiStatus, note }); return normalizeOrder(data); },
  async updateLocation(id, location) { const { data } = await api.patch(`/orders/${encodeURIComponent(id)}/location`, location); return data; },
  async track(token, signal) { const baseURL = import.meta.env.VITE_PUBLIC_API_URL || '/api/v1/public'; const response = await axios.get(`${baseURL}/tracking/${encodeURIComponent(token)}`, { signal, timeout: 12_000 }); return normalizeOrder(response.data?.data || response.data); },
};
