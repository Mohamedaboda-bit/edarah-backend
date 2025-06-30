export const paymobConfig = {
  secretKey: process.env.PAYMOB_SECRET_KEY!,
  publicKey: process.env.PAYMOB_PUBLIC_KEY!,
  hmacSecret: process.env.PAYMOB_HMAC_SECRET!,
  cardMethodId: Number(process.env.PAYMOB_CARD_METHOD_ID)
};
