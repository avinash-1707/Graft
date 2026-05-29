ALTER TYPE "public"."ai_provider" ADD VALUE 'GEMINI';--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"chat_provider" "ai_provider",
	"embedding_provider" "ai_provider",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Drop the original single-column PK (Postgres default name <table>_pkey from
-- 0000_init's `organization_id uuid PRIMARY KEY`) before adding the composite PK.
ALTER TABLE "ai_provider_credentials" DROP CONSTRAINT "ai_provider_credentials_pkey";--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ADD CONSTRAINT "ai_provider_credentials_organization_id_provider_pk" PRIMARY KEY("organization_id","provider");--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;