import { Router } from "express";
import { merchantsController } from "./merchants.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  merchantRegistrationSchema,
  updateMerchantStatusSchema,
} from "./merchants.schema.js";
import {
  requireAuth,
  requireMerchantSelfOrStaff,
  requireRole,
} from "../../middleware/authMiddleware.js";

export const merchantsRouter = Router();

// Public: Merchant registration
merchantsRouter.post(
  "/register",
  validateRequest({ body: merchantRegistrationSchema }),
  merchantsController.register
);

// Protected (Officer/Admin): Review applications
merchantsRouter.get(
  "/applications",
  requireAuth,
  requireRole("officer", "admin"),
  merchantsController.getAllApplications
);

merchantsRouter.get(
  "/applications/:id",
  requireAuth,
  requireRole("officer", "admin"),
  merchantsController.getApplicationById
);

merchantsRouter.patch(
  "/applications/:id/status",
  requireAuth,
  requireRole("officer", "admin"),
  validateRequest({ body: updateMerchantStatusSchema }),
  merchantsController.updateStatus
);

// Merchant profile
merchantsRouter.get(
  "/profile/:id",
  requireAuth,
  requireMerchantSelfOrStaff,
  merchantsController.getProfile
);
