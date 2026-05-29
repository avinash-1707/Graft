import client, { type Registry } from 'prom-client';

export interface CreateMetricsOptions {
  serviceName: string;
  prefix?: string;
}

export interface Metrics {
  registry: Registry;
  httpRequestDuration: client.Histogram<'method' | 'route' | 'status'>;
  sseConnectionsActive: client.Gauge<'service'>;
  wsConnectionsActive: client.Gauge<'service'>;
  queueDepth: client.Gauge<'queue' | 'state'>;
  llmCalls: client.Counter<'provider' | 'status'>;
  llmCallDuration: client.Histogram<'provider' | 'status'>;
  conversationStateTransitions: client.Counter<'from' | 'to' | 'trigger'>;
}

export function createMetrics(options: CreateMetricsOptions): Metrics {
  const prefix = options.prefix ?? 'graft_';
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: options.serviceName });
  client.collectDefaultMetrics({ register: registry, prefix });

  const httpRequestDuration = new client.Histogram({
    name: `${prefix}http_request_duration_seconds`,
    help: 'HTTP request latency by method/route/status',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const sseConnectionsActive = new client.Gauge({
    name: `${prefix}sse_connections_active`,
    help: 'Active SSE connections',
    labelNames: ['service'] as const,
    registers: [registry],
  });

  const wsConnectionsActive = new client.Gauge({
    name: `${prefix}websocket_connections_active`,
    help: 'Active WebSocket connections',
    labelNames: ['service'] as const,
    registers: [registry],
  });

  const queueDepth = new client.Gauge({
    name: `${prefix}queue_depth`,
    help: 'BullMQ queue depth by queue name and state (waiting|active|delayed|failed)',
    labelNames: ['queue', 'state'] as const,
    registers: [registry],
  });

  const llmCalls = new client.Counter({
    name: `${prefix}llm_calls_total`,
    help: 'LLM provider calls by provider and outcome',
    labelNames: ['provider', 'status'] as const,
    registers: [registry],
  });

  const llmCallDuration = new client.Histogram({
    name: `${prefix}llm_call_duration_seconds`,
    help: 'LLM provider call latency',
    labelNames: ['provider', 'status'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [registry],
  });

  const conversationStateTransitions = new client.Counter({
    name: `${prefix}conversation_state_transitions_total`,
    help: 'Conversation state transitions by from/to and triggering reason',
    labelNames: ['from', 'to', 'trigger'] as const,
    registers: [registry],
  });

  return {
    registry,
    httpRequestDuration,
    sseConnectionsActive,
    wsConnectionsActive,
    queueDepth,
    llmCalls,
    llmCallDuration,
    conversationStateTransitions,
  };
}
