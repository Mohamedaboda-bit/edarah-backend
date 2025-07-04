import { Request, Response } from "express";
import { plans, PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { paymobConfig } from "../configs/paymob";
import { JWTPayload } from "../utils/auth";

// Initialize Prisma client
const prisma = new PrismaClient();

interface PaymobWebhookPayload {
  type: string;
  obj: {
    id: number;
    amount_cents: number;
    currency: string;
    success: boolean;
    error_occured: boolean;
    created_at: string;
    integration_id: number;
    payment_key_claims: {
      extra: {
        plan: plans;
        user: JWTPayload;
      };

      Order_id: number;
      amount_cents: number;
      currency: string;
      billing_data: any;
      redirect_url: string;
      integration_id: number;
      lock_order_when_paid: boolean;
      next_payment_intention: string;
      single_payment_attempt: boolean;
    };
  };
  accept_fees: number;
  issuer_bank: string | null;
  transaction_processed_callback_responses: string;
}

// HMAC verification function
const verifyHmac = (payload: any, hmac: string): boolean => {
  const hmacSecret = paymobConfig.hmacSecret; // Ensure this is defined in paymobConfig
  if (!hmacSecret) {
    console.error("❌ HMAC secret not configured");
    return false;
  }

  const calculatedHmac = crypto
    .createHmac("sha512", hmacSecret)
    .update(JSON.stringify(payload))
    .digest("hex");

  return calculatedHmac === hmac;
};

export const handleWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payload = req.body as PaymobWebhookPayload;
    // Validate payload
    if (!payload.type || !payload.obj) {
      console.error(
        "❌ Invalid webhook payload: missing type or transaction object"
      );
      res.status(400).send("Invalid payload");
      return;
    }
    const transaction = payload.obj;
    const userId = transaction.payment_key_claims?.extra?.user?.userId;
    const planId = transaction.payment_key_claims?.extra?.plan?.id;
    const paid = transaction.success;

    if (!userId || !planId) {
      console.error("❌ Missing required fields in webhook payload");
      res.status(400).send("Missing required fields");
      return;
    }

    // // Update or create purchase intent in database
    // const purchaseIntent = await prisma.purchaseIntents.upsert({
    //   where: { clientSecret },
    //   update: {
    //     status: paid ? "SUCCESS" : "FAILED",
    //     transactionId: transaction.id,
    //     updatedAt: new Date(transaction.created_at),
    //   },
    //   create: {
    //     userId,
    //     planId,
    //     clientSecret,
    //     amount: transaction.amount_cents / 100, // Convert back to EGP
    //     status: paid ? "SUCCESS" : "FAILED",
    //     transactionId: transaction.id,
    //     createdAt: new Date(transaction.created_at),
    //   },
    // });

    // Log payment status
    if (paid) {
      console.log(
        `✅ Payment SUCCESS by user ID: ${userId}, Plan ID: ${planId}, Transaction ID: ${transaction.id}`
      );
    } else {
      console.error(
        `❌ Payment FAILED by user ID: ${userId}, Plan ID: ${planId}, Transaction ID: ${transaction.id}`
      );
    }

    // Optionally update user subscription status
    if (paid) {
      // Check if user_id exists
      const user = await prisma.users.findUnique({
        where: { id: BigInt(userId) },
      });

      if (!user) {
        console.error(`❌ User with ID ${userId} not found`);
        res.status(400).send(`User with ID ${userId} not found`);
        return;
      }

      // Check if plan_id exists
      const plan = await prisma.plans.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        console.error(`❌ Plan with ID ${planId} not found`);
        res.status(400).send(`Plan with ID ${planId} not found`);
        return;
      }

      await prisma.user_plans.upsert({
        where: {
          user_id_plan_id: {
            user_id: BigInt(userId),
            plan_id: planId,
          },
        },
        update: {
          is_active: true,
          start_date: new Date(),
          end_date: null,
          tokens_used: 0,
        },
        create: {
          user_id: BigInt(userId),
          plan_id: planId,
          is_active: true,
          start_date: new Date(),
          end_date: null,
          tokens_used: 0,
        },
      });
    }

    res.sendStatus(200);
  } catch (err: any) {
    console.error("❌ Webhook processing error:", err.message);
    res.status(500).send("Internal server error");
  }
};
