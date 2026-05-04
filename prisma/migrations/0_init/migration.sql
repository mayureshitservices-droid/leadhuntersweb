-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'BUSINESS_OWNER', 'TELECALLER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'ANSWERED', 'MISSED', 'BUSY', 'INTERESTED', 'ORDERED', 'BOOKED', 'REMIND_LATER', 'LOST', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "device_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "role" "Role" NOT NULL,
    "device_alias" TEXT,
    "phone" TEXT,
    "payment_terms" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelecallerAssignment" (
    "id" TEXT NOT NULL,
    "telecaller_id" TEXT NOT NULL,
    "business_owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelecallerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "business_owner_id" TEXT NOT NULL,
    "telecaller_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "additional_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "telecaller_id" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "recording_url" TEXT,
    "call_status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "outcome" TEXT,
    "notes" TEXT,
    "local_log_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_device_id_key" ON "User"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TelecallerAssignment_telecaller_id_business_owner_id_key" ON "TelecallerAssignment"("telecaller_id", "business_owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_business_owner_id_phone_key" ON "Lead"("business_owner_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_telecaller_id_local_log_id_key" ON "CallLog"("telecaller_id", "local_log_id");

-- AddForeignKey
ALTER TABLE "TelecallerAssignment" ADD CONSTRAINT "TelecallerAssignment_telecaller_id_fkey" FOREIGN KEY ("telecaller_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelecallerAssignment" ADD CONSTRAINT "TelecallerAssignment_business_owner_id_fkey" FOREIGN KEY ("business_owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_business_owner_id_fkey" FOREIGN KEY ("business_owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_telecaller_id_fkey" FOREIGN KEY ("telecaller_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_telecaller_id_fkey" FOREIGN KEY ("telecaller_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
