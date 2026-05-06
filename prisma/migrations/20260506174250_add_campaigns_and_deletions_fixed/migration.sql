-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "file_name" TEXT DEFAULT 'Legacy Upload',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "DeletedLead" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "business_owner_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedLead_pkey" PRIMARY KEY ("id")
);
