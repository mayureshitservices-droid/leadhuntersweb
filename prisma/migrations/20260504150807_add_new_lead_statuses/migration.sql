-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'CB_REQUEST';
ALTER TYPE "LeadStatus" ADD VALUE 'LEFT_MSG';
ALTER TYPE "LeadStatus" ADD VALUE 'CALL_DISCONNECT';
ALTER TYPE "LeadStatus" ADD VALUE 'BANK_PTP';
ALTER TYPE "LeadStatus" ADD VALUE 'FPTP';
ALTER TYPE "LeadStatus" ADD VALUE 'PTP';
ALTER TYPE "LeadStatus" ADD VALUE 'NOT_REACHABLE';
ALTER TYPE "LeadStatus" ADD VALUE 'RNR';
ALTER TYPE "LeadStatus" ADD VALUE 'OUT_OF_SERVICE';
ALTER TYPE "LeadStatus" ADD VALUE 'SWITCH_OFF';
ALTER TYPE "LeadStatus" ADD VALUE 'INCOMING_NOT_AVAIABLE';
ALTER TYPE "LeadStatus" ADD VALUE 'PARTIAL_PAID';
ALTER TYPE "LeadStatus" ADD VALUE 'ALREADY_PAID';
ALTER TYPE "LeadStatus" ADD VALUE 'DEATH';
ALTER TYPE "LeadStatus" ADD VALUE 'CSWN';
ALTER TYPE "LeadStatus" ADD VALUE 'RTP';
