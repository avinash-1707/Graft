CREATE TYPE "public"."ai_inference_status" AS ENUM('SUCCESS', 'PROVIDER_ERROR', 'TIMEOUT', 'CANCELLED', 'RATE_LIMITED');--> statement-breakpoint
CREATE TABLE "ai_inferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"status" "ai_inference_status" NOT NULL,
	"latency_ms" integer NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"finish_reason" text,
	"error_code" text,
	"grounding_score" real,
	"retrieved_chunks_count" integer,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalation_trigger" "escalation_trigger",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_metrics_15m" (
	"organization_id" uuid NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"escalation_count" integer DEFAULT 0 NOT NULL,
	"latency_p50_ms" integer DEFAULT 0 NOT NULL,
	"latency_p95_ms" integer DEFAULT 0 NOT NULL,
	"latency_sum_ms" bigint DEFAULT 0 NOT NULL,
	"total_prompt_tokens" bigint DEFAULT 0 NOT NULL,
	"total_completion_tokens" bigint DEFAULT 0 NOT NULL,
	"grounding_score_sum" real DEFAULT 0 NOT NULL,
	"grounding_score_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_metrics_15m_pkey" PRIMARY KEY("organization_id","bucket_start","provider","model")
);
--> statement-breakpoint
CREATE TABLE "ai_metrics_daily" (
	"organization_id" uuid NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"escalation_count" integer DEFAULT 0 NOT NULL,
	"latency_p50_ms" integer DEFAULT 0 NOT NULL,
	"latency_p95_ms" integer DEFAULT 0 NOT NULL,
	"latency_sum_ms" bigint DEFAULT 0 NOT NULL,
	"total_prompt_tokens" bigint DEFAULT 0 NOT NULL,
	"total_completion_tokens" bigint DEFAULT 0 NOT NULL,
	"grounding_score_sum" real DEFAULT 0 NOT NULL,
	"grounding_score_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_metrics_daily_pkey" PRIMARY KEY("organization_id","bucket_start","provider","model")
);
--> statement-breakpoint
CREATE TABLE "ai_metrics_rollup_state" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"last_15m_bucket" timestamp with time zone,
	"last_daily_bucket" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_metrics_rollup_state_singleton_chk" CHECK ("ai_metrics_rollup_state"."id" = 'singleton')
);
--> statement-breakpoint
ALTER TABLE "ai_inferences" ADD CONSTRAINT "ai_inferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_inferences" ADD CONSTRAINT "ai_inferences_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_inferences" ADD CONSTRAINT "ai_inferences_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_metrics_15m" ADD CONSTRAINT "ai_metrics_15m_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_metrics_daily" ADD CONSTRAINT "ai_metrics_daily_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_inferences_org_created_idx" ON "ai_inferences" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_inferences_conversation_idx" ON "ai_inferences" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_inferences_created_brin_idx" ON "ai_inferences" USING brin ("created_at") WITH (pages_per_range = 32);--> statement-breakpoint
CREATE INDEX "ai_metrics_15m_bucket_brin_idx" ON "ai_metrics_15m" USING brin ("bucket_start") WITH (pages_per_range = 32);--> statement-breakpoint
CREATE INDEX "ai_metrics_daily_bucket_brin_idx" ON "ai_metrics_daily" USING brin ("bucket_start") WITH (pages_per_range = 32);