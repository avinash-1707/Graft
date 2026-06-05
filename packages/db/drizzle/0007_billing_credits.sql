CREATE TYPE "public"."billing_plan" AS ENUM('STARTER', 'PRO', 'SCALE');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('GRANT_MONTHLY', 'TOPUP', 'USAGE_DEBIT', 'EXPIRE', 'ADJUST', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('CREDITS', 'BYOK');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('none', 'pending', 'active', 'on_hold', 'cancelled', 'expired');--> statement-breakpoint
ALTER TYPE "public"."escalation_trigger" ADD VALUE 'INSUFFICIENT_CREDITS';--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"id" "billing_plan" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"dodo_product_id" text,
	"monthly_price_micro_usd" integer NOT NULL,
	"included_credits_micro_usd" integer NOT NULL,
	"markup_bps" integer NOT NULL,
	"byok_allowed" boolean DEFAULT true NOT NULL,
	"topup_allowed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_subscription" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"plan" "billing_plan" DEFAULT 'STARTER' NOT NULL,
	"pricing_mode" "pricing_mode" DEFAULT 'CREDITS' NOT NULL,
	"status" "subscription_status" DEFAULT 'none' NOT NULL,
	"dodo_customer_id" text,
	"dodo_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_credit_balance" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"monthly_balance_micro_usd" bigint DEFAULT 0 NOT NULL,
	"rollover_balance_micro_usd" bigint DEFAULT 0 NOT NULL,
	"lifetime_granted_micro_usd" bigint DEFAULT 0 NOT NULL,
	"lifetime_spent_micro_usd" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount_micro_usd" bigint NOT NULL,
	"balance_after_micro_usd" bigint NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"description" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model_pricing" (
	"model" text PRIMARY KEY NOT NULL,
	"prompt_micro_usd_per_mtok" bigint NOT NULL,
	"completion_micro_usd_per_mtok" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_inferences" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_metrics_15m" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_metrics_daily" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."ai_provider";--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('OPENROUTER');--> statement-breakpoint
ALTER TABLE "ai_inferences" ALTER COLUMN "provider" SET DATA TYPE "public"."ai_provider" USING "provider"::"public"."ai_provider";--> statement-breakpoint
ALTER TABLE "ai_metrics_15m" ALTER COLUMN "provider" SET DATA TYPE "public"."ai_provider" USING "provider"::"public"."ai_provider";--> statement-breakpoint
ALTER TABLE "ai_metrics_daily" ALTER COLUMN "provider" SET DATA TYPE "public"."ai_provider" USING "provider"::"public"."ai_provider";--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" DROP CONSTRAINT "ai_provider_credentials_organization_id_provider_pk";--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ADD PRIMARY KEY ("organization_id");--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "chat_model" text;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "ai_inferences" ADD COLUMN "cost_micro_usd" integer;--> statement-breakpoint
ALTER TABLE "ai_inferences" ADD COLUMN "charged_micro_usd" integer;--> statement-breakpoint
ALTER TABLE "org_subscription" ADD CONSTRAINT "org_subscription_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_credit_balance" ADD CONSTRAINT "org_credit_balance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idempotency_idx" ON "credit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_ledger_org_created_idx" ON "credit_ledger" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "ai_settings" DROP COLUMN "chat_provider";--> statement-breakpoint
ALTER TABLE "ai_settings" DROP COLUMN "embedding_provider";--> statement-breakpoint
INSERT INTO "billing_plans" ("id","name","dodo_product_id","monthly_price_micro_usd","included_credits_micro_usd","markup_bps","byok_allowed","topup_allowed") VALUES
	('STARTER','Starter',NULL,0,1000000,2500,true,true),
	('PRO','Pro',NULL,29000000,30000000,2500,true,true),
	('SCALE','Scale',NULL,99000000,110000000,1800,true,true)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "org_subscription" ("organization_id") SELECT "id" FROM "organizations" ON CONFLICT ("organization_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "org_credit_balance" ("organization_id","monthly_balance_micro_usd","lifetime_granted_micro_usd") SELECT "id",1000000,1000000 FROM "organizations" ON CONFLICT ("organization_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "credit_ledger" ("organization_id","entry_type","amount_micro_usd","balance_after_micro_usd","source","description","idempotency_key") SELECT "id",'GRANT_MONTHLY',1000000,1000000,'system','Starter credits (backfill)','backfill:grant:' || "id" FROM "organizations" ON CONFLICT ("idempotency_key") DO NOTHING;
