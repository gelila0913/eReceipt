import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { sendSuccess } from "../../common/apiResponse.js";

export class AuthController {
  async loginMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.loginMerchant(req.body);
      sendSuccess(res, result, "Merchant logged in successfully");
    } catch (error) {
      next(error);
    }
  }

  async loginOfficer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.loginOfficer(req.body);
      sendSuccess(res, result, "Officer signed in successfully");
    } catch (error) {
      next(error);
    }
  }

  async requestMerchantPasswordReset(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.requestMerchantPasswordReset(req.body);
      sendSuccess(
        res,
        null,
        "If the verified merchant email matches an account, a reset code has been sent."
      );
    } catch (error) {
      next(error);
    }
  }

  async resetMerchantPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.resetMerchantPassword(req.body);
      sendSuccess(res, null, "Merchant password updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, req.user || null, "Current user retrieved");
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
