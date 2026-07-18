import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import { socketRooms } from '@wolan/shared/events';
import { User } from '@wolan/shared/models';

export async function configureMerchantSockets(httpServer, env) {
  const io = new Server(httpServer, { cors: { origin: env.corsOrigins, credentials: true } });
  const redisClients = [];
  if (env.redisUrl) {
    const publisher = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
    const subscriber = publisher.duplicate();
    let redisWarningShown = false;
    const handleRedisError = (error) => {
      if (redisWarningShown) return;
      redisWarningShown = true;
      console.warn(`Merchant realtime Redis is unavailable (${error.message}); set REDIS_URL= to run without the shared adapter.`);
    };
    publisher.on('error', handleRedisError);
    subscriber.on('error', handleRedisError);
    io.adapter(createAdapter(publisher, subscriber));
    redisClients.push(publisher, subscriber);
  }
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, env.jwtAccessSecret, { issuer: env.jwtIssuer, audience: env.jwtAudience });
      if (payload.typ !== 'access') throw new Error('Unauthorized');
      const user = await User.findOne({ _id: payload.sub, role: 'MERCHANT', deletedAt: null, status: 'ACTIVE' }).select('+tokenVersion');
      if (!user || user.tokenVersion !== payload.ver) throw new Error('Unauthorized');
      socket.data.user = user;
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  io.on('connection', (socket) => {
    socket.join(socketRooms.hub(socket.data.user.hubId));
    socket.join(socketRooms.role('MERCHANT'));
    socket.join(socketRooms.merchant(socket.data.user.merchantId));
  });
  return {
    publish: async (event, payload) => {
      if (payload.hubId) io.to(socketRooms.hub(payload.hubId)).emit(event, payload);
      if (payload.merchantId) io.to(socketRooms.merchant(payload.merchantId)).emit(event, payload);
      if (payload.orderId) io.to(socketRooms.order(payload.orderId)).emit(event, payload);
    },
    close: async () => {
      await new Promise((resolve) => io.close(resolve));
      await Promise.all(redisClients.map((client) => client.quit()));
    },
  };
}
