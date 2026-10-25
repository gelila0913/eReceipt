import { Router, Request, Response } from 'express';
import { otpService } from '../services/otp.service.js';

export const otpRouter = Router();

/**
 * POST /api/otp/send
 * Request body: { email: string, purpose?: string, recipientName?: string }
 */
otpRouter.post('/send', async (req: Request, res: Response) => {
  try {
    const { email, purpose = 'auth', recipientName } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }

    const cleanPurpose = typeof purpose === 'string' && purpose.trim() ? purpose.trim() : 'auth';
    const cleanName = typeof recipientName === 'string' ? recipientName.trim() : undefined;

    const result = await otpService.sendOtp(cleanEmail, cleanPurpose, cleanName);
    if (!result.success) {
      res.status(429).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to dispatch verification code.' });
  }
});

/**
 * POST /api/otp/verify
 * Request body: { email: string, code: string, purpose?: string }
 */
otpRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { email, code, purpose = 'auth' } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanCode = typeof code === 'string' ? code.trim() : '';

    if (!cleanEmail || !cleanCode) {
      res.status(400).json({ success: false, error: 'Both email and 6-digit code are required.' });
      return;
    }

    const cleanPurpose = typeof purpose === 'string' && purpose.trim() ? purpose.trim() : 'auth';
    const result = otpService.verifyOtp(cleanEmail, cleanCode, cleanPurpose);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'OTP verification failed.' });
  }
});

/**
 * POST /api/otp/resend
 * Request body: { email: string, purpose?: string, recipientName?: string }
 */
otpRouter.post('/resend', async (req: Request, res: Response) => {
  try {
    const { email, purpose = 'auth', recipientName } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }

    const cleanPurpose = typeof purpose === 'string' && purpose.trim() ? purpose.trim() : 'auth';
    const cleanName = typeof recipientName === 'string' ? recipientName.trim() : undefined;

    const result = await otpService.sendOtp(cleanEmail, cleanPurpose, cleanName);
    if (!result.success) {
      res.status(429).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to resend verification code.' });
  }
});

/**
 * GET /api/otp/status
 * Query parameters: email (required), purpose (optional, defaults to 'auth')
 */
otpRouter.get('/status', (req: Request, res: Response) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const purpose = typeof req.query.purpose === 'string' && req.query.purpose.trim() ? req.query.purpose.trim() : 'auth';

    if (!email || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'A valid email query parameter is required.' });
      return;
    }

    const status = otpService.checkEmailVerificationStatus(email, purpose);
    res.status(200).json({ success: true, email, purpose, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to check OTP status.' });
  }
});
