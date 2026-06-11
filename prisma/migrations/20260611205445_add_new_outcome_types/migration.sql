-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'HOT_LEAD';
ALTER TYPE "LeadStatus" ADD VALUE 'WALK_IN';
ALTER TYPE "LeadStatus" ADD VALUE 'CALLBACK';
ALTER TYPE "LeadStatus" ADD VALUE 'FOLLOW_UP';
ALTER TYPE "LeadStatus" ADD VALUE 'WARM_LEAD';
ALTER TYPE "LeadStatus" ADD VALUE 'BUDGET_ISSUE';
ALTER TYPE "LeadStatus" ADD VALUE 'PENDING_DECISION';
ALTER TYPE "LeadStatus" ADD VALUE 'ONLINE';
ALTER TYPE "LeadStatus" ADD VALUE 'EXISTING_STUDENT';
ALTER TYPE "LeadStatus" ADD VALUE 'NOT_INTERESTED';
ALTER TYPE "LeadStatus" ADD VALUE 'LANGUAGE_ISSUE';
ALTER TYPE "LeadStatus" ADD VALUE 'SALE_DONE';

-- AlterTable
ALTER TABLE "CallLog" ADD COLUMN     "next_reminder_time" BIGINT;
