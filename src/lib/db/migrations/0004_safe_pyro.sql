-- Add the stored `variant` (puzzle type) column to daily_puzzles.
--
-- Hand-authored (the drizzle-generated form was a bare `ADD COLUMN ... NOT NULL`, which fails on a
-- table that already has rows). Instead: add nullable, backfill every historical `difficulty` key
-- to its type, then set NOT NULL. The final SET NOT NULL doubles as the exhaustiveness gate — any
-- historical key that escapes every pattern below stays NULL and aborts the migration. Additive
-- only (no destructive change), so no reverse SQL / backup is required.
--
-- Historical key → variant map:
--   classic : the bare tiers (easy..extreme) and every mini* classic board (mini4-*, mini6-*)
--   killer  : the legacy single 'killer' key, the 9x9 ladder (killer-*), and 6x6 (killer6-*)
--   calc    : every Keisan board (calc4-*, calc6-*, calc9-*)
ALTER TABLE "daily_puzzles" ADD COLUMN "variant" text;
--> statement-breakpoint
UPDATE "daily_puzzles" SET "variant" = 'classic'
  WHERE "variant" IS NULL
    AND ("difficulty" IN ('easy', 'medium', 'hard', 'expert', 'extreme') OR "difficulty" LIKE 'mini%');
--> statement-breakpoint
UPDATE "daily_puzzles" SET "variant" = 'killer'
  WHERE "variant" IS NULL AND ("difficulty" = 'killer' OR "difficulty" LIKE 'killer%');
--> statement-breakpoint
UPDATE "daily_puzzles" SET "variant" = 'calc'
  WHERE "variant" IS NULL AND "difficulty" LIKE 'calc%';
--> statement-breakpoint
ALTER TABLE "daily_puzzles" ALTER COLUMN "variant" SET NOT NULL;
