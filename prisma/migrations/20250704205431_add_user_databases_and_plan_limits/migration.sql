/*
  Warnings:

  - You are about to drop the column `db_connection_string` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "database_limit_number" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "db_connection_string";

-- CreateTable
CREATE TABLE "user_databases" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "database_type" TEXT NOT NULL,
    "connection_string" TEXT NOT NULL,
    "database_name" TEXT,
    "schema_cache" JSONB,
    "last_schema_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_databases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_databases_user_id_database_name_key" ON "user_databases"("user_id", "database_name");

-- AddForeignKey
ALTER TABLE "user_databases" ADD CONSTRAINT "user_databases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
