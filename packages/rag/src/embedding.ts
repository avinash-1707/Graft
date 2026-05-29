import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { EmbeddingProvider } from '@graft/shared';
import { embed, embedMany, type EmbeddingModel } from 'ai';

/**
 * Provider-agnostic embedding over the Vercel AI SDK. Both supported providers
 * emit {@link EMBEDDING_DIMENSIONS}-wide vectors so a single `vector(1536)`
 * pgvector column + one HNSW index serves every tenant. Vectors from different
 * providers are NOT comparable, but every retrieval query is `organization_id`-
 * filtered and a tenant uses one embedding provider, so a tenant's chunks and its
 * query embeddings always share a space. Switching a tenant's embedding provider
 * requires re-embedding that tenant's existing chunks.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/** Default model per provider; both are truncated to {@link EMBEDDING_DIMENSIONS}. */
export const DEFAULT_EMBEDDING_MODELS = {
  OPENAI: 'text-embedding-3-small',
  GEMINI: 'gemini-embedding-001',
} as const satisfies Record<EmbeddingProvider, string>;

export interface EmbedderConfig {
  provider: EmbeddingProvider;
  /** Tenant's API key for the chosen provider; decrypted in-memory at call time. */
  apiKey: string;
  /** Override the default model. Must emit `dimensions`-wide vectors. */
  model?: string;
  /** Output dimensionality. Defaults to {@link EMBEDDING_DIMENSIONS}. */
  dimensions?: number;
}

export interface Embedder {
  readonly provider: EmbeddingProvider;
  readonly model: string;
  readonly dimensions: number;
  /** Embeds a single query string (retrieval path). */
  embedQuery(text: string): Promise<number[]>;
  /** Embeds many chunks in one call (ingestion path). Order-preserving. */
  embedBatch(texts: string[]): Promise<number[][]>;
}

type ProviderOptions = Record<string, Record<string, number>>;

function buildModel(
  provider: EmbeddingProvider,
  apiKey: string,
  model: string,
  dimensions: number,
): { embeddingModel: EmbeddingModel; providerOptions: ProviderOptions } {
  switch (provider) {
    case 'OPENAI':
      return {
        embeddingModel: createOpenAI({ apiKey }).embedding(model),
        providerOptions: { openai: { dimensions } },
      };
    case 'GEMINI':
      return {
        embeddingModel: createGoogleGenerativeAI({ apiKey }).embedding(model),
        providerOptions: { google: { outputDimensionality: dimensions } },
      };
  }
}

export function createEmbedder(config: EmbedderConfig): Embedder {
  const dimensions = config.dimensions ?? EMBEDDING_DIMENSIONS;
  const model = config.model ?? DEFAULT_EMBEDDING_MODELS[config.provider];
  const { embeddingModel, providerOptions } = buildModel(
    config.provider,
    config.apiKey,
    model,
    dimensions,
  );

  return {
    provider: config.provider,
    model,
    dimensions,
    async embedQuery(text) {
      const { embedding } = await embed({ model: embeddingModel, value: text, providerOptions });
      return embedding;
    },
    async embedBatch(texts) {
      if (texts.length === 0) return [];
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: texts,
        providerOptions,
      });
      return embeddings;
    },
  };
}
