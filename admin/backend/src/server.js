import http from 'node:http';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { configureSockets } from './sockets/index.js';
import { startOutboxJob } from './jobs/outbox.job.js';

const server = http.createServer(app);
const sockets = await configureSockets(server, env);
globalThis.wolanEventPublisher = sockets.publish;
let stopOutboxJob;

async function start() {
  await connectDatabase();
  stopOutboxJob = await startOutboxJob({ eventPublisher: sockets.publish });
  server.listen(env.port, () => console.log(`Wolan Admin API listening on port ${env.port}`));
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  stopOutboxJob?.();
  await sockets.close();
  await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
start().catch((error) => { console.error('Admin API startup failed', error); process.exit(1); });
