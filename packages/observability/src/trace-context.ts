import { trace, isSpanContextValid } from '@opentelemetry/api';

export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  const ctx = span?.spanContext();
  if (ctx && isSpanContextValid(ctx)) return ctx.traceId;
  return undefined;
}

export function getCurrentSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  const ctx = span?.spanContext();
  if (ctx && isSpanContextValid(ctx)) return ctx.spanId;
  return undefined;
}
