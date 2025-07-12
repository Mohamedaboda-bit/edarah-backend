"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyPlan = void 0;
const axios_1 = __importStar(require("axios"));
const client_1 = require("@prisma/client");
const paymob_1 = require("../configs/paymob");
const responseHandler_1 = require("../utils/responseHandler");
// Initialize Prisma client
const prisma = new client_1.PrismaClient();
const buyPlan = async (req, res) => {
    try {
        // Extract user data from authentication middleware
        const { userId, email, firstName, lastName, phoneNumber } = req.user;
        // Validate and convert plan ID
        const planId = Number(req.params.id);
        if (isNaN(planId)) {
            return (0, responseHandler_1.error)(res, "Invalid plan ID", 400);
        }
        // Fetch plan from database
        const plan = await prisma.plans.findFirst({
            where: { id: planId },
        });
        if (!plan) {
            return (0, responseHandler_1.error)(res, "Plan not found", 404);
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
            payment_methods: [paymob_1.paymobConfig.cardMethodId],
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
                user: req.user,
                plan,
            },
        };
        // Create payment intention with Paymob
        const response = await axios_1.default.post("https://accept.paymob.com/v1/intention/", intentionData, {
            headers: {
                Authorization: `Token ${paymob_1.paymobConfig.secretKey}`,
                "Content-Type": "application/json",
            },
        });
        // Generate payment link
        const clientSecret = response.data.client_secret;
        const paymentLink = `https://accept.paymob.com/unifiedcheckout/?publicKey=${paymob_1.paymobConfig.publicKey}&clientSecret=${clientSecret}`;
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
        return (0, responseHandler_1.success)(res, {
            paymentLink,
            plan: {
                id: plan.id,
                name: plan.name,
                amount: plan.price,
            },
        });
    }
    catch (err) {
        // Handle Axios-specific errors
        if (err instanceof axios_1.AxiosError && err.response) {
            console.error("❌ Paymob API error:", err.response.data);
            return (0, responseHandler_1.error)(res, err.response.data.message || "Payment processing error", err.response.status || 500);
        }
        // Handle other errors
        console.error("❌ Unexpected error:", err.message);
        return (0, responseHandler_1.error)(res, "Internal server error", 500);
    }
};
exports.buyPlan = buyPlan;
//# sourceMappingURL=paymobController.js.map