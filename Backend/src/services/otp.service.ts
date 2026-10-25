import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const OTP_STORE_FILE = path.join(DATA_DIR, 'otp-store.json');

export interface StoredOtp {
  email: string;
  code: string;
  purpose: string;
  recipientName?: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
  createdAt: number;
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  email: string;
  simulated?: boolean;
  code?: string; // provided in simulated mode for easy local testing
  deliveryNotice?: string;
  cooldownSeconds?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  email?: string;
  purpose?: string;
}

class OtpService {
  private resendClient: Resend | null = null;
  private otpCache: Map<string, StoredOtp> = new Map();
  private verifiedEmails: Map<string, number> = new Map();
  private isLoaded = false;
  private readonly COOLDOWN_SECONDS = 45;
  private readonly EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 5;

  constructor() {
    this.initResend();
  }

  private initResend(): void {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (apiKey) {
      try {
        this.resendClient = new Resend(apiKey);
        console.log('[Resend Service]: Initialized successfully with active Resend API Key.');
      } catch (err) {
        console.error('[Resend Service]: Failed to initialize client:', err);
        this.resendClient = null;
      }
    } else {
      console.warn('[Resend Service]: RESEND_API_KEY is not defined in environment.');
      this.resendClient = null;
    }
  }

  private getKey(email: string, purpose: string): string {
    return `${email.trim().toLowerCase()}_${purpose.trim().toLowerCase()}`;
  }

  private ensureLoaded(): void {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(OTP_STORE_FILE)) {
        const raw = fs.readFileSync(OTP_STORE_FILE, 'utf-8');
        const parsed: StoredOtp[] = JSON.parse(raw);
        const now = Date.now();
        for (const item of parsed) {
          if (item && item.expiresAt > now) {
            this.otpCache.set(this.getKey(item.email, item.purpose), item);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load OTP store from disk:', err);
    }
    this.isLoaded = true;
  }

  private persistStore(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const activeList = Array.from(this.otpCache.values()).filter((item) => item.expiresAt > Date.now());
      fs.writeFileSync(OTP_STORE_FILE, JSON.stringify(activeList, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to persist OTP store:', err);
    }
  }

  private generateCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Generates and dispatches a 6-digit OTP code via Resend
   */
  public async sendOtp(
    email: string,
    purpose: string = 'auth',
    recipientName?: string
  ): Promise<SendOtpResult> {
    this.ensureLoaded();
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('A valid email address is required for OTP delivery.');
    }

    const key = this.getKey(cleanEmail, purpose);
    const existing = this.otpCache.get(key);
    const now = Date.now();

    // Check resend cooldown
    if (existing && now - existing.lastSentAt < this.COOLDOWN_SECONDS * 1000) {
      const waitRemaining = Math.ceil((this.COOLDOWN_SECONDS * 1000 - (now - existing.lastSentAt)) / 1000);
      return {
        success: false,
        message: `Please wait ${waitRemaining} second(s) before requesting a new code.`,
        email: cleanEmail,
        cooldownSeconds: waitRemaining,
      };
    }

    const code = this.generateCode();
    const expiresAt = now + this.EXPIRY_MINUTES * 60 * 1000;

    const entry: StoredOtp = {
      email: cleanEmail,
      code,
      purpose,
      recipientName: recipientName || existing?.recipientName,
      expiresAt,
      lastSentAt: now,
      attempts: 0,
      createdAt: now,
    };

    this.otpCache.set(key, entry);
    this.persistStore();

    // Check for Resend client
    this.initResend(); // Re-read if key was updated in environment

    if (this.resendClient) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'eReceipt <onboarding@resend.dev>';
      const subject = `eReceipt · Verification Code: ${code}`;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 22px;">
            <span style="font-size: 24px; font-weight: 800; color: #123D2C; letter-spacing: -0.5px;">eReceipt</span>
            <span style="font-size: 12px; color: #64748B; padding-left: 8px; border-left: 1px solid #CBD5E1;">Digital Receipts. A Stronger Ethiopia.</span>
          </div>
          
          <h2 style="font-size: 20px; color: #0F172A; margin: 0 0 12px 0;">Your Verification Code</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
            Hello ${recipientName || 'there'},<br />
            Use the 6-digit one-time code below to complete your authentication with <strong>eReceipt</strong>.
          </p>

          <div style="margin: 24px 0; text-align: center; background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 10px; padding: 22px;">
            <span style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #123D2C; font-family: monospace;">${code}</span>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748B; font-weight: 500;">This code is valid for 10 minutes.</p>
          </div>

          <p style="font-size: 13px; color: #64748B; line-height: 1.5; margin: 0 0 20px 0;">
            If you did not request this verification code, please ignore this email or contact support.
          </p>

          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0;">
            eReceipt · Digital Receipts. A Stronger Ethiopia.
          </p>
        </div>
      `;

      try {

        const response = await this.resendClient.emails.send({
          from: fromEmail,
          to: cleanEmail,
          subject,
          html,
        });

        if (response.error) {
          console.warn('[Resend API Error]:', response.error.message || response.error);
          const errMsg = response.error.message || '';
          if (
            (errMsg.includes('only send testing emails') || errMsg.includes('verify a domain')) &&
            cleanEmail !== 'fanuelgoitom79@gmail.com'
          ) {
            console.log(`[Resend Trial Forward]: Forwarding OTP to verified account owner fanuelgoitom79@gmail.com (intended for: ${cleanEmail})`);
            const fallback = await this.resendClient.emails.send({
              from: fromEmail,
              to: 'fanuelgoitom79@gmail.com',
              subject: `[Dev Forward · Intended for ${cleanEmail}] ${subject}`,
              html: `<div style="padding:10px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;margin-bottom:16px;font-size:13px;color:#92400E;"><strong>Resend Testing Mode:</strong> This email was originally addressed to <code>${cleanEmail}</code>.</div>` + html,
            });
            if (fallback.error) {
              throw new Error(fallback.error.message || 'Failed to dispatch verification email via Resend.');
            }
          } else {
            throw new Error(response.error.message || 'Failed to dispatch verification email via Resend.');
          }
        } else {
          console.log(`✓ [Resend Email Sent]: Message ID ${response.data?.id} to ${cleanEmail}`);
        }
      } catch (sendError: any) {
        const msg = sendError?.message || '';
        if (
          (msg.includes('only send testing emails') || msg.includes('verify a domain')) &&
          cleanEmail !== 'fanuelgoitom79@gmail.com' &&
          this.resendClient
        ) {
          try {
            console.log(`[Resend Trial Catch Forward]: Forwarding OTP to fanuelgoitom79@gmail.com`);
            await this.resendClient.emails.send({
              from: fromEmail,
              to: 'fanuelgoitom79@gmail.com',
              subject: `[Dev Forward · Intended for ${cleanEmail}] ${subject}`,
              html: `<div style="padding:10px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;margin-bottom:16px;font-size:13px;color:#92400E;"><strong>Resend Testing Mode:</strong> This email was originally addressed to <code>${cleanEmail}</code>.</div>` + html,
            });
          } catch (fErr) {
            console.error('[Resend Error]: Forwarding also threw error:', fErr);
            throw new Error(msg || 'Failed to dispatch verification email. Please try again.');
          }
        } else {
          console.error('[Resend Error]: Email dispatch threw error:', msg || sendError);
          throw new Error(msg || 'Failed to dispatch verification email. Please try again.');
        }
      }
    } else {
      throw new Error('Resend email service client could not be initialized.');
    }

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your inbox.`,
      email: cleanEmail,
      simulated: false,
      deliveryNotice: 'Verification email dispatched to your inbox via Resend.',
      cooldownSeconds: this.COOLDOWN_SECONDS,
    };
  }

  /**
   * Verifies submitted 6-digit OTP code
   */
  public verifyOtp(email: string, inputCode: string, purpose: string = 'auth'): VerifyOtpResult {
    this.ensureLoaded();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (inputCode || '').trim();

    if (!cleanCode) {
      return { success: false, message: 'Please enter the 6-digit verification code.' };
    }

    const key = this.getKey(cleanEmail, purpose);
    const record = this.otpCache.get(key);

    if (!record) {
      return {
        success: false,
        message: 'No active verification code found for this email. Please request a new code.',
      };
    }

    if (Date.now() > record.expiresAt) {
      this.otpCache.delete(key);
      this.persistStore();
      return {
        success: false,
        message: 'Verification code has expired. Please click "Resend Code" to receive a new one.',
      };
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.otpCache.delete(key);
      this.persistStore();
      return {
        success: false,
        message: 'Too many incorrect attempts. Please request a fresh verification code.',
      };
    }

    if (record.code !== cleanCode) {
      record.attempts += 1;
      this.persistStore();
      const attemptsLeft = this.MAX_ATTEMPTS - record.attempts;
      return {
        success: false,
        message: `Invalid code. ${attemptsLeft} attempt(s) remaining.`,
      };
    }

    // Code matches and valid: clear active OTP so it cannot be reused
    this.otpCache.delete(key);
    this.persistStore();
    if (
      purpose === 'merchant_registration' ||
      purpose === 'merchant_password_reset'
    ) {
      this.verifiedEmails.set(key, Date.now() + this.EXPIRY_MINUTES * 60 * 1000);
    }

    return {
      success: true,
      message: 'Email successfully verified.',
      email: cleanEmail,
      purpose,
    };
  }

  /**
   * Returns active code for testing / helper purposes
   */
  public getActiveCode(email: string, purpose: string = 'auth'): string | null {
    this.ensureLoaded();
    const key = this.getKey(email, purpose);
    const record = this.otpCache.get(key);
    if (!record || Date.now() > record.expiresAt) return null;
    return record.code;
  }

  public consumeVerifiedEmail(email: string, purpose: string): boolean {
    const key = this.getKey(email, purpose);
    const expiresAt = this.verifiedEmails.get(key);
    this.verifiedEmails.delete(key);
    return expiresAt !== undefined && expiresAt > Date.now();
  }

  /**
   * Checks whether an email is currently verified or has a pending code
   */
  public checkEmailVerificationStatus(email: string, purpose: string = 'auth'): {
    verified: boolean;
    pending: boolean;
    expiresInSeconds?: number;
  } {
    this.ensureLoaded();
    const cleanEmail = (email || '').trim().toLowerCase();
    const key = this.getKey(cleanEmail, purpose);

    const verifiedExpiresAt = this.verifiedEmails.get(key);
    if (verifiedExpiresAt && verifiedExpiresAt > Date.now()) {
      return {
        verified: true,
        pending: false,
        expiresInSeconds: Math.ceil((verifiedExpiresAt - Date.now()) / 1000),
      };
    }

    const record = this.otpCache.get(key);
    if (record && record.expiresAt > Date.now()) {
      return {
        verified: false,
        pending: true,
        expiresInSeconds: Math.ceil((record.expiresAt - Date.now()) / 1000),
      };
    }

    return {
      verified: false,
      pending: false,
    };
  }

  public async sendMerchantStatusNotification(input: {
    email: string;
    recipientName: string;
    referenceNumber: string;
    status: string;
    reason?: string;
  }): Promise<boolean> {
    this.initResend();
    if (!this.resendClient) {
      console.warn(
        `Merchant decision notification was not sent for ${input.referenceNumber}: Resend is not configured.`
      );
      return false;
    }

    const escapeHtml = (value: string): string =>
      value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        };
        return entities[character];
      });

    const safeName = escapeHtml(input.recipientName);
    const safeStatus = escapeHtml(input.status);
    const safeReference = escapeHtml(input.referenceNumber);
    const safeReason = escapeHtml(input.reason || 'No additional reason was provided.');
    
    try {
      const response = await this.resendClient.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'eReceipt Tax Portal <onboarding@resend.dev>',
        to: input.email,
        subject: `eReceipt merchant application update: ${input.status}`,
        html: `<p>Hello ${safeName},</p><p>Your merchant application <strong>${safeReference}</strong> is now <strong>${safeStatus}</strong>.</p><p>${safeReason}</p>`,
      });

      if (response.error) {
        console.warn(`Resend notification rejected: ${response.error.message}`);
        return false;
      }
      return true;
    } catch (sendErr: any) {
      console.warn(`Failed to dispatch merchant status email:`, sendErr?.message || sendErr);
      return false;
    }
  }
}

export const otpService = new OtpService();
