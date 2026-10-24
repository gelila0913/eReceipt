import { ForbiddenError, UnauthorizedError } from "../../common/errors.js";
import {
  MerchantLoginInput,
  OfficerLoginInput,
  MerchantPasswordResetInput,
  MerchantPasswordResetRequestInput,
} from "./auth.schema.js";
import { MerchantAuthResponse, OfficerAuthResponse } from "./auth.types.js";
import { applicationStorage } from "../../features/merchant-registration/storage.js";
import {
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
} from "../../features/merchant-registration/password.js";
import { createAuthToken } from "../../common/authToken.js";
import { otpService } from "../../services/otp.service.js";

export class AuthService {
  /**
   * Authenticate merchant by TIN and password
   */
  async loginMerchant(input: MerchantLoginInput): Promise<MerchantAuthResponse> {
    const application = applicationStorage.getByTin(input.tin);
    if (
      !application ||
      !(await verifyPassword(input.password, application.passwordHash))
    ) {
      throw new UnauthorizedError("Invalid TIN or password.");
    }

    if (!application.emailVerified) {
      throw new ForbiddenError("Verify your email address before signing in.");
    }

    if (application.status !== "Approved") {
      throw new ForbiddenError("Your merchant application has not been approved yet.");
    }

    if (needsPasswordRehash(application.passwordHash)) {
      applicationStorage.updatePasswordHash(application.tin, await hashPassword(input.password));
    }

    const user = {
      id: application.id,
      role: "merchant" as const,
      identifier: application.tin,
      name: application.sellerLegalName,
    };

    return {
      token: createAuthToken(user, input.rememberMe ? 60 * 60 * 24 * 30 : undefined),
      user: {
        id: application.id,
        role: "merchant",
        tin: application.tin,
        businessName: application.sellerLegalName,
        tradeName: application.tradeName,
        status: application.status,
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
   * Authenticate Revenue Officer by username and password
   */
  async loginOfficer(input: OfficerLoginInput): Promise<OfficerAuthResponse> {
    // Demo credentials matching frontend demo ("officer.demo" / "Revenue123")
    if (input.username !== "officer.demo" || input.password !== "Revenue123") {
      throw new UnauthorizedError("Invalid officer credentials. Check demo username and password.");
    }

    const user = {
      id: "off-001",
      role: "officer" as const,
      identifier: input.username,
      name: "Abebe Bikila",
    };

    return {
      token: createAuthToken(
        user,
        input.rememberOfficer ? 60 * 60 * 24 * 30 : undefined
      ),
      user: {
        id: "off-001",
        role: "officer",
        username: input.username,
        fullName: "Abebe Bikila",
        department: "Ministry of Revenues - Large Taxpayers Office",
      },
    };
  }
}

export const authService = new AuthService();
