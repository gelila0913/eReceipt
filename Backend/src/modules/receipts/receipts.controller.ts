import { Request, Response, NextFunction } from "express";
import { receiptsService } from "./receipts.service.js";
import { sendCreated, sendSuccess } from "../../common/apiResponse.js";
import { ForbiddenError } from "../../common/errors.js";
import { applicationStorage } from "../../features/merchant-registration/storage.js";

export class ReceiptsController {
  async createReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== "merchant") {
        throw new ForbiddenError("Only authenticated merchants may issue receipts.");
      }
      const merchant = applicationStorage.getByTin(req.user.identifier);
      if (!merchant) {
        throw new ForbiddenError("Merchant registration was not found.");
      }
      const receipt = await receiptsService.createReceipt({
        ...req.body,
        merchantId: `MER-${merchant.tin.slice(-5)}`,
        merchantTin: merchant.tin,
        merchantName: merchant.sellerLegalName,
        merchantAddress: [merchant.buildingName, merchant.subCity, merchant.city]
          .filter(Boolean)
          .join(", "),
      });
      sendCreated(res, receipt, "Digital receipt generated and verified");
    } catch (error) {
      next(error);
    }
  }

  async getReceipts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { merchantId, status, search } = req.query;
      const receipts = await receiptsService.getReceipts({
        merchantId:
          req.user?.role === "merchant"
            ? `MER-${req.user.identifier.slice(-5)}`
            : (merchantId as string | undefined),
        status: status as string | undefined,
        search: search as string | undefined,
      });
      sendSuccess(res, receipts, "Receipts retrieved");
    } catch (error) {
      next(error);
    }
  }

  async getReceiptById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const receipt = await receiptsService.getReceiptById(id);
      if (
        req.user?.role === "merchant" &&
        receipt.merchantTin !== req.user.identifier
      ) {
        throw new ForbiddenError("Merchants may only access their own receipts.");
      }
      sendSuccess(res, receipt, "Receipt details retrieved");
    } catch (error) {
      next(error);
    }
  }

  async verifyReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const receiptNumber = String(req.params.receiptNumber);
      const result = await receiptsService.verifyReceipt(receiptNumber);
      sendSuccess(res, result, "Receipt verified against official registry");
    } catch (error) {
      next(error);
    }
  }

  async voidReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const receipt = await receiptsService.getReceiptById(id);
      if (
        req.user?.role === "merchant" &&
        receipt.merchantTin !== req.user.identifier
      ) {
        throw new ForbiddenError("Merchants may only void their own receipts.");
      }
      const voided = await receiptsService.voidReceipt(id, req.body);
      sendSuccess(res, voided, "Receipt has been marked as voided");
    } catch (error) {
      next(error);
    }
  }
}

export const receiptsController = new ReceiptsController();
