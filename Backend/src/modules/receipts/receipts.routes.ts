import { Router } from "express";
import { receiptsController } from "./receipts.controller.js";
import { ReceiptController } from "../../controllers/receiptController.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { createReceiptSchema, voidReceiptSchema } from "./receipts.schema.js";
import {
  requireAuth,
  requireApprovedMerchant,
} from "../../middleware/authMiddleware.js";

export const receiptsRouter = Router();

// POS Issue & Calculation endpoints (used by frontend POS and receipt issuance)
receiptsRouter.post(
  "/issue",
  requireAuth,
  requireApprovedMerchant,
  ReceiptController.issue
);

receiptsRouter.post(
  "/calculate",
  ReceiptController.calculate
);

// Public verification route for customers scanning QR code on a paper/digital receipt
receiptsRouter.get(
  "/verify/:receiptNumber",
  receiptsController.verifyReceipt
);

// Protected routes for merchants & officers
receiptsRouter.post(
  "/",
  requireAuth,
  requireApprovedMerchant,
  validateRequest({ body: createReceiptSchema }),
  receiptsController.createReceipt
);

receiptsRouter.get(
  "/",
  requireAuth,
  ReceiptController.list
);

receiptsRouter.get(
  "/:id",
  requireAuth,
  ReceiptController.getById
);

receiptsRouter.post(
  "/:id/void",
  requireAuth,
  requireApprovedMerchant,
  validateRequest({ body: voidReceiptSchema }),
  receiptsController.voidReceipt
);
