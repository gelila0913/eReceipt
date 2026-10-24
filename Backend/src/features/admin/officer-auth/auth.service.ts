import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { otpService } from '../../../services/otp.service.js';
import type {
  OfficerUser,
  OfficerLoginRequest,
  OfficerAuthResponse,
  OfficerLoginResponse,
  OfficerVerify2FARequest,
  OfficerRegisterRequest,
} from './auth.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../data');
const OFFICERS_FILE = path.join(DATA_DIR, 'admin-officers.json');
const AUDIT_FILE = path.join(DATA_DIR, 'admin-audit-log.json');

const SESSIONS_FILE = path.join(DATA_DIR, 'admin-sessions.json');

type StoredOfficer = OfficerUser & { passwordHash: string };

const INITIAL_OFFICERS: StoredOfficer[] = [
  {
    id: 'off-demo-101',
    username: 'officer.demo',
    passwordHash: 'Revenue123',
    name: 'Abebe Bikila',
    badgeNumber: 'RO-101',
    role: 'REVENUE_OFFICER',
    email: 'officer.demo@mor.gov.et',
    branch: 'Addis Ababa Large Taxpayers Branch',
    createdAt: '2026-10-22T00:00:00.000Z',
  },
  {
    id: 'off-1792695191459',
    username: 'officer.fani',
    passwordHash: 'Password123',
    name: 'Fanuel Kassahun',
    badgeNumber: 'RO-305',
    role: 'REVENUE_OFFICER',
    email: 'fanuelgoitom79@gmail.com',
    branch: 'Addis Ababa Large Taxpayers Branch',
    createdAt: '2026-10-22T18:53:11.459Z',
  },
  {
    id: 'off-admin-001',
    username: 'admin',
    passwordHash: 'Admin123',
    name: 'Revenue System Administrator',
    badgeNumber: 'ADM-001',
    role: 'ADMIN',
    email: 'admin@mor.gov.et',
    branch: 'Ministry of Revenues Head Office',
    createdAt: '2026-10-22T00:00:00.000Z',
  },
];

// Active sessions map: token -> OfficerUser & expiresAt
interface Session {
  officer: OfficerUser;
  expiresAt: number;
}

const activeSessions = new Map<string, Session>();

// Pending 2FA challenges map: tempToken -> OfficerUser & email
interface Pending2FASession {
  officer: OfficerUser;
  email: string;
  rememberMe: boolean;
  expiresAt: number;
}
const pending2FASessions = new Map<string, Pending2FASession>();

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName =
    name.length > 2
      ? `${name[0]}${'•'.repeat(Math.min(name.length - 2, 6))}${name[name.length - 1]}`
      : `${name[0]}•`;
  return `${maskedName}@${domain}`;
}

export class OfficerAuthService {
  private officersCache: StoredOfficer[] = [];
  private isLoaded = false;

  private ensureLoaded(): void {
    if (this.isLoaded) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(OFFICERS_FILE)) {
        const raw = fs.readFileSync(OFFICERS_FILE, 'utf-8');
        this.officersCache = JSON.parse(raw);
      } else {
        this.officersCache = [...INITIAL_OFFICERS];
        this.saveToFile();
      }

      if (fs.existsSync(SESSIONS_FILE)) {
        try {
          const sessionsRaw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
          const parsed = JSON.parse(sessionsRaw);
          if (Array.isArray(parsed)) {
            for (const [tok, sess] of parsed) {
              if (sess && sess.expiresAt > Date.now()) {
                activeSessions.set(tok, sess);
              }
            }
          }
        } catch {}
      }
    } catch {
      this.officersCache = [...INITIAL_OFFICERS];
    }

    this.isLoaded = true;
  }

  private saveSessionsToFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const sessionEntries = Array.from(activeSessions.entries());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionEntries, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to persist admin sessions:', err);
    }
  }

  private saveToFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(OFFICERS_FILE, JSON.stringify(this.officersCache, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist officers to disk:', err);
    }
  }

  /**
   * Record audit log entry for officer actions
   */
  private logAudit(entry: {
    officer: string;
    action: string;
    reference: string;
    statusTransition: string;
    notes: string;
  }): void {
    try {
      const timestamp = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const fullEvent = {
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp,
        ...entry,
      };

      let events: any[] = [];
      if (fs.existsSync(AUDIT_FILE)) {
        try {
          events = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
        } catch {
          events = [];
        }
      }

      events.unshift(fullEvent);
      fs.writeFileSync(AUDIT_FILE, JSON.stringify(events, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to record audit event in officer-auth:', err);
    }
  }

  /**
   * Authenticate officer with username and password and challenge with 2FA OTP
   */
  async login(credentials: OfficerLoginRequest): Promise<OfficerLoginResponse> {
    this.ensureLoaded();
    const trimmedUsername = credentials.username.trim().toLowerCase();
    const officerMatch = this.officersCache.find(
      (o) => o.username.toLowerCase() === trimmedUsername
    );

    if (!officerMatch) {
      throw new Error('Invalid officer username or password.');
    }

    if (credentials.password !== officerMatch.passwordHash) {
      throw new Error('Invalid officer username or password.');
    }

    const { passwordHash: _, ...officer } = officerMatch;

    // Challenge with 2FA: generate temp token and dispatch OTP via Resend
    const tempToken = `ro_pre_${crypto.randomBytes(24).toString('hex')}`;
    pending2FASessions.set(tempToken, {
      officer,
      email: officer.email,
      rememberMe: Boolean(credentials.rememberMe),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const otpResult = await otpService.sendOtp(officer.email, 'admin_login', officer.name);

    return {
      requires2FA: true,
      tempToken,
      email: officer.email,
      maskedEmail: maskEmail(officer.email),
      code: otpResult.simulated || process.env.NODE_ENV !== 'production' ? otpResult.code : undefined,
      simulatedCode: otpResult.simulated || process.env.NODE_ENV !== 'production' ? otpResult.code : undefined,
    };
  }

  /**
   * Verify 2FA OTP code and issue officer access token
   */
  async verify2FA(payload: OfficerVerify2FARequest): Promise<OfficerAuthResponse> {
    const { tempToken, code } = payload;
    const pending = pending2FASessions.get(tempToken);

    if (!pending || pending.expiresAt < Date.now()) {
      if (pending) pending2FASessions.delete(tempToken);
      throw new Error('Authentication session has expired. Please sign in with your credentials again.');
    }

    const verification = otpService.verifyOtp(pending.email, code, 'admin_login');
    if (!verification.success) {
      throw new Error(verification.message);
    }

    // Generate secure random token
    const token = `ro_tok_${crypto.randomBytes(32).toString('hex')}`;
    const durationMs = pending.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + durationMs;

    activeSessions.set(token, { officer: pending.officer, expiresAt });
    this.saveSessionsToFile();
    pending2FASessions.delete(tempToken);

    this.logAudit({
      officer: `${pending.officer.name} · ${pending.officer.badgeNumber}`,
      action: 'Officer 2FA Verified & Signed In',
      reference: pending.officer.badgeNumber,
      statusTransition: '2FA Challenge → Authenticated',
      notes: `Successful 2FA verification via Resend OTP for ${pending.email}`,
    });

    return {
      token,
      expiresIn: pending.rememberMe ? '7d' : '24h',
      officer: pending.officer,
    };
  }

  /**
   * Resend 2FA OTP code to officer email
   */
  async resend2FA(tempToken: string) {
    const pending = pending2FASessions.get(tempToken);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new Error('Authentication session has expired. Please sign in again.');
    }

    return await otpService.sendOtp(pending.email, 'admin_login', pending.officer.name);
  }

  /**
   * Register a new revenue officer / admin
   */
  async register(payload: OfficerRegisterRequest): Promise<OfficerAuthResponse> {
    this.ensureLoaded();

    if (!payload.fullName?.trim()) {
      throw new Error('Full name is required.');
    }
    if (!payload.username?.trim()) {
      throw new Error('Officer username is required.');
    }
    if (!payload.badgeNumber?.trim()) {
      throw new Error('Officer badge or employee ID is required.');
    }
    if (!payload.email?.trim()) {
      throw new Error('Official email is required.');
    }
    if (!payload.password || payload.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const cleanUsername = payload.username.trim().toLowerCase();
    const cleanBadge = payload.badgeNumber.trim().toUpperCase();
    const cleanEmail = payload.email.trim().toLowerCase();

    const existingUsername = this.officersCache.find(
      (o) => o.username.toLowerCase() === cleanUsername
    );
    if (existingUsername) {
      throw new Error(`Officer username "${payload.username.trim()}" is already taken.`);
    }

    const existingBadge = this.officersCache.find(
      (o) => o.badgeNumber.toUpperCase() === cleanBadge
    );
    if (existingBadge) {
      throw new Error(`Officer badge / employee ID "${payload.badgeNumber.trim()}" is already registered.`);
    }

    const existingEmail = this.officersCache.find(
      (o) => o.email.toLowerCase() === cleanEmail
    );
    if (existingEmail) {
      throw new Error(`Official email "${payload.email.trim()}" is already associated with another officer.`);
    }

    const newOfficer: StoredOfficer = {
      id: `off-${Date.now()}`,
      username: payload.username.trim(),
      passwordHash: payload.password,
      name: payload.fullName.trim(),
      badgeNumber: payload.badgeNumber.trim().toUpperCase(),
      role: payload.role || 'REVENUE_OFFICER',
      email: payload.email.trim().toLowerCase(),
      branch: payload.branch?.trim() || 'Addis Ababa Large Taxpayers Branch',
      createdAt: new Date().toISOString(),
    };

    this.officersCache.push(newOfficer);
    this.saveToFile();

    // Log administrative onboarding event
    this.logAudit({
      officer: `${newOfficer.name} · ${newOfficer.badgeNumber}`,
      action: 'Officer credential registered',
      reference: newOfficer.badgeNumber,
      statusTransition: 'Unregistered → Active Officer',
      notes: `New officer onboarded: ${newOfficer.name} (${newOfficer.role}) at ${newOfficer.branch}`,
    });

    // Auto-login newly registered officer
    const token = `ro_tok_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const { passwordHash: _, ...officer } = newOfficer;
    activeSessions.set(token, { officer, expiresAt });
    this.saveSessionsToFile();

    return {
      token,
      expiresIn: '24h',
      officer,
    };
  }

  /**
   * Validate session token and return officer details
   */
  async getOfficerFromToken(token: string): Promise<OfficerUser | null> {
    if (!token) return null;
    this.ensureLoaded();

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const session = activeSessions.get(cleanToken);

    if (!session) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      activeSessions.delete(cleanToken);
      this.saveSessionsToFile();
      return null;
    }

    return session.officer;
  }

  /**
   * Check availability of username, badge number, or email
   */
  checkAvailability(query: { username?: string; badgeNumber?: string; email?: string }): {
    usernameAvailable?: boolean;
    badgeAvailable?: boolean;
    emailAvailable?: boolean;
  } {
    this.ensureLoaded();
    const result: { usernameAvailable?: boolean; badgeAvailable?: boolean; emailAvailable?: boolean } = {};

    if (query.username) {
      const cleanUser = query.username.trim().toLowerCase();
      result.usernameAvailable = !this.officersCache.some((o) => o.username.toLowerCase() === cleanUser);
    }
    if (query.badgeNumber) {
      const cleanBadge = query.badgeNumber.trim().toUpperCase();
      result.badgeAvailable = !this.officersCache.some((o) => o.badgeNumber.toUpperCase() === cleanBadge);
    }
    if (query.email) {
      const cleanMail = query.email.trim().toLowerCase();
      result.emailAvailable = !this.officersCache.some((o) => o.email.toLowerCase() === cleanMail);
    }

    return result;
  }

  /**
   * Logout by invalidating session token
   */
  async logout(token: string): Promise<boolean> {
    if (!token) return false;
    this.ensureLoaded();

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const result = activeSessions.delete(cleanToken);
    this.saveSessionsToFile();
    return result;
  }

  /**
   * List all registered revenue officers
   */
  getAllOfficers(): OfficerUser[] {
    this.ensureLoaded();
    return this.officersCache.map(({ passwordHash: _, ...officer }) => officer);
  }

  /**
   * Deactivate/remove an officer
   */
  deactivateOfficer(id: string): boolean {
    this.ensureLoaded();
    const idx = this.officersCache.findIndex(
      (o) => o.id === id || o.username.toLowerCase() === id.toLowerCase()
    );
    if (idx === -1) return false;
    this.officersCache.splice(idx, 1);
    this.saveToFile();
    return true;
  }
}

export const officerAuthService = new OfficerAuthService();
