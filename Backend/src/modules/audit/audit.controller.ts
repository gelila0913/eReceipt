import { Request, Response, NextFunction } from "express";
import { auditService } from "./audit.service.js";
import { sendSuccess } from "../../common/apiResponse.js";

export class AuditController {
  async getMonthlyRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate = "2026-01-01", endDate = "2026-10-31" } = req.query;
      const merchantTin = req.user?.role === 'merchant' ? req.user.identifier : (req.query.merchantTin as string | undefined);
      const records = await auditService.getMonthlyRecords({
        startDate: startDate as string,
        endDate: endDate as string,
      }, merchantTin);
      sendSuccess(res, records, "Monthly records retrieved");
    } catch (error) {
      next(error);
    }
  }

  async calculateTax(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, merchantTin: bodyTin } = req.body;
      const merchantTin = req.user?.role === 'merchant' ? req.user.identifier : bodyTin;
      const result = await auditService.calculateTaxPeriod({ startDate, endDate }, merchantTin);
      sendSuccess(res, result, "Tax calculation completed successfully");
    } catch (error) {
      next(error);
    }
  }

  async approveTax(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userIdentifier = req.user?.identifier || "merchant-demo";
      const result = await auditService.approveTax(req.body, userIdentifier);
      sendSuccess(res, result, "Tax period declaration approved");
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Merchants see only their own logs; officers see all
      const merchantTin = req.user?.role === 'merchant' ? req.user.identifier : undefined;
      const logs = await auditService.getAuditLogs(merchantTin);
      sendSuccess(res, logs, "Audit event logs retrieved");
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
