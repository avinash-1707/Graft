import { config, requireAgentTokens, requireEmbedToken } from '../config.js';
import { AgentClient } from '../clients/agent.js';
import { mintSession, sendTurn } from '../clients/widget.js';
import { delay, log, section } from '../util.js';

/**
 * Exercises the full transport switch over one conversation:
 * customer SSE turn → agent claim (WS) → agent message (AGENT_ASSIGNED → HUMAN_ACTIVE,
 * transport switch to WS) → handback (HUMAN_ACTIVE → AI_ACTIVE, switch back to SSE).
 * The agent socket is in the room, so it observes the `transport_switch` broadcasts.
 */
export async function run(): Promise<void> {
  section('SSE ↔ WS switch');
  requireEmbedToken();
  requireAgentTokens(1);

  const sessionId = await mintSession();
  const turn = await sendTurn(sessionId, 'Hello, can someone help me?');
  if (!turn.conversationId) throw new Error('widget turn produced no conversationId');
  log(`customer SSE turn complete (${turn.aiTokens} ai tokens)`, turn.conversationId);

  const agent = new AgentClient(config.chatUrl, config.agentTokens[0]!);
  await agent.connect();

  let switches = 0;
  agent.onEvent((e) => {
    if (e.type === 'transport_switch') {
      switches += 1;
      log('observed transport_switch', e.to);
    }
  });

  const claim = await agent.claim(turn.conversationId);
  if (!claim.ok) throw new Error(`claim failed: ${claim.reason}`);
  log('claimed → AGENT_ASSIGNED');

  const sent = await agent.send(turn.conversationId, 'Hi, a human agent is here to help.');
  if (!sent.ok) throw new Error(`agent message rejected: ${sent.reason}`);
  log('agent message → HUMAN_ACTIVE (switch to WS)');

  await delay(500);

  const hb = await agent.handback(turn.conversationId);
  if (!hb.ok) throw new Error(`handback rejected: ${hb.reason}`);
  log('handback → AI_ACTIVE (switch back to SSE)');

  await delay(500);
  agent.disconnect();

  if (switches < 2) {
    throw new Error(`expected 2 transport_switch broadcasts, saw ${switches}`);
  }
  log('PASS: SSE → WS → SSE switch cycle completed with both transport_switch events');
}
