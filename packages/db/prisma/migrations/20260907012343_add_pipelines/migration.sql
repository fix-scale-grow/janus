CREATE TYPE "StageOutcome" AS ENUM ('OPEN', 'WON', 'LOST', 'DISQUALIFIED');

CREATE TABLE "pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "outcome" "StageOutcome" NOT NULL DEFAULT 'OPEN',
    "isEntry" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pipeline_position_idx" ON "pipeline"("position");

CREATE INDEX "stage_pipelineId_position_idx" ON "stage"("pipelineId", "position");

CREATE UNIQUE INDEX "stage_pipelineId_key_key" ON "stage"("pipelineId", "key");

ALTER TABLE "stage" ADD CONSTRAINT "stage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "pipeline" ("id", "name", "position", "createdAt", "updatedAt")
VALUES ('pipeline_seed_sales', 'Sales', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "stage" ("id", "pipelineId", "key", "label", "color", "position", "outcome", "isEntry", "createdAt", "updatedAt")
VALUES
    ('stage_seed_demo_booked', 'pipeline_seed_sales', 'DEMO_BOOKED', 'New lead', 'var(--chart-1)', 0, 'OPEN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('stage_seed_qualified_to_buy', 'pipeline_seed_sales', 'QUALIFIED_TO_BUY', 'Inspection scheduled', 'var(--chart-2)', 1, 'OPEN', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('stage_seed_decision_maker_bought_in', 'pipeline_seed_sales', 'DECISION_MAKER_BOUGHT_IN', 'Estimate sent', 'var(--chart-3)', 2, 'OPEN', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('stage_seed_contract_sent', 'pipeline_seed_sales', 'CONTRACT_SENT', 'Contract sent', 'var(--chart-4)', 3, 'OPEN', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('stage_seed_closed_won', 'pipeline_seed_sales', 'CLOSED_WON', 'Won', 'var(--swatch-1)', 4, 'WON', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('stage_seed_closed_lost', 'pipeline_seed_sales', 'CLOSED_LOST', 'Lost', 'var(--swatch-2)', 5, 'LOST', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('stage_seed_unqualified_to_buy', 'pipeline_seed_sales', 'UNQUALIFIED_TO_BUY', 'Unqualified', 'var(--swatch-3)', 6, 'DISQUALIFIED', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "deal" ADD COLUMN "stageId" TEXT;

UPDATE "deal" AS d
SET "stageId" = s."id"
FROM "stage" AS s
WHERE s."pipelineId" = 'pipeline_seed_sales'
  AND s."key" = d."stage"::text;

ALTER TABLE "deal" ALTER COLUMN "stageId" SET NOT NULL;

DROP INDEX "deal_stage_idx";

ALTER TABLE "deal" DROP COLUMN "stage";

DROP TYPE "DealStage";

CREATE INDEX "deal_stageId_idx" ON "deal"("stageId");

ALTER TABLE "deal" ADD CONSTRAINT "deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
