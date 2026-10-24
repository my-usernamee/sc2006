-- AlterTable
ALTER TABLE "LostItemReport" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FoundItemReport" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MatchResult" ADD COLUMN     "eligible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing results must distinguish hard rejection from a rounded score of zero.
UPDATE "MatchResult" AS m SET "eligible" = (l."category" = f."category" AND f."dateFound" >= l."dateLost")
FROM "LostItemReport" l, "FoundItemReport" f WHERE m."lostReportId"=l.id AND m."foundReportId"=f.id;
-- A single match notification per pair, including concurrent requests.
DELETE FROM "Notification" a USING "Notification" b WHERE a."matchResultId"=b."matchResultId" AND a.id>b.id;
CREATE UNIQUE INDEX "Notification_match_once" ON "Notification" ("matchResultId") WHERE "matchResultId" IS NOT NULL;
CREATE UNIQUE INDEX "Claim_pending_lost" ON "OwnershipClaim" ("lostReportId") WHERE "status"='PENDING';
CREATE UNIQUE INDEX "Claim_pending_found" ON "OwnershipClaim" ("foundReportId") WHERE "status"='PENDING';
CREATE UNIQUE INDEX "Notification_claim_event_once" ON "Notification" ("claimId","type","recipientId") WHERE "claimId" IS NOT NULL;
CREATE INDEX "LostItemReport_live_status" ON "LostItemReport" ("status","deletedAt");
CREATE INDEX "FoundItemReport_live_status" ON "FoundItemReport" ("status","deletedAt");
ALTER TABLE "LostItemReport" ADD CONSTRAINT "threshold_range" CHECK ("notificationThreshold" BETWEEN 0 AND 100);
ALTER TABLE "MatchResult" ADD CONSTRAINT "score_range" CHECK ("matchScore" BETWEEN 0 AND 100);
