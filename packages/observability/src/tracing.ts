import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions/incubating';
import type { Instrumentation } from '@opentelemetry/instrumentation';

export interface StartTracingOptions {
  serviceName: string;
  serviceVersion: string;
  env: 'development' | 'production' | 'test';
  otlpEndpoint?: string;
  instrumentations?: Instrumentation[];
}

export interface Tracing {
  shutdown: () => Promise<void>;
}

export function startTracing(options: StartTracingOptions): Tracing {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: options.env,
    }),
    traceExporter: new OTLPTraceExporter(
      options.otlpEndpoint ? { url: options.otlpEndpoint } : {},
    ),
    instrumentations: options.instrumentations ?? [],
  });
  sdk.start();
  return {
    shutdown: () => sdk.shutdown(),
  };
}
