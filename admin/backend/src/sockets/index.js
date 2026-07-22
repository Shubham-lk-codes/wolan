import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import { SOCKET_EVENTS, socketRooms } from '@wolan/shared/events';
import { normalizeRole } from '@wolan/shared/constants';
import { User } from '@wolan/shared/models';

export function notificationRooms(payload) {
  const rooms = new Set([socketRooms.hq()]);
  if (!payload.channels?.includes('IN_APP')) return [...rooms];
  if (payload.recipientType === 'USER' && payload.recipientId) rooms.add(socketRooms.user(payload.recipientId));
  else if (payload.recipientType === 'MERCHANT') rooms.add(payload.recipientId ? socketRooms.merchant(payload.recipientId) : socketRooms.role('MERCHANT'));
  else if (payload.recipientType === 'DRIVER') rooms.add(payload.recipientId ? socketRooms.driver(payload.recipientId) : socketRooms.role('DRIVER'));
  else if (payload.recipientType === 'HUB' && payload.hubId) rooms.add(socketRooms.hub(payload.hubId));
  else if (payload.recipientType !== 'HQ' && payload.hubId) rooms.add(socketRooms.hub(payload.hubId));
  return [...rooms];
}

export async function configureSockets(httpServer, env) {
  const io = new Server(httpServer, { cors: { origin: env.corsOrigins, credentials: true } });
  let redisClients = [];
  if (env.redisUrl) {
    const publisher = new IORedis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
    const subscriber = publisher.duplicate();
    let redisWarningShown = false;
    const handleRedisError = (error) => {
      if (redisWarningShown) return;
      redisWarningShown = true;
      console.warn(`Admin realtime Redis is unavailable (${error.message}); set REDIS_URL= to run without the shared adapter.`);
    };
    publisher.on('error', handleRedisError);
    subscriber.on('error', handleRedisError);
    io.adapter(createAdapter(publisher, subscriber));
    redisClients = [publisher, subscriber];
  }
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, env.jwtAccessSecret, { issuer: env.jwtIssuer, audience: env.jwtAudience });
      if (payload.typ !== 'access') throw new Error('Unauthorized');
      const user = await User.findOne({ _id: payload.sub, deletedAt: null, status: 'ACTIVE' }).select('+tokenVersion');
      if (!user || user.tokenVersion !== payload.ver) throw new Error('Unauthorized');
      user.role = normalizeRole(user.role);
      socket.data.user = user;
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(socketRooms.user(user._id));
    socket.join(socketRooms.role(user.role));
    for (const hubId of new Set([user.hubId, ...(user.assignedHubIds ?? [])].filter(Boolean))) socket.join(socketRooms.hub(hubId));
    if (['SUPER_ADMIN', 'DIRECTOR'].includes(user.role)) socket.join(socketRooms.hq());
  });
  return {
    publish: async (event, payload) => {
      if (event === SOCKET_EVENTS.NEW_NOTIFICATION) {
        io.to(notificationRooms(payload)).emit(event, payload);
        return;
      }
      if (payload.hubId) io.to(socketRooms.hub(payload.hubId)).emit(event, payload);
      if (payload.orderId) io.to(socketRooms.order(payload.orderId)).emit(event, payload);
      io.to(socketRooms.hq()).emit(event, payload);
    },
    close: async () => { await new Promise((resolve) => io.close(resolve)); await Promise.all(redisClients.map((client) => client.quit())); },
  };
}
