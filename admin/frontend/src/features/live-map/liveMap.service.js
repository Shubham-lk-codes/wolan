import api from '../../services/api';

export const liveMapService = {
  async snapshot(signal) {
    const { data } = await api.get('/live-map', { signal });
    return data;
  },
};
