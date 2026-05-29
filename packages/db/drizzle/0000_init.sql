CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('OPENAI', 'ANTHROPIC');--> statement-breakpoint
CREATE TYPE "public"."conversation_state" AS ENUM('AI_ACTIVE', 'ESCALATION_PENDING', 'AGENT_ASSIGNED', 'HUMAN_ACTIVE', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."escalation_trigger" AS ENUM('THIRD_HUMAN_REQUEST', 'WEAK_GROUNDING', 'MODEL_INVOKED', 'NEGATIVE_SENTIMENT', 'PROVIDER_FAILURE');--> statement-breakpoint
CREATE TYPE "public"."kb_document_status" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."kb_document_type" AS ENUM('PDF', 'DOCX', 'TEXT');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('CUSTOMER', 'AI', 'AGENT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'CUSTOMER_SUPPORT_AGENT');--> statement-breakpoint
CREATE TYPE "public"."widget_launcher_position" AS ENUM('BOTTOM_RIGHT', 'BOTTOM_LEFT');--> statement-breakpoint
CREATE TYPE "public"."widget_preset" AS ENUM('LIGHT', 'DARK', 'BRAND');--> statement-breakpoint
CREATE TABLE "allowed_origins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"embed_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_provider_credentials" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"encryption_iv" text NOT NULL,
	"encryption_auth_tag" text NOT NULL,
	"encryption_key_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widget_configs" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"accent_primary" text NOT NULL,
	"bg_surface" text NOT NULL,
	"text_primary" text NOT NULL,
	"text_muted" text NOT NULL,
	"bot_name" text NOT NULL,
	"greeting" text NOT NULL,
	"preset" "widget_preset" NOT NULL,
	"launcher_position" "widget_launcher_position" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_configs" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"third_human_request_enabled" boolean DEFAULT true NOT NULL,
	"human_request_count_to_escalate" integer DEFAULT 3 NOT NULL,
	"weak_grounding_enabled" boolean DEFAULT true NOT NULL,
	"weak_grounding_threshold" real DEFAULT 0.7 NOT NULL,
	"model_invoked_enabled" boolean DEFAULT true NOT NULL,
	"negative_sentiment_enabled" boolean DEFAULT false NOT NULL,
	"provider_failure_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"state" "conversation_state" DEFAULT 'AI_ACTIVE' NOT NULL,
	"assigned_agent_id" uuid,
	"human_request_count" integer DEFAULT 0 NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"sender_agent_id" uuid,
	"client_nonce" text,
	"grounding_score" real,
	"sentiment_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_agent_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_type" "kb_document_type" NOT NULL,
	"byte_size" integer NOT NULL,
	"status" "kb_document_status" DEFAULT 'PENDING' NOT NULL,
	"error" text,
	"uploaded_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allowed_origins" ADD CONSTRAINT "allowed_origins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ADD CONSTRAINT "ai_provider_credentials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_configs" ADD CONSTRAINT "widget_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_configs" ADD CONSTRAINT "escalation_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_agent_id_users_id_fk" FOREIGN KEY ("sender_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_agent_id_users_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_uploaded_by_agent_id_users_id_fk" FOREIGN KEY ("uploaded_by_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allowed_origins_org_origin_idx" ON "allowed_origins" USING btree ("organization_id","origin");--> statement-breakpoint
CREATE INDEX "allowed_origins_org_idx" ON "allowed_origins" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_embed_token_idx" ON "organizations" USING btree ("embed_token");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_org_role_idx" ON "users" USING btree ("organization_id","role");--> statement-breakpoint
CREATE INDEX "sessions_org_idx" ON "sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversations_org_idx" ON "conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversations_org_state_idx" ON "conversations" USING btree ("organization_id","state");--> statement-breakpoint
CREATE INDEX "conversations_session_idx" ON "conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "conversations_assigned_agent_idx" ON "conversations" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_sequence_idx" ON "messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_client_nonce_idx" ON "messages" USING btree ("conversation_id","client_nonce");--> statement-breakpoint
CREATE INDEX "messages_org_idx" ON "messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "internal_notes_conversation_idx" ON "internal_notes" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "internal_notes_org_idx" ON "internal_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kb_documents_org_idx" ON "kb_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kb_documents_org_status_idx" ON "kb_documents" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "kb_chunks_org_idx" ON "kb_chunks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kb_chunks_document_idx" ON "kb_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_hnsw_idx" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops);