import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../common/apiResponse.js';
import { applicationStorage } from '../features/merchant-registration/storage.js';

export interface BusinessProfile {
  legalName: string;
  tradeName: string;
  tin: string;
  merchantRef: string;
  businessEmail: string;
  phoneNumber: string;
  businessAddress: string;
  isTinVerified: boolean;
}

export interface UpdateProfileDTO {
  businessEmail?: string;
  phoneNumber?: string;
  businessAddress?: string;
  legalName?: string;
  tradeName?: string;
  tin?: string;
  merchantRef?: string;
}

// In-memory profile state matching the frontend BusinessProfileTab specification
let profile: BusinessProfile = {
  legalName: '',
  tradeName: '',
  tin: '',
  merchantRef: '',
  businessEmail: '',
  phoneNumber: '',
  businessAddress: '',
  isTinVerified: true,
};

/**
 * GET /api/settings/profile
 * Retrieves the current business profile.
 */
export const getProfile = (req: Request, res: Response): void => {
  const tinQuery =
    (req.query.tin as string) ||
    (req as any).user?.tin ||
    (req as any).user?.identifier;
  if (tinQuery) {
    const app = applicationStorage.getByTin(tinQuery);
    if (app) {
      sendSuccess(
        res,
        {
          legalName: app.sellerLegalName || '',
          tradeName: app.tradeName || '',
          tin: app.tin,
          merchantRef: app.referenceNumber || '',
          businessEmail: app.email || '',
          phoneNumber: app.phoneNumber || '',
          businessAddress: [app.buildingName, app.subCity, app.city].filter(Boolean).join(', '),
          isTinVerified: true,
        },
        'Business profile retrieved successfully'
      );
      return;
    }
  }

  // Fallback to active registered merchant application if available
  const allApps = applicationStorage.getAll();
  const latestApproved = allApps.find((a) => a.status === 'Approved') || allApps[0];
  if (latestApproved) {
    sendSuccess(
      res,
      {
        legalName: latestApproved.sellerLegalName || '',
        tradeName: latestApproved.tradeName || '',
        tin: latestApproved.tin,
        merchantRef: latestApproved.referenceNumber || '',
        businessEmail: latestApproved.email || '',
        phoneNumber: latestApproved.phoneNumber || '',
        businessAddress: [latestApproved.buildingName, latestApproved.subCity, latestApproved.city]
          .filter(Boolean)
          .join(', '),
        isTinVerified: true,
      },
      'Business profile retrieved successfully'
    );
    return;
  }

  sendSuccess(res, { ...profile }, 'Business profile retrieved successfully');
};

/**
 * PATCH /api/settings/profile
 * Updates the business profile fields with strict security validation.
 */
export const updateProfile = (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as UpdateProfileDTO;

  // Strict Security Guard: TIN and Merchant Reference are verified and immutable
  if (
    (body.tin !== undefined && body.tin !== profile.tin) ||
    (body.merchantRef !== undefined && body.merchantRef !== profile.merchantRef)
  ) {
    sendError(res, 'TIN and Merchant Reference are verified and immutable', 400);
    return;
  }

  // Validate email format with basic regex
  if (body.businessEmail !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof body.businessEmail !== 'string' || !emailRegex.test(body.businessEmail.trim())) {
      sendError(res, 'Invalid business email format', 400);
      return;
    }
  }

  // Validate phone presence
  if (body.phoneNumber !== undefined) {
    if (typeof body.phoneNumber !== 'string' || body.phoneNumber.trim().length === 0) {
      sendError(res, 'Phone number is required and cannot be empty', 400);
      return;
    }
  }

  // Validate business address
  if (body.businessAddress !== undefined) {
    if (typeof body.businessAddress !== 'string' || body.businessAddress.trim().length === 0) {
      sendError(res, 'Business address is required and cannot be empty', 400);
      return;
    }
  }

  // Apply updates
  if (body.businessEmail !== undefined) {
    profile.businessEmail = body.businessEmail.trim();
  }
  if (body.phoneNumber !== undefined) {
    profile.phoneNumber = body.phoneNumber.trim();
  }
  if (body.businessAddress !== undefined) {
    profile.businessAddress = body.businessAddress.trim();
  }
  if (body.legalName !== undefined && typeof body.legalName === 'string' && body.legalName.trim().length > 0) {
    profile.legalName = body.legalName.trim();
  }
  if (body.tradeName !== undefined && typeof body.tradeName === 'string' && body.tradeName.trim().length > 0) {
    profile.tradeName = body.tradeName.trim();
  }

  const tin =
    (req.query.tin as string) ||
    (req as any).user?.tin ||
    (req as any).user?.identifier;
  if (tin) {
    applicationStorage.updateProfileDetails(tin, {
      phoneNumber: body.phoneNumber,
      email: body.businessEmail,
      sellerLegalName: body.legalName,
      tradeName: body.tradeName,
    });
  }

  sendSuccess(res, { ...profile }, 'Business profile updated successfully');
};

export const settingsController = {
  getProfile,
  updateProfile,
};

export class SettingsController {
  public static getProfile = getProfile;
  public static updateProfile = updateProfile;
}

export default settingsController;
