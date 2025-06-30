import { Router } from "express";
import { handleWebhook } from "../controllers/paymobWebhookController";

const router = Router();

router.post("/webhook", handleWebhook);

export default router;
