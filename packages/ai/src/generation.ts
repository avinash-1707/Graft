import {
  APICallError,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type StreamTextResult,
  type ToolSet,
} from 'ai';

/**
 * Bounded retry + per-attempt timeout policy for provider calls. On exhaustion the
 * call throws {@link ProviderFailureError}, which ai-service maps to the
 * `PROVIDER_FAILURE` escalation trigger (architecture.md §Provider-failure
 * resilience) rather than hard-failing the customer.
 */
export interface RetryPolicy {
  /** Additional attempts after the first. */
  maxRetries: number;
  /** Per-attempt timeout in ms; on expiry the attempt aborts and is retried. */
  timeoutMs: number;
  /** Exponential backoff base in ms (delay = baseDelayMs * 2^attempt). */
  baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  timeoutMs: 30_000,
  baseDelayMs: 500,
};

/** Thrown when the caller's AbortSignal fired — generation was cancelled, not failed. */
export class GenerationCancelledError extends Error {
  constructor() {
    super('generation cancelled');
    this.name = 'GenerationCancelledError';
  }
}

/** Thrown when a provider call fails after exhausting the retry policy. */
export class ProviderFailureError extends Error {
  readonly attempts: number;
  constructor(message: string, options: { cause?: unknown; attempts: number }) {
    super(message, { cause: options.cause });
    this.name = 'ProviderFailureError';
    this.attempts = options.attempts;
  }
}

/** Transient = worth retrying: rate limit, server error, or SDK-flagged retryable. */
function isTransient(err: unknown): boolean {
  if (APICallError.isInstance(err)) {
    if (err.isRetryable === true) return true;
    const status = err.statusCode;
    return status === 429 || (status !== undefined && status >= 500);
  }
  return false;
}

function backoffDelay(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** attempt;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new GenerationCancelledError());
      },
      { once: true },
    );
  });
}

/** Builds an attempt signal that aborts on either the caller's cancel or a timeout. */
function attemptSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new Error('provider call timed out'));
  }, timeoutMs);
  const signals = callerSignal ? [timeoutController.signal, callerSignal] : [timeoutController.signal];
  return { signal: AbortSignal.any(signals), cleanup: () => clearTimeout(timer) };
}

/**
 * Runs `fn` under the retry policy. `fn` receives a per-attempt AbortSignal (caller
 * cancel ∪ timeout). Caller cancellation throws {@link GenerationCancelledError}
 * immediately (never retried); transient provider errors are retried with
 * exponential backoff; anything else (e.g. invalid key, 400) fails fast. Exhaustion
 * throws {@link ProviderFailureError}.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  policy: RetryPolicy,
  callerSignal: AbortSignal | undefined,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    if (callerSignal?.aborted) throw new GenerationCancelledError();
    const { signal, cleanup } = attemptSignal(callerSignal, policy.timeoutMs);
    try {
      return await fn(signal);
    } catch (err) {
      if (callerSignal?.aborted) throw new GenerationCancelledError();
      lastError = err;
      if (!isTransient(err) || attempt === policy.maxRetries) break;
      await sleep(backoffDelay(attempt, policy.baseDelayMs), callerSignal);
    } finally {
      cleanup();
    }
  }
  throw new ProviderFailureError('provider call failed', {
    cause: lastError,
    attempts: policy.maxRetries + 1,
  });
}

export interface StreamAnswerInput {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  /** Tool set for the turn (e.g. {@link chatTools}, holding the `escalate` tool). */
  tools?: ToolSet;
  /** Caller cancellation — aborting it stops generation (invariant 12). */
  signal?: AbortSignal;
  retry?: RetryPolicy;
}

export interface AnswerStream {
  /** Token text stream. Throws {@link GenerationCancelledError} if the caller aborts. */
  textStream: AsyncIterable<string>;
  /** Resolves after the stream is fully consumed. */
  finishReason: StreamTextResult<ToolSet, never>['finishReason'];
  usage: StreamTextResult<ToolSet, never>['usage'];
  /**
   * Tool calls the model emitted (e.g. an `escalate` call). `input` is untyped
   * (`unknown`) because the tool set is erased to `ToolSet`; narrow it with the
   * tool's own schema, e.g. `escalateToolInputSchema.parse(call.input)`.
   */
  toolCalls: StreamTextResult<ToolSet, never>['toolCalls'];
}

/**
 * Starts a cancellable, streamed grounded answer. Retry applies only to the stream
 * START (errors before the first token — connection, auth refresh, rate limit): a
 * partially-streamed answer is never retried because the customer has already seen
 * those tokens. Once streaming begins, a mid-stream failure throws
 * {@link ProviderFailureError} (→ escalate) and a caller abort throws
 * {@link GenerationCancelledError}. The AI SDK's own retry is disabled
 * (`maxRetries: 0`) so this policy is the single source of retry behaviour.
 */
export async function streamAnswer(input: StreamAnswerInput): Promise<AnswerStream> {
  const policy = input.retry ?? DEFAULT_RETRY_POLICY;
  const callerSignal = input.signal;

  const started = await withRetry(
    async (signal) => {
      const result = streamText({
        model: input.model,
        system: input.system,
        messages: input.messages,
        ...(input.tools ? { tools: input.tools } : {}),
        abortSignal: signal,
        maxRetries: 0,
      });
      const iterator = result.textStream[Symbol.asyncIterator]();
      // Pull the first chunk so a pre-stream provider error surfaces here and is
      // eligible for retry. Once this resolves, the stream has started.
      const first = await iterator.next();
      return { result, iterator, first };
    },
    policy,
    callerSignal,
  );

  const { result, iterator, first } = started;

  async function* drain(): AsyncGenerator<string> {
    try {
      if (!first.done) yield first.value;
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        yield next.value;
      }
    } catch (err) {
      if (callerSignal?.aborted) throw new GenerationCancelledError();
      throw new ProviderFailureError('stream failed after start', { cause: err, attempts: 1 });
    }
  }

  return {
    textStream: drain(),
    finishReason: result.finishReason,
    usage: result.usage,
    toolCalls: result.toolCalls,
  };
}
