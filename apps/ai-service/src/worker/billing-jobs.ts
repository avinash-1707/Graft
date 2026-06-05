import { getOrgSubscription, listFreeTierOrgIds, upsertModelPricing, type Database } from '@graft/db';
import { fetchOpenRouterPricing, grantMonthlyForPlan } from '@graft/billing';
import type { Logger } from '@graft/observability';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';

export const BILLING_QUEUE = 'graft:billing' as const;
const PRICING_REFRESH_JOB = 'pricing-refresh';
const MONTHLY_GRANT_JOB = 'monthly-grant';

const DAILY_MS = 24 * 60 * 60 * 1000;

export interface BillingScheduler {
  close: () => Promise<void>;
}

/**
 * Runs the two billing background jobs on the ai-service worker process:
 *  - **pricing-refresh** (daily): pull OpenRouter model prices into `ai_model_pricing`
 *    so usage metering has current rates.
 *  - **monthly-grant** (daily): top up free-tier orgs with their tier's monthly allowance,
 *    idempotent per calendar month (paid tiers are granted via Dodo renewal webhooks).
 *
 * Repeatable jobs are registered with stable ids so re-registering on each boot does not
 * duplicate the schedule.
 */
export async function startBillingScheduler(args: {
  db: Database;
  connection: ConnectionOptions;
  logger: Logger;
}): Promise<BillingScheduler> {
  const { db, connection, logger } = args;
  const queue = new Queue(BILLING_QUEUE, { connection });

  await queue.add(
    PRICING_REFRESH_JOB,
    {},
    { repeat: { every: DAILY_MS }, jobId: PRICING_REFRESH_JOB, removeOnComplete: true, removeOnFail: 50 },
  );
  await queue.add(
    MONTHLY_GRANT_JOB,
    {},
    { repeat: { every: DAILY_MS }, jobId: MONTHLY_GRANT_JOB, removeOnComplete: true, removeOnFail: 50 },
  );
  // Run a pricing refresh once on boot so a fresh deployment has rates immediately.
  await queue.add(`${PRICING_REFRESH_JOB}:boot`, {}, { removeOnComplete: true, removeOnFail: 50 });

  const worker = new Worker(
    BILLING_QUEUE,
    async (job) => {
      if (job.name.startsWith(PRICING_REFRESH_JOB)) {
        const rows = await fetchOpenRouterPricing();
        await upsertModelPricing(db, rows);
        logger.info({ count: rows.length }, 'model pricing refreshed');
        return;
      }
      if (job.name === MONTHLY_GRANT_JOB) {
        const month = new Date().toISOString().slice(0, 7); // YYYY-MM
        const orgIds = await listFreeTierOrgIds(db);
        for (const organizationId of orgIds) {
          const sub = await getOrgSubscription(db, organizationId);
          await grantMonthlyForPlan(db, {
            organizationId,
            plan: sub.plan,
            idempotencyKey: `grant:${organizationId}:${month}`,
          });
        }
        logger.info({ count: orgIds.length, month }, 'free-tier monthly grants applied');
      }
    },
    { connection },
  );
  worker.on('error', (err) => logger.error({ err }, 'billing worker error'));
  worker.on('failed', (job, err) => logger.error({ err, job: job?.name }, 'billing job failed'));

  return {
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
