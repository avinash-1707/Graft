import { config, requireAgentTokens, requireEmbedToken } from '../config.js';
import { AgentClient } from '../clients/agent.js';
import { mintSession, sendTurn } from '../clients/widget.js';
import { log, section } from '../util.js';

/**
 * Races every configured agent to claim the SAME conversation simultaneously. The
 * atomic compare-and-set (invariant 2) must let exactly one win; the rest get
 * ALREADY_CLAIMED. A fresh widget turn seeds an AI_ACTIVE conversation, which is
 * claimable as a proactive takeover.
 */
export async function run(): Promise<void> {
  section('Claim contention');
  requireEmbedToken();
  requireAgentTokens(2);

  const sessionId = await mintSession();
  const turn = await sendTurn(sessionId, 'I really need to talk to someone.');
  if (!turn.conversationId) throw new Error('widget turn produced no conversationId');
  const conversationId = turn.conversationId;
  log(`target conversation ${conversationId}; ${config.agentTokens.length} agents racing`);

  const agents = config.agentTokens.map((token) => new AgentClient(config.chatUrl, token));
  await Promise.all(agents.map((a) => a.connect()));

  // Fire all claims as close to simultaneously as possible.
  const results = await Promise.all(agents.map((a) => a.claim(conversationId)));
  agents.forEach((a) => a.disconnect());

  const wins = results.filter((r) => r.ok).length;
  const reasons = results.map((r) => (r.ok ? 'WIN' : r.reason));
  log(`results: ${wins} win / ${results.length - wins} loss`, reasons);

  if (wins !== 1) throw new Error(`expected exactly 1 winner, got ${wins}`);
  log('PASS: exactly one agent won; the atomic claim CAS held under contention');
}
