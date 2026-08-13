CREATE TABLE "nearby_places_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nearby_places_cache_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX "nearby_cache_key_idx" ON "nearby_places_cache" USING btree ("key");