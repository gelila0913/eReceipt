import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../common/errors.js";
import { verifyJwt } from "../common/auth/security.js";
import { applicationStorage } from "../features/merchant-registration/storage.js";
import { merchantManagementStorage } from "../features/admin/merchant-management/merchant.storage.js";

export type UserRole = "merchant" | "officer" | "admin";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  identifier: string; // TIN for merchant, username for officer
  name: string;
  tin?: string;
  tradeName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
import { officerAuthService } from "../features/admin/officer-auth/index.js";

/**
 * Authentication check middleware.
 * Strictly verifies cryptographic Bearer JWT tokens and revenue officer session tokens.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authentication token is required. Format: Bearer <token>");
    }

    const token = authHeader.split(" ")[1]?.trim();
    if (!token) {
      throw new UnauthorizedError("Invalid authorization format.");
    }

    // Check if this is an authorized Revenue Officer session token
    const officer = await officerAuthService.getOfficerFromToken(authHeader);
    if (officer) {
      req.user = {
        id: officer.id,
        role: officer.role === "ADMIN" ? "admin" : "officer",
        identifier: officer.username,
        name: officer.name,
      };
      return next();
    }

    const payload = verifyJwt(token);

    req.user = {
      id: payload.sub,
      role: payload.role as UserRole,
      identifier: payload.identifier || payload.tin || payload.username || payload.sub,
      name: payload.name,
      tin: payload.tin,
      tradeName: payload.tradeName,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication middleware.
 * Attaches authenticated user if valid Bearer JWT is supplied, but does not block requests if omitted.
 * Essential for POS terminal registers issuing receipts directly.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1]?.trim();
  if (!token) {
    return next();
  }

  try {
    const officer = await officerAuthService.getOfficerFromToken(authHeader);
    if (officer) {
      req.user = {
        id: officer.id,
        role: officer.role === "ADMIN" ? "admin" : "officer",
        identifier: officer.username,
        name: officer.name,
      };
      return next();
    }
  } catch {}

  try {
    const payload = verifyJwt(token);
    req.user = {
      id: payload.sub,
      role: payload.role as UserRole,
      identifier: payload.identifier || payload.tin || payload.username || payload.sub,
      name: payload.name,
      tin: payload.tin,
      tradeName: payload.tradeName,
    };
  } catch {
    // Proceed without req.user if token is invalid or expired
  }

  next();
}

/**
 * Role-based authorization guard
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("User is not authenticated.");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied. Requires one of the following roles: ${allowedRoles.join(", ")}`
      );
    }

    next();
  };
}

export function requireMerchantSelfOrStaff(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw new UnauthorizedError("User is not authenticated.");
  }

  if (
    req.user.role === "merchant" &&
    req.params.id !== req.user.identifier
  ) {
    throw new ForbiddenError("Merchants may only access their own profile.");
  }

  next();
}

export function requireApprovedMerchant(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== "merchant") {
    throw new ForbiddenError("Only authenticated merchants may issue receipts.");
  }

  const application = applicationStorage.getByTin(req.user.identifier);
  const directoryEntry = merchantManagementStorage.getDirectoryMerchantById(
    req.user.identifier
  );
  if (
    !application ||
    application.status !== "Approved" ||
    directoryEntry?.status === "Suspended"
  ) {
    throw new ForbiddenError(
      "Only approved, active merchants may use the invoicing workflow."
    );
  }

  next();
}
