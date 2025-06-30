import { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { PrismaClient } from '@prisma/client';
import { paymobConfig } from "../configs/paymob";
import { success, error } from "../utils/responseHandler";
import { JWTPayload } from "../utils/auth";

// Initialize Prisma client
const prisma = new PrismaClient();


export const buyPlan = async (req: Request<{ id: string }>, res: Response) => {
  try {
    // Extract user data from authentication middleware
    const { userId, email, firstName, lastName ,phoneNumber} = req.user as JWTPayload;
    
    // Validate and convert plan ID
    const planId = Number(req.params.id);
    if (isNaN(planId)) {
      return error(res, "Invalid plan ID", 400);
    }

    // Fetch plan from database
    const plan = await prisma.plans.findFirst({
      where: { id: planId },
    });

    if (!plan) {
      return error(res, "Plan not found", 404);
    }

    // Prepare billing data
    const billingData = {
      email: email || "not-provided@example.com",
      first_name: firstName || "N/A",
      last_name: lastName || "N/A",
      phone_number: phoneNumber || "N/A",
      // apartment: "N/A",
      // floor: "N/A",
      // street: "N/A",
      // building: "N/A",
      // city: "N/A",
      // country: "N/A",
      // state: "N/A",
      // postal_code: "N/A",
    };

    // Prepare Paymob intention data
    const intentionData = {
      amount: plan.price, // Convert to cents as Paymob requires
      currency: "EGP",
      payment_methods: [paymobConfig.cardMethodId],
      items: [
        {
          name: plan.name,
          amount: plan.price,
          description: plan.description,
          quantity: 1,
        },
      ],
      billing_data: billingData,
      extras: {
        user:req.user,
        plan,
      },
    };

    // Create payment intention with Paymob
    const response = await axios.post(
      "https://accept.paymob.com/v1/intention/",
      intentionData,
      {
        headers: {
          Authorization: `Token ${paymobConfig.secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Generate payment link
    const clientSecret = response.data.client_secret;
    const paymentLink = `https://accept.paymob.com/unifiedcheckout/?publicKey=${paymobConfig.publicKey}&clientSecret=${clientSecret}`;

    // Store purchase intent in database
    // await prisma.purchaseIntents.create({
    //   data: {
    //     userId,
    //     planId: plan.id,
    //     clientSecret,
    //     amount: plan.amount,
    //     status: "PENDING",
    //   },
    // });

    return success(res, {
      paymentLink,
      plan: {
        id: plan.id,
        name: plan.name,
        amount: plan.price,
      },
    });

  } catch (err: any) {
    // Handle Axios-specific errors
    if (err instanceof AxiosError && err.response) {
      console.error("❌ Paymob API error:", err.response.data);
      return error(res, err.response.data.message || "Payment processing error", err.response.status || 500);
    }

    // Handle other errors
    console.error("❌ Unexpected error:", err.message);
    return error(res, "Internal server error", 500);
  }
};