import { run as claimContention } from './scenarios/claim-contention.js';
import { run as pubsubFanout } from './scenarios/pubsub-fanout.js';
import { run as sseWsSwitch } from './scenarios/sse-ws-switch.js';
import { log } from './util.js';

const scenarios: Record<string, () => Promise<void>> = {
  'sse-ws-switch': sseWsSwitch,
  'claim-contention': claimContention,
  'pubsub-fanout': pubsubFanout,
};

async function main(): Promise<void> {
  const name = process.argv[2];
  const scenario = name ? scenarios[name] : undefined;
  if (!scenario) {
    console.error(`usage: pnpm --filter @graft/load-test load <scenario>`);
    console.error(`scenarios: ${Object.keys(scenarios).join(', ')}`);
    process.exit(1);
  }

  try {
    await scenario();
    log('scenario complete');
    process.exit(0);
  } catch (err) {
    console.error('scenario FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
