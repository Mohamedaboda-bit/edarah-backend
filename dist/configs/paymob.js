"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymobConfig = void 0;
exports.paymobConfig = {
    secretKey: process.env.PAYMOB_SECRET_KEY,
    publicKey: process.env.PAYMOB_PUBLIC_KEY,
    hmacSecret: process.env.PAYMOB_HMAC_SECRET,
    cardMethodId: Number(process.env.PAYMOB_CARD_METHOD_ID)
};
//# sourceMappingURL=paymob.js.map