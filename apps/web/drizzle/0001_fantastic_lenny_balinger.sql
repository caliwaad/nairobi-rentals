CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realtor_id" uuid NOT NULL,
	"provider_ref" text,
	"invoice_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"current_period_end" timestamp with time zone,
	"last_payment_at" timestamp with time zone,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_realtor_id_users_id_fk" FOREIGN KEY ("realtor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_realtor_unique" ON "subscriptions" USING btree ("realtor_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");