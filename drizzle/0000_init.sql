CREATE TYPE "public"."feedback_verdict" AS ENUM('correct', 'wrong_root_cause', 'not_incident');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('triaging', 'noise', 'open', 'investigating', 'verifying', 'awaiting_recovery', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('SEV1', 'SEV2', 'SEV3');--> statement-breakpoint
CREATE TYPE "public"."signal_source" AS ENUM('prometheus', 'loki', 'predictive', 'deploy_guard');--> statement-breakpoint
CREATE TABLE "anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"incident_id" uuid,
	"source" "signal_source" NOT NULL,
	"signal" text NOT NULL,
	"value" double precision NOT NULL,
	"baseline_mean" double precision,
	"baseline_std" double precision,
	"z_score" double precision,
	"detail" jsonb,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chaos_injections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"service_id" uuid NOT NULL,
	"label" text NOT NULL,
	"fault_type" text NOT NULL,
	"expected_root_cause" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"matched_incident_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chaos_injections_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "deploys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"sha" text NOT NULL,
	"previous_sha" text,
	"deployed_at" timestamp with time zone NOT NULL,
	"guard_workflow_id" text,
	"regressed" boolean
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"verdict" "feedback_verdict" NOT NULL,
	"user_id" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"workflow_id" text NOT NULL,
	"service_id" uuid NOT NULL,
	"status" "incident_status" DEFAULT 'triaging' NOT NULL,
	"severity" "severity",
	"confidence" double precision,
	"title" text,
	"summary" text,
	"suspected_component" text,
	"user_impact" text,
	"root_cause" jsonb,
	"fix" jsonb,
	"final_report" jsonb,
	"slack_channel" text,
	"slack_thread_ts" text,
	"acknowledged_by" text,
	"chaos_label" text,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"initial_report_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "log_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"signature" text NOT NULL,
	"template" text NOT NULL,
	"sample" text,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"prom_selector" text NOT NULL,
	"loki_selector" text NOT NULL,
	"github_repo" text,
	"slack_channel" text,
	"slo_target" double precision DEFAULT 0.999 NOT NULL,
	"verify_image" text,
	"verify_command" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaos_injections" ADD CONSTRAINT "chaos_injections_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chaos_injections" ADD CONSTRAINT "chaos_injections_matched_incident_id_incidents_id_fk" FOREIGN KEY ("matched_incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deploys" ADD CONSTRAINT "deploys_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_signatures" ADD CONSTRAINT "log_signatures_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anomalies_service_observed_idx" ON "anomalies" USING btree ("service_id","observed_at");--> statement-breakpoint
CREATE INDEX "chaos_injections_service_started_idx" ON "chaos_injections" USING btree ("service_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_workflow_id_idx" ON "incidents" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "incidents_service_status_idx" ON "incidents" USING btree ("service_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "log_signatures_service_sig_idx" ON "log_signatures" USING btree ("service_id","signature");