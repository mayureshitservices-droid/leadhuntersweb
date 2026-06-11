-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_owner_id_fkey";

-- CreateTable
CREATE TABLE "TelecallerStatus" (
    "telecaller_name" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_seen_at" BIGINT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelecallerStatus_pkey" PRIMARY KEY ("telecaller_name")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
