import { config, requireAgentTokens, requireEmbedToken } from '../config.js';
import { AgentClient } from '../clients/agent.js';
import { mintSession, sendTurn } from '../clients/widget.js';
import { delay, log, section } from '../util.js';

/**
 * Verifies cross-instance Redis Pub/Sub fan-out (invariant 9). Agent A connects to
 * chat-service instance 1, agent B to instance 2 (direct per-instance ports). Both
 * join the same conversation room; A claims and sends a message — persisted + relayed
 * on instance 1. B, on instance 2, must receive it through the Socket.IO Redis adapter.
 */
export async function run(): Promise<void> {
  section('Pub/Sub fan-out across instances');
  requireEmbedToken();
  requireAgentTokens(2);
  if (config.chatInstanceUrls.length < 2) {
    throw new Error('need 2 entries in CHAT_INSTANCE_URLS (one per chat-service instance).');
  }

  const sessionId = await mintSession();
  const turn = await sendTurn(sessionId, 'Fan-out across instances, please.');
  if (!turn.conversationId) throw new Error('widget turn produced no conversationId');
  const conversationId = turn.conversationId;

  const [url1, url2] = config.chatInstanceUrls;
  const agentA = new AgentClient(url1!, config.agentTokens[0]!);
  const agentB = new AgentClient(url2!, config.agentTokens[1]!);
  await Promise.all([agentA.connect(), agentB.connect()]);
  log(`agent A → ${url1}, agent B → ${url2}`);

  let bReceived = false;
  agentB.onEvent((e) => {
    if (e.type === 'message_appended' && e.message.conversationId === conversationId) {
      bReceived = true;
      log('agent B (instance 2) received the message_appended broadcast');
    }
  });

  await agentA.join(conversationId);
  await agentB.join(conversationId);

  const claim = await agentA.claim(conversationId);
  if (!claim.ok) throw new Error(`claim failed: ${claim.reason}`);

  const sent = await agentA.send(conversationId, 'Hello from agent A on instance 1.');
  if (!sent.ok) throw new Error(`agent A message rejected: ${sent.reason}`);

  await delay(1_000);
  agentA.disconnect();
  agentB.disconnect();

  if (!bReceived) {
    throw new Error('agent B never received the message — cross-instance fan-out failed');
  }
  log('PASS: a message on instance 1 reached an agent on instance 2 via the Redis adapter');
}
