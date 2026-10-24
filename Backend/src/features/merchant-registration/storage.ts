import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StoredMerchantApplication } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'merchant-applications.json');

const INITIAL_APPLICATIONS: StoredMerchantApplication[] = [];

class MerchantApplicationStorage {
  private cache: StoredMerchantApplication[] = [];
  private isLoaded = false;

  private ensureLoaded(): void {
    if (this.isLoaded) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.cache = JSON.parse(raw);
      } else {
        this.cache = [...INITIAL_APPLICATIONS];
        this.saveToFile();
      }
    } catch {
      this.cache = [...INITIAL_APPLICATIONS];
    }

    this.isLoaded = true;
  }

  private saveToFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist applications to disk:', err);
    }
  }

  public getAll(): StoredMerchantApplication[] {
    this.ensureLoaded();
    return [...this.cache];
  }

  public getByReference(referenceNumber: string): StoredMerchantApplication | undefined {
    this.ensureLoaded();
    const cleanRef = referenceNumber.trim().toUpperCase();
    return this.cache.find((item) => item.referenceNumber.toUpperCase() === cleanRef);
  }

  public getByTin(tin: string): StoredMerchantApplication | undefined {
    this.ensureLoaded();
    const cleanTin = tin.trim();
    return this.cache.find((item) => item.tin === cleanTin);
  }

  public getByEmail(email: string): StoredMerchantApplication | undefined {
    this.ensureLoaded();
    const cleanEmail = email.trim().toLowerCase();
    return this.cache.find(
      (item) => item.email?.trim().toLowerCase() === cleanEmail
    );
  }

  public updatePasswordHash(tin: string, passwordHash: string): void {
    this.ensureLoaded();
    const application = this.getByTin(tin);
    if (!application) return;

    application.passwordHash = passwordHash;
    application.updatedAt = new Date().toISOString();
    this.saveToFile();
  }

  public updateForReverification(
    tin: string,
    updates: Partial<
      Pick<
        StoredMerchantApplication,
        | 'fullName'
        | 'phoneNumber'
        | 'sellerLegalName'
        | 'tradeName'
        | 'businessLicenseNumber'
        | 'city'
        | 'subCity'
        | 'buildingName'
        | 'floor'
        | 'gpsLocation'
      >
    >,
    document?: Express.Multer.File
  ): StoredMerchantApplication | null {
    this.ensureLoaded();
    const application = this.getByTin(tin);
    if (!application) return null;

    const changedFields = Object.keys(updates).filter(
      (field) => updates[field as keyof typeof updates] !== undefined
    );
    Object.assign(application, updates);

    if (document) {
      application.documentPath = document.path;
      application.uploadedFileName = document.originalname;
      application.uploadedFileSize = `${(document.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    const submittedAt = new Date().toISOString();
    application.status = 'Under Review';
    application.reviewNotes = 'Updated merchant information submitted for re-verification.';
    application.verificationHistory = [
      ...(application.verificationHistory || []),
      {
        submittedAt,
        changedFields,
        documentName: document?.originalname,
      },
    ];
    application.updatedAt = submittedAt;

    this.saveToFile();
    return application;
  }

  public getByPhone(phoneNumber: string): StoredMerchantApplication | undefined {
    this.ensureLoaded();
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    return this.cache.find((item) => item.phoneNumber.replace(/\s+/g, '') === cleanPhone);
  }

  public create(app: StoredMerchantApplication): StoredMerchantApplication {
    this.ensureLoaded();
    this.cache.unshift(app);
    this.saveToFile();
    return app;
  }

  public updateStatus(
    referenceNumber: string,
    status: StoredMerchantApplication['status'],
    reviewedBy?: string,
    reviewNotes?: string
  ): StoredMerchantApplication | null {
    this.ensureLoaded();
    const app = this.getByReference(referenceNumber);
    if (!app) return null;

    app.status = status;
    if (reviewedBy) app.reviewedBy = reviewedBy;
    if (reviewNotes) app.reviewNotes = reviewNotes;
    app.reviewedAt = new Date().toISOString();
    app.updatedAt = new Date().toISOString();

    this.saveToFile();
    return app;
  }
}

export const applicationStorage = new MerchantApplicationStorage();
