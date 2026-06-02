import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { ConversationState, EscalationTrigger } from '@graft/shared';
import type { Database } from '../client.js';
import { conversations } from '../schema/conversations.js';

export type ConversationRow = typeof conversations.$inferSelect;

export interface CreateConversationInput {
  organizationId: string;
  sessionId: string;
}

/** Starts a new conversation for a session. State defaults to AI_ACTIVE. */
export async function createConversation(
  db: Database,
  input: CreateConversationInput,
): Promise<ConversationRow> {
  const [row] = await db
    .insert(conversations)
    .values({ organizationId: input.organizationId, sessionId: input.sessionId })
    .returning();
  if (!row) throw new Error('failed to create conversation');
  return row;
}

/** Returns the conversation only if it exists AND belongs to the org (tenant guard). */
export async function getConversationForOrg(
  db: Database,
  id: string,
  organizationId: string,
): Promise<ConversationRow | undefined> {
  return db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.organizationId, organizationId)),
  });
}

/**
 * The session's most recent non-CLOSED conversation — the resume target when a
 * returning customer reconnects. A session has at most one such conversation in
 * normal flow; ordering by `createdAt` desc is a safety net.
 */
export async function findActiveConversationBySession(
  db: Database,
  sessionId: string,
  organizationId: string,
): Promise<ConversationRow | undefined> {
  return db.query.conversations.findFirst({
    where: and(
      eq(conversations.sessionId, sessionId),
      eq(conversations.organizationId, organizationId),
      ne(conversations.state, 'CLOSED'),
    ),
    orderBy: desc(conversations.createdAt),
  });
}

/**
 * Atomically increments the conversation's running human-request count and returns
 * the new value (tenant-scoped). Used by the escalation engine to detect the Nth
 * explicit "talk to a human" request across turns.
 */
export async function incrementHumanRequestCount(
  db: Database,
  conversationId: string,
  organizationId: string,
): Promise<number | undefined> {
  const [row] = await db
    .update(conversations)
    .set({ humanRequestCount: sql`${conversations.humanRequestCount} + 1`, updatedAt: new Date() })
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    )
    .returning({ humanRequestCount: conversations.humanRequestCount });
  return row?.humanRequestCount;
}

/**
 * Atomic compare-and-set escalation transition (invariant 2): flips AI_ACTIVE →
 * ESCALATION_PENDING and records the trigger, only if the conversation is still
 * AI_ACTIVE. Returns the updated row, or undefined when it was no longer AI_ACTIVE
 * (an agent already took over, or another path already escalated) — so concurrent
 * escalations and a takeover can never both win. Tenant-scoped.
 */
export async function transitionToEscalationPending(
  db: Database,
  conversationId: string,
  organizationId: string,
  trigger: EscalationTrigger,
): Promise<ConversationRow | undefined> {
  const [row] = await db
    .update(conversations)
    .set({ state: 'ESCALATION_PENDING', escalationTrigger: trigger, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.organizationId, organizationId),
        eq(conversations.state, 'AI_ACTIVE'),
      ),
    )
    .returning();
  return row;
}

/** A conversation an agent successfully claimed, with the state it moved FROM. */
export interface ClaimedConversation {
  conversationId: string;
  assignedAgentId: string;
  /** Always AGENT_ASSIGNED after a claim. */
  state: ConversationState;
  /** State the claim transitioned from — ESCALATION_PENDING or AI_ACTIVE (takeover). */
  previousState: ConversationState;
  /** The trigger that put it in ESCALATION_PENDING, null for a proactive AI_ACTIVE takeover. */
  escalationTrigger: EscalationTrigger | null;
}

/**
 * Atomic conversation claim (invariant 2): a single compare-and-set that flips
 * ESCALATION_PENDING (normal claim) OR AI_ACTIVE (proactive agent takeover) →
 * AGENT_ASSIGNED and assigns the agent, only while still unclaimed
 * (`assigned_agent_id IS NULL`). Two agents can never both win: Postgres serializes
 * the row lock and re-checks the predicate after the first writer commits, so the
 * loser matches no row. Returns the claimed row (with the prior state for metrics)
 * or undefined when nothing was claimed (already taken, closed, or not in this org).
 * The `FROM (SELECT ...)` subquery reads the pre-update snapshot, yielding the
 * previous state in the same atomic statement. Tenant-scoped.
 */
export async function claimConversation(
  db: Database,
  conversationId: string,
  organizationId: string,
  agentId: string,
): Promise<ClaimedConversation | undefined> {
  const rows = (await db.execute(sql`
    UPDATE conversations AS c
    SET state = 'AGENT_ASSIGNED', assigned_agent_id = ${agentId}, updated_at = now()
    FROM (SELECT id, state FROM conversations WHERE id = ${conversationId}) AS prev
    WHERE c.id = prev.id
      AND c.organization_id = ${organizationId}
      AND c.assigned_agent_id IS NULL
      AND c.state IN ('ESCALATION_PENDING', 'AI_ACTIVE')
    RETURNING
      c.id,
      c.assigned_agent_id AS assigned_agent_id,
      c.state AS state,
      c.escalation_trigger AS escalation_trigger,
      prev.state AS previous_state
  `)) as unknown as Array<{
    id: string;
    assigned_agent_id: string;
    state: ConversationState;
    escalation_trigger: EscalationTrigger | null;
    previous_state: ConversationState;
  }>;

  const row = rows[0];
  if (!row) return undefined;
  return {
    conversationId: row.id,
    assignedAgentId: row.assigned_agent_id,
    state: row.state,
    previousState: row.previous_state,
    escalationTrigger: row.escalation_trigger,
  };
}

/**
 * Atomic AGENT_ASSIGNED → HUMAN_ACTIVE transition (unit 20): fires on the assigned
 * agent's first message, only while still AGENT_ASSIGNED and assigned to that agent.
 * The compare-and-set makes concurrent first messages flip the state exactly once
 * (the loser gets undefined and skips the duplicate switch signal). Tenant-scoped.
 */
export async function transitionToHumanActive(
  db: Database,
  conversationId: string,
  organizationId: string,
  agentId: string,
): Promise<ConversationRow | undefined> {
  const [row] = await db
    .update(conversations)
    .set({ state: 'HUMAN_ACTIVE', updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.organizationId, organizationId),
        eq(conversations.state, 'AGENT_ASSIGNED'),
        eq(conversations.assignedAgentId, agentId),
      ),
    )
    .returning();
  return row;
}

/**
 * Atomic handback HUMAN_ACTIVE → AI_ACTIVE (unit 20): the assigned agent returns the
 * conversation to the AI. Only succeeds while still HUMAN_ACTIVE and assigned to that
 * agent. Clears the assignment and the escalation trigger and resets the running
 * human-request count, so the AI starts a clean turn and the THIRD_HUMAN_REQUEST
 * counter restarts. Returns undefined when it was no longer the agent's to hand back.
 * Tenant-scoped.
 */
export async function handbackToAi(
  db: Database,
  conversationId: string,
  organizationId: string,
  agentId: string,
): Promise<ConversationRow | undefined> {
  const [row] = await db
    .update(conversations)
    .set({
      state: 'AI_ACTIVE',
      assignedAgentId: null,
      escalationTrigger: null,
      humanRequestCount: 0,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.organizationId, organizationId),
        eq(conversations.state, 'HUMAN_ACTIVE'),
        eq(conversations.assignedAgentId, agentId),
      ),
    )
    .returning();
  return row;
}
