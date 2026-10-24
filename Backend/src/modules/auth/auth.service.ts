import { ForbiddenError, UnauthorizedError } from "../../common/errors.js";
import {
  MerchantLoginInput,
  OfficerLoginInput,
  MerchantPasswordResetInput,
  MerchantPasswordResetRequestInput,
} from "./auth.schema.js";
import { MerchantAuthResponse, OfficerAuthResponse } from "./auth.types.js";
import { applicationStorage } from "../../features/merchant-registration/storage.js";
import { verifyPassword, hashPassword, signJwt } from "../../common/auth/security.js";
import { otpService } from "../../services/otp.service.js";
import { officerAuthService } from "../../features/admin/officer-auth/auth.service.js";

export class AuthService {
  /**
   * Authenticate merchant by TIN and password against registered applications
   */
  async loginMerchant(input: MerchantLoginInput): Promise<MerchantAuthResponse> {
    const tin = (input.tin || "").trim();

    if (tin.length !== 10) {
      throw new UnauthorizedError("Valid 10-digit Ethiopian TIN is required.");
    }

    if (!input.password || input.password.length < 6) {
      throw new UnauthorizedError("Password must be at least 6 characters.");
    }

    // 1. Look up merchant application by TIN
    const app = applicationStorage.getByTin(tin);

    if (!app) {
      throw new UnauthorizedError(`No merchant registered with TIN ${tin}. Please complete registration first.`);
    }

    // 2. Enforce approval status checks
    if (app.status === "Pending") {
      throw new ForbiddenError(
        `Application ${app.referenceNumber} is PENDING approval by the Ministry of Revenues. Please wait for an officer review.`
      );
    }
    if (app.status === "Under Review") {
      throw new ForbiddenError(
        `Application ${app.referenceNumber} is currently UNDER REVIEW by the Ministry of Revenues.`
      );
    }
    if (app.status === "Additional Information Required") {
      throw new ForbiddenError(
        `Application ${app.referenceNumber} requires additional information: ${app.reviewNotes || "Please contact MoR."}`
      );
    }
    if (app.status === "Rejected") {
      throw new ForbiddenError(
        `Application ${app.referenceNumber} was REJECTED: ${app.reviewNotes || "Please submit a new application."}`
      );
    }
    if (app.status !== "Approved") {
      throw new ForbiddenError(`Merchant account is not active (Current status: ${app.status}).`);
    }

    // Enforce email verification if email was provided
    if (app.email && app.emailVerified === false) {
      throw new ForbiddenError(
        "Your email address has not been verified. Please verify your email via OTP before logging in."
      );
    }

    // 3. Verify password hash using constant-time comparison
    const isPasswordValid = verifyPassword(input.password, app.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials. The password provided does not match this TIN.");
    }

    // 4. Issue genuine signed JWT
    const token = signJwt({
      sub: app.id,
      role: "merchant",
      identifier: app.tin,
      name: app.sellerLegalName,
      tin: app.tin,
      tradeName: app.tradeName,
      status: app.status,
    });

    return {
      token,
      user: {
        id: app.id,
        role: "merchant",
        tin: app.tin,
        businessName: app.sellerLegalName,
        tradeName: app.tradeName,
        status: app.status,
        phoneNumber: app.phoneNumber || "",
        email: app.email || "",
        fullName: app.fullName || "",
        businessLicenseNumber: app.businessLicenseNumber || "",
        city: app.city || "",
        subCity: app.subCity || "",
        buildingName: app.buildingName || "",
        floor: app.floor || "",
        gpsLocation: app.gpsLocation || "",
        referenceNumber: app.referenceNumber || "",
        submissionDate: app.submissionDate || "",
      },
    };
  }

  async requestMerchantPasswordReset(
    input: MerchantPasswordResetRequestInput
  ): Promise<void> {
    const application = applicationStorage.getByEmail(input.email);
    if (!application?.emailVerified || !application.email) {
      return;
    }

    await otpService.sendOtp(
      application.email,
      "merchant_password_reset",
      application.fullName
    );
  }

  async resetMerchantPassword(input: MerchantPasswordResetInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    if (!otpService.consumeVerifiedEmail(email, "merchant_password_reset")) {
      throw new ForbiddenError(
        "Verify the password reset code before choosing a new password."
      );
    }

    const application = applicationStorage.getByEmail(email);
    if (!application?.emailVerified) {
      throw new UnauthorizedError("Password reset request is invalid.");
    }

    applicationStorage.updatePasswordHash(
      application.tin,
      await hashPassword(input.password)
    );
  }

  /**
   * Authenticate Revenue Officer by username and password.
   * Delegates to the disk-persisted officerAuthService (supports multiple officers,
   * officer registration, and 2FA).
   */
  async loginOfficer(input: OfficerLoginInput): Promise<OfficerAuthResponse> {
    // Delegate to the real officer auth which uses disk-persisted admin-officers.json
    const loginResult = await officerAuthService.login({
      username: input.username,
      password: input.password,
      rememberMe: false,
    });

    // If 2FA is required, surface that requirement
    if (loginResult.requires2FA) {
      // Return a partial response indicating 2FA challenge
      return {
        token: loginResult.tempToken || "",
        requires2FA: true,
        maskedEmail: loginResult.maskedEmail,
        user: {
          id: "",
          role: "officer",
          username: input.username,
          fullName: "",
          department: "",
        },
      } as any;
    }

    // Should not reach here for officer login since 2FA is always required
    throw new UnauthorizedError("Officer authentication requires 2-factor verification.");
  }
}

export const authService = new AuthService();
