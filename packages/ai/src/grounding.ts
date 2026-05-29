import { isGrounded, type RetrievedChunk } from '@graft/rag';

export interface GroundingResult {
  /** Best (highest) cosine similarity across retrieved chunks; 0 when none. */
  topSimilarity: number;
  /** True when `topSimilarity >= threshold` — i.e. retrieval found a relevant chunk. */
  grounded: boolean;
  /** Number of chunks retrieved. */
  chunkCount: number;
}

/**
 * Computes the weak-grounding escalation signal for a turn. Weak grounding (top
 * similarity below the tenant's threshold) is the PRIMARY "AI can't answer" signal
 * (architecture.md §Escalation), replacing reliance on model-reported confidence.
 * ai-service (unit 17) compares against the per-tenant
 * `escalation_configs.groundingThreshold`.
 *
 * Chunks MUST be best-first (as `retrieveChunks` returns them): the top similarity
 * is taken from the first chunk, matching `isGrounded`, so the two never disagree.
 */
export function evaluateGrounding(chunks: RetrievedChunk[], threshold: number): GroundingResult {
  return {
    topSimilarity: chunks[0]?.similarity ?? 0,
    grounded: isGrounded(chunks, threshold),
    chunkCount: chunks.length,
  };
}
