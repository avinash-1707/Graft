ALTER TABLE "escalation_configs" ADD COLUMN "human_request_confidence_threshold" real DEFAULT 0.7 NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_configs" ADD COLUMN "negative_sentiment_threshold" real DEFAULT 0.7 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "escalation_trigger" "escalation_trigger";