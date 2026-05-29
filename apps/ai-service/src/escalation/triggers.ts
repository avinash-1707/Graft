import type { TurnClassification } from '@graft/ai';
import { SentimentLabel } from '@graft/ai';

/**
 * Pure escalation-signal predicates (architecture.md §Escalation). The stateful
 * parts — the running human-request count and the atomic state transition — live in
 * the worker/service; these are the deterministic, unit-testable threshold gates.
 */

/** Customer explicitly asked for a human, above the tenant's confidence threshold. */
export function isHumanRequest(classification: TurnClassification, threshold: number): boolean {
  return classification.humanRequest.requested && classification.humanRequest.score >= threshold;
}

/** Customer message is NEGATIVE above the tenant's confidence threshold. */
export function isNegativeSentiment(
  classification: TurnClassification,
  threshold: number,
): boolean {
  return (
    classification.sentiment.label === SentimentLabel.NEGATIVE &&
    classification.sentiment.score >= threshold
  );
}
