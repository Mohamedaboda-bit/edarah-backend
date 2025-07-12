"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymobWebhookController_1 = require("../controllers/paymobWebhookController");
const router = (0, express_1.Router)();
router.post("/webhook", paymobWebhookController_1.handleWebhook);
exports.default = router;
//# sourceMappingURL=paymobWebook.js.map