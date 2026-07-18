import http from 'node:http';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { configureMerchantSockets } from './sockets/index.js';

const server = http.createServer(app);
const sockets = await configureMerchantSockets(server, env);
globalThis.wolanMerchantPublisher = sockets.publish;

async function start() {
  await connectDatabase();
  server.listen(env.port, () => console.log(`Wolan Merchant API listening on port ${env.port}`));
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  await sockets.close();
  await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
start().catch((error) => { console.error('Merchant API startup failed', error); process.exit(1); });
