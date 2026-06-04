import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { DEFAULT_EMBEDDING_MODEL } from '@graft/shared';
import { embed, embedMany } from 'ai';

/**
 * Embedding over the Vercel AI SDK, routed through OpenRouter. The default model
 * (`openai/text-embedding-3-small`) emits {@link EMBEDDING_DIMENSIONS}-wide vectors
 * natively, so a single `vector(1536)` pgvector column + one HNSW index serves every
 * tenant. Vectors from different models are NOT comparable, but every retrieval query
 * is `organization_id`-filtered and a tenant uses one embedding model, so a tenant's
 * chunks and its query embeddings always share a space. Switching a tenant's
 * embedding model requires re-embedding that tenant's existing chunks.
 */
export const EMBEDDING_DIMENSIONS = 1536;

export { DEFAULT_EMBEDDING_MODEL };

export interface EmbedderConfig {
  /** Tenant's OpenRouter API key; decrypted in-memory at call time. */
  apiKey: string;
  /** Override the default model. Must emit {@link EMBEDDING_DIMENSIONS}-wide vectors. */
  model?: string;
}

export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  /** Embeds a single query string (retrieval path). */
  embedQuery(text: string): Promise<number[]>;
  /** Embeds many chunks in one call (ingestion path). Order-preserving. */
  embedBatch(texts: string[]): Promise<number[][]>;
}

export function createEmbedder(config: EmbedderConfig): Embedder {
  const model = config.model ?? DEFAULT_EMBEDDING_MODEL;
  const embeddingModel = createOpenRouter({ apiKey: config.apiKey }).textEmbeddingModel(model);

  return {
    model,
    dimensions: EMBEDDING_DIMENSIONS,
    async embedQuery(text) {
      const { embedding } = await embed({ model: embeddingModel, value: text });
      return embedding;
    },
    async embedBatch(texts) {
      if (texts.length === 0) return [];
      const { embeddings } = await embedMany({ model: embeddingModel, values: texts });
      return embeddings;
    },
  };
}
