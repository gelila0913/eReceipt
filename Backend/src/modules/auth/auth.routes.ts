import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  merchantLoginSchema,
  merchantPasswordResetRequestSchema,
  merchantPasswordResetSchema,
  officerLoginSchema,
} from "./auth.schema.js";
import { requireAuth } from "../../middleware/authMiddleware.js";

export const authRouter = Router();

authRouter.post(
  "/merchant/login",
  validateRequest({ body: merchantLoginSchema }),
  authController.loginMerchant
);

authRouter.post(
  "/officer/login",
  validateRequest({ body: officerLoginSchema }),
  authController.loginOfficer
);

authRouter.post(
  "/merchant/password-reset/request",
  validateRequest({ body: merchantPasswordResetRequestSchema }),
  authController.requestMerchantPasswordReset
);

authRouter.post(
  "/merchant/password-reset/confirm",
  validateRequest({ body: merchantPasswordResetSchema }),
  authController.resetMerchantPassword
);

authRouter.get(
  "/me",
  requireAuth,
  authController.getCurrentUser
);
