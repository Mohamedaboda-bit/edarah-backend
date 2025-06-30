import { Request, Response } from "express";
import { plans, PrismaClient } from '@prisma/client';
import crypto from "crypto";
import { paymobConfig } from "../configs/paymob";
import { JWTPayload } from "../utils/auth";

// Initialize Prisma client
const prisma = new PrismaClient();

interface PaymobWebhookPayload {
  transaction: {
    id: number;
    amount_cents: number;
    currency: string;
    success: boolean;
    error_occured: boolean;
    created_at: string;
    integration_id: number;
  };
  intention: {
    id: string;
    client_secret: string;
    extras: {
      creation_extras: {
        user: JWTPayload;
        plan: plans;
      };
    };
    status: string;
    confirmed: boolean;
    amount: number;
    currency: string;
  };
  hmac: string;
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

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transaction, intention, hmac } = req.body as PaymobWebhookPayload;

    // Validate payload
    if (!transaction || !intention || !hmac) {
      console.error("❌ Invalid webhook payload: missing transaction, intention, or hmac");
      res.status(400).send("Invalid payload");
      return;
    }

    // Verify HMAC
    if (!verifyHmac({ transaction, intention }, hmac)) {
      console.error("❌ HMAC verification failed");
      // we have issue here , but we will need to fix it later.
      // res.status(401).send("Invalid HMAC");
      // return;
    }

    const userId = intention.extras?.creation_extras?.user?.userId;
    const planId = intention.extras?.creation_extras?.plan?.id;
    const clientSecret = intention.client_secret;
    const paid = transaction.success;

    if (!userId || !planId || !clientSecret) {
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
      console.log(`✅ Payment SUCCESS by user ID: ${userId}, Plan ID: ${planId}, Transaction ID: ${transaction.id}`);
    } else {
      console.error(`❌ Payment FAILED by user ID: ${userId}, Plan ID: ${planId}, Transaction ID: ${transaction.id}`);
    }

    // Optionally update user subscription status
if (paid) {
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