import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../common/errors.js";
import { verifyAuthToken } from "../common/authToken.js";
import { config } from "../config/index.js";
import { applicationStorage } from "../features/merchant-registration/storage.js";
import { merchantManagementStorage } from "../features/admin/merchant-management/merchant.storage.js";

export type UserRole = "merchant" | "officer" | "admin";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  identifier: string; // TIN for merchant, username for officer
  name: string;
}

function isUserRole(value: string): value is UserRole {
  return value === "merchant" || value === "officer" || value === "admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication check middleware.
 * Supports Bearer token / header-based authentication for dev & demo flexibility.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const devRoleHeader = req.headers["x-user-role"];
  const devIdHeader = req.headers["x-user-id"];

  if (!authHeader && (devRoleHeader !== undefined || devIdHeader !== undefined)) {
    if (config.nodeEnv !== "development") {
      throw new UnauthorizedError("Development authentication headers are not allowed.");
    }
    if (
      typeof devRoleHeader !== "string" ||
      !isUserRole(devRoleHeader)
    ) {
      throw new UnauthorizedError("Invalid development user role.");
    }

    req.user = {
      id: typeof devIdHeader === "string" ? devIdHeader : "dev-user-1",
      role: devRoleHeader,
      identifier: devRoleHeader === "merchant" ? "0012847391" : "officer.demo",
      name: devRoleHeader === "merchant" ? "Abeba Market" : "Revenue Officer Demo",
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Authentication token or credentials required.");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new UnauthorizedError("Invalid authorization format.");
  }

  req.user = verifyAuthToken(token);
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
