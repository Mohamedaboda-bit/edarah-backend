"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const paymob_1 = require("../configs/paymob");
// Initialize Prisma client
const prisma = new client_1.PrismaClient();
// HMAC verification function
const verifyHmac = (payload, hmac) => {
    const hmacSecret = paymob_1.paymobConfig.hmacSecret; // Ensure this is defined in paymobConfig
    if (!hmacSecret) {
        console.error("❌ HMAC secret not configured");
        return false;
    }
    const calculatedHmac = crypto_1.default
        .createHmac("sha512", hmacSecret)
        .update(JSON.stringify(payload))
        .digest("hex");
    return calculatedHmac === hmac;
};
const handleWebhook = async (req, res) => {
    try {
        const payload = req.body;
        // Validate payload
        if (!payload.type || !payload.obj) {
            console.error("❌ Invalid webhook payload: missing type or transaction object");
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
            console.log(`✅ Payment SUCCESS by user ID: ${userId}, Plan ID: ${planId}, Transaction ID: ${transaction.id}`);
        }
        else {
            console.error(`❌ Payment FAILED by user ID: ${userId}, Plan ID: ${planId}, Transaction ID: ${transaction.id}`);
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
    }
    catch (err) {
        console.error("❌ Webhook processing error:", err.message);
        res.status(500).send("Internal server error");
    }
};
exports.handleWebhook = handleWebhook;
//# sourceMappingURL=paymobWebhookController.js.map