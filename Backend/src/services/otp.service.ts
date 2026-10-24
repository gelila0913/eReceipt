import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
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
  codeHash: string;
  simulatedCode?: string;
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
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      try {
        this.resendClient = new Resend(apiKey.trim());
        console.log('?? [Resend]: Initialized with API Key.');
      } catch (err) {
        console.warn('?? [Resend]: Failed to initialize client, using simulation mode:', err);
        this.resendClient = null;
      }
    } else {
      console.log('?? [Resend]: No RESEND_API_KEY provided in .env. Running in development simulation mode.');
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
        const parsed: Array<StoredOtp & { code?: string }> = JSON.parse(raw);
        const now = Date.now();
        for (const item of parsed) {
          if (item && item.expiresAt > now) {
            const codeHash = item.codeHash || (item.code ? this.hashCode(item.code) : '');
            if (!codeHash) continue;
            const { code: _legacyCode, ...storedItem } = item;
            this.otpCache.set(this.getKey(item.email, item.purpose), {
              ...storedItem,
              codeHash,
              simulatedCode: undefined,
            });
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
      const persistedList = activeList.map(({ simulatedCode: _simulatedCode, ...item }) => item);
      fs.writeFileSync(OTP_STORE_FILE, JSON.stringify(persistedList, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to persist OTP store:', err);
    }
  }

  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private hashCode(code: string): string {
    return createHmac('sha256', config.jwtSecret).update(code).digest('hex');
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

    this.initResend();
    if (!this.resendClient && config.nodeEnv === 'production') {
      throw new Error('Email OTP delivery is not configured.');
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
        simulated: !this.resendClient,
        code: !this.resendClient ? existing.simulatedCode : undefined,
        cooldownSeconds: waitRemaining,
      };
    }

    this.verifiedEmails.delete(key);
    const code = this.generateCode();
    const expiresAt = now + this.EXPIRY_MINUTES * 60 * 1000;

    const entry: StoredOtp = {
      email: cleanEmail,
      codeHash: this.hashCode(code),
      simulatedCode: this.resendClient ? undefined : code,
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
    let deliverySimulated = true;
    if (this.resendClient) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'eReceipt Tax Portal <onboarding@resend.dev>';
        const subject =
          purpose.includes('admin')
            ? `[Ministry of Revenues] Your Officer Security Verification Code: ${code}`
            : `[eReceipt] Your Merchant Verification Code: ${code}`;

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px; background-color: #FFFFFF;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
              <span style="font-size: 24px; font-weight: 800; color: #176B4D; letter-spacing: -0.5px;">eReceipt</span>
              <span style="font-size: 12px; color: #64748B; padding-left: 6px; border-left: 1px solid #CBD5E1;">Digital Receipts. A Stronger Ethiopia.</span>
            </div>
            
            <h2 style="font-size: 20px; color: #1E293B; margin-top: 0;">Verification Code</h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.5;">
              Hello ${recipientName || 'there'},<br />
              Use the 6-digit one-time password (OTP) below to authenticate your <strong>${purpose.replace('_', ' ').toUpperCase()}</strong> request.
            </p>

            <div style="margin: 28px 0; text-align: center; background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 20px;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #176B4D; font-family: monospace;">${code}</span>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748B;">This code will expire in ${this.EXPIRY_MINUTES} minutes.</p>
            </div>

            <p style="font-size: 13px; color: #64748B; line-height: 1.5;">
              If you did not request this verification code, please ignore this email or notify your system administrator immediately.
            </p>

            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
            <p style="font-size: 11px; color: #94A3B8; text-align: center; margin: 0;">
              Federal Democratic Republic of Ethiopia · Ministry of Revenues Electronic Invoice Management System (MoR EIMS)
            </p>
          </div>
        `;

        const response = await this.resendClient.emails.send({
          from: fromEmail,
          to: cleanEmail,
          subject,
          html,
        });

        if (response.error) {
          this.otpCache.delete(key);
          this.persistStore();
          throw new Error(`Resend rejected the OTP email: ${response.error.message}`);
        } else {
          console.log(`? [Resend Email Sent]: Message ID ${response.data?.id} to ${cleanEmail}`);
          deliverySimulated = false;
        }
      } catch (sendError) {
        this.otpCache.delete(key);
        this.persistStore();
        throw new Error('OTP email delivery failed.', { cause: sendError });
      }
    }

    if (deliverySimulated) {
      console.log(`=======================================================`);
      console.log(`?? [Resend OTP Code Simulated for Local Testing]`);
      console.log(`?? Recipient : ${cleanEmail}`);
      console.log(`?? Purpose   : ${purpose}`);
      console.log(`?? CODE      : ${code}`);
      console.log(`?? Expires   : in ${this.EXPIRY_MINUTES} minutes`);
      console.log(`=======================================================`);
    }

    return {
      success: true,
      message: deliverySimulated
        ? `Verification code generated for ${cleanEmail}.`
        : `Verification code sent to ${cleanEmail} via Resend.`,
      email: cleanEmail,
      simulated: deliverySimulated,
      code: deliverySimulated ? code : undefined,
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

    const actualHash = Buffer.from(this.hashCode(cleanCode), 'hex');
    const expectedHash = Buffer.from(record.codeHash, 'hex');
    if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) {
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
    return record.simulatedCode ?? null;
  }

  public consumeVerifiedEmail(email: string, purpose: string): boolean {
    const key = this.getKey(email, purpose);
    const expiresAt = this.verifiedEmails.get(key);
    this.verifiedEmails.delete(key);
    return expiresAt !== undefined && expiresAt > Date.now();
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
      if (config.nodeEnv === 'production') {
        throw new Error('Merchant decision email delivery is not configured.');
      }
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
    const response = await this.resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'eReceipt Tax Portal <onboarding@resend.dev>',
      to: input.email,
      subject: `eReceipt merchant application update: ${input.status}`,
      html: `<p>Hello ${safeName},</p><p>Your merchant application <strong>${safeReference}</strong> is now <strong>${safeStatus}</strong>.</p><p>${safeReason}</p>`,
    });

    if (response.error) {
      throw new Error(`Resend rejected the application notification: ${response.error.message}`);
    }
    return true;
  }
}

export const otpService = new OtpService();
