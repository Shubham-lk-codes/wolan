import { OutboxService } from '@wolan/shared/services';

export async function startOutboxJob({ eventPublisher, intervalMs = 5_000 }) {
  const outbox = new OutboxService({ eventPublisher });
  await outbox.drain({ limit: 500 });
  const timer = setInterval(() => {
    outbox.drain({ limit: 100 }).catch((error) => console.error('Outbox drain failed', error));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
