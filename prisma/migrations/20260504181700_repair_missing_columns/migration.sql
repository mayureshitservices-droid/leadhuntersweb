-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "additional_data" JSONB;

-- AlterTable
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "local_log_id" TEXT;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CallLog_telecaller_id_local_log_id_key') THEN
        CREATE UNIQUE INDEX "CallLog_telecaller_id_local_log_id_key" ON "CallLog"("telecaller_id", "local_log_id");
    END IF;
END $$;
