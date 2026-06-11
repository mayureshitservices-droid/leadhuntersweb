-- Add owner_id column to User table
ALTER TABLE "User" ADD COLUMN "owner_id" TEXT;

-- Backfill owner_id from TelecallerAssignment
UPDATE "User" SET "owner_id" = ta."business_owner_id" 
FROM "TelecallerAssignment" ta 
WHERE "User".id = ta."telecaller_id";

-- Drop foreign key constraints on TelecallerAssignment
ALTER TABLE "TelecallerAssignment" DROP CONSTRAINT IF EXISTS "TelecallerAssignment_telecaller_id_fkey";
ALTER TABLE "TelecallerAssignment" DROP CONSTRAINT IF EXISTS "TelecallerAssignment_business_owner_id_fkey";

-- Drop TelecallerAssignment table
DROP TABLE "TelecallerAssignment";

-- Add foreign key for owner_id self-referential relation
ALTER TABLE "User" ADD CONSTRAINT "User_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL;