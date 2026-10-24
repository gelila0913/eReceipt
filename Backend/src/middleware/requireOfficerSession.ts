import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../common/errors.js';
import { officerAuthService } from '../features/admin/officer-auth/index.js';

export async function requireOfficerSession(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const officer = await officerAuthService.getOfficerFromToken(
      req.headers.authorization || ''
    );
    if (!officer) {
      throw new UnauthorizedError('A valid revenue officer session is required.');
    }

    req.user = {
      id: officer.id,
      role: officer.role === 'ADMIN' ? 'admin' : 'officer',
      identifier: officer.username,
      name: officer.name,
    };
    next();
  } catch (error) {
    next(error);
  }
}
