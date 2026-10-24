import type { Request, Response } from 'express';
import { officerAuthService } from './auth.service.js';

export class OfficerAuthController {
  /**
   * POST /api/admin/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password, rememberMe } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Username and password are required',
        });
        return;
      }

      const authResult = await officerAuthService.login({
        username,
        password,
        rememberMe: Boolean(rememberMe),
      });

      res.status(200).json({
        success: true,
        message: authResult.requires2FA
          ? 'Security code sent to your registered email.'
          : 'Revenue Officer authenticated successfully',
        data: authResult,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || 'Authentication failed',
      });
    }
  }

  /**
   * POST /api/admin/auth/verify-2fa
   */
  async verify2FA(req: Request, res: Response): Promise<void> {
    try {
      const { tempToken, code } = req.body;
      if (!tempToken || !code) {
        res.status(400).json({
          success: false,
          error: 'Verification session token and 6-digit code are required',
        });
        return;
      }

      const authResult = await officerAuthService.verify2FA({ tempToken, code });
      res.status(200).json({
        success: true,
        message: 'Two-factor authentication successful',
        data: authResult,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || 'Invalid or expired verification code',
      });
    }
  }

  /**
   * POST /api/admin/auth/resend-2fa
   */
  async resend2FA(req: Request, res: Response): Promise<void> {
    try {
      const { tempToken } = req.body;
      if (!tempToken) {
        res.status(400).json({
          success: false,
          error: 'Verification session token is required to resend code',
        });
        return;
      }

      const resendResult = await officerAuthService.resend2FA(tempToken);
      if (!resendResult.success) {
        res.status(429).json(resendResult);
        return;
      }

      res.status(200).json(resendResult);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to resend verification code',
      });
    }
  }

  /**
   * POST /api/admin/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { fullName, username, badgeNumber, email, branch, role, password } = req.body;

      const cleanFullName = typeof fullName === 'string' ? fullName.trim() : '';
      const cleanUsername = typeof username === 'string' ? username.trim() : '';
      const cleanBadge = typeof badgeNumber === 'string' ? badgeNumber.trim().toUpperCase() : '';
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const cleanPassword = typeof password === 'string' ? password : '';

      if (!cleanFullName || !cleanUsername || !cleanBadge || !cleanEmail || !cleanPassword) {
        res.status(400).json({
          success: false,
          error: 'Full name, username, badge number, email, and password are all required.',
        });
        return;
      }

      if (cleanFullName.length < 3) {
        res.status(400).json({
          success: false,
          error: 'Full name must be at least 3 characters long.',
        });
        return;
      }

      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(cleanUsername)) {
        res.status(400).json({
          success: false,
          error: 'Username must be 3-30 characters and contain only letters, numbers, dots, or underscores.',
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({
          success: false,
          error: 'Please enter a valid official email address.',
        });
        return;
      }

      if (cleanPassword.length < 6) {
        res.status(400).json({
          success: false,
          error: 'Password must contain at least 6 characters.',
        });
        return;
      }

      const allowedRoles = ['REVENUE_OFFICER', 'SENIOR_AUDITOR', 'ADMIN'];
      const assignedRole = allowedRoles.includes(role) ? role : 'REVENUE_OFFICER';
      const cleanBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : 'Addis Ababa Large Taxpayers Branch';

      const authResult = await officerAuthService.register({
        fullName: cleanFullName,
        username: cleanUsername,
        badgeNumber: cleanBadge,
        email: cleanEmail,
        branch: cleanBranch,
        role: assignedRole,
        password: cleanPassword,
      });

      res.status(201).json({
        success: true,
        message: 'Revenue Officer registered successfully',
        data: authResult,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  }

  /**
   * GET /api/admin/auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization || '';
      const officer = await officerAuthService.getOfficerFromToken(authHeader);

      if (!officer) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired officer session',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: officer,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve officer profile',
      });
    }
  }

  /**
   * GET /api/admin/auth/check-availability
   */
  async checkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const username = typeof req.query.username === 'string' ? req.query.username : undefined;
      const badgeNumber = typeof req.query.badgeNumber === 'string' ? req.query.badgeNumber : undefined;
      const email = typeof req.query.email === 'string' ? req.query.email : undefined;

      const availability = officerAuthService.checkAvailability({ username, badgeNumber, email });
      res.status(200).json({ success: true, ...availability });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check officer credential availability',
      });
    }
  }

  /**
   * POST /api/admin/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization || '';
      await officerAuthService.logout(authHeader);

      res.status(200).json({
        success: true,
        message: 'Signed out successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Logout failed',
      });
    }
  }

  /**
   * GET /api/admin/auth/officers
   */
  async listOfficers(_req: Request, res: Response): Promise<void> {
    try {
      const officers = officerAuthService.getAllOfficers();
      res.status(200).json({
        success: true,
        data: officers,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list officers',
      });
    }
  }

  /**
   * DELETE /api/admin/auth/officers/:id
   */
  async deleteOfficer(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const success = officerAuthService.deactivateOfficer(id);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Officer not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Officer removed successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to deactivate officer',
      });
    }
  }
}

export const officerAuthController = new OfficerAuthController();
