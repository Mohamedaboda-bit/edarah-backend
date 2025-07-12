/*
  Warnings:

  - A unique constraint covering the columns `[user_id,plan_id]` on the table `user_plans` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_plans_user_id_plan_id_key" ON "user_plans"("user_id", "plan_id");
