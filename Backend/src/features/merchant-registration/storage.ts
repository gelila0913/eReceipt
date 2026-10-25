import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StoredMerchantApplication } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'merchant-applications.json');

const INITIAL_APPLICATIONS: StoredMerchantApplication[] = [
  {
    id: "app-1792846271951",
    referenceNumber: "APP-2026-65A2827E3DBA",
    submissionDate: "25 Oct 2026",
    status: "Pending",
    fullName: "Fanuel Goitom Kesete",
    phoneNumber: "+251939044079",
    email: "fanuelgoitom79@gmail.com",
    emailVerified: true,
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$9TmIlKqrtc06RL+Y/cwZXg$8ptMMNaM2e84XC8qWtYCnahAEVD5UkIxHjuju6iHcxY",
    sellerLegalName: "FANI",
    tradeName: "Fani Market",
    tin: "0987654321",
    businessLicenseNumber: "BL/AA/22345654",
    uploadedFileName: "0.0 Course Outline.pdf",
    uploadedFileSize: "0.6 MB",
    documentPath: "",
    city: "Addis Ababa",
    subCity: "Bole",
    buildingName: "Morning Star",
    floor: "2",
    gpsLocation: "8.992834, 38.805159",
    certified: true,
    createdAt: "2026-10-25T02:00:00.000Z",
    updatedAt: "2026-10-25T02:00:00.000Z"
  },
  {
    id: "app-1792846271950",
    referenceNumber: "APP-2026-7F4E1A18E2C2",
    submissionDate: "24 Oct 2026",
    status: "Approved",
    fullName: "Fanuel Goitom Kesete",
    phoneNumber: "+251939044079",
    email: "fanuelgoitom79@gmail.com",
    emailVerified: true,
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$9TmIlKqrtc06RL+Y/cwZXg$8ptMMNaM2e84XC8qWtYCnahAEVD5UkIxHjuju6iHcxY",
    sellerLegalName: "Fani PLC",
    tradeName: "Fani Market",
    tin: "0987654321",
    businessLicenseNumber: "BL/AA/22345654",
    uploadedFileName: "2. Introduction to wireless Nets.pdf",
    uploadedFileSize: "0.6 MB",
    documentPath: "",
    city: "Addis Ababa",
    subCity: "Bole",
    buildingName: "MM",
    floor: "2",
    gpsLocation: "9.030354, 38.762402",
    certified: true,
    createdAt: "2026-10-24T12:51:11.920Z",
    updatedAt: "2026-10-24T12:55:55.643Z",
    reviewedBy: "Fanuel Kassahun",
    reviewNotes: "Verification checks completed",
    reviewedAt: "2026-10-24T12:55:55.643Z"
  },
  {
    id: "app-1792747868774",
    referenceNumber: "APP-2026-1483",
    submissionDate: "23 Oct 2026",
    status: "Approved",
    fullName: "Fanuel",
    phoneNumber: "0987654432",
    passwordHash: "89752ac20a6bc75449cbb981e6403808c0654e42df8b4a0049c4fcc8f42636d4",
    sellerLegalName: "FANIPLC",
    tradeName: "FANI",
    tin: "3239494994",
    businessLicenseNumber: "BL/AA/12433444",
    uploadedFileName: "Mekelle University.pdf",
    uploadedFileSize: "0.1 MB",
    documentPath: "",
    city: "Addis Ababa",
    subCity: "4 kilo",
    buildingName: "Morning",
    floor: "3RD fLOOR",
    gpsLocation: "9.030336, 38.762414",
    certified: true,
    createdAt: "2026-10-23T09:31:08.774Z",
    updatedAt: "2026-10-23T09:32:18.482Z",
    reviewedBy: "Fanuel Goitom · 1123",
    reviewNotes: "Verification checks completed",
    reviewedAt: "2026-10-23T09:32:18.482Z"
  },
  {
    id: "app-1792747088299",
    referenceNumber: "APP-2026-8545",
    submissionDate: "23 Oct 2026",
    status: "Rejected",
    fullName: "Almaz Kebede",
    phoneNumber: "+251922334455",
    passwordHash: "a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea",
    sellerLegalName: "Almaz Retail PLC",
    tradeName: "Almaz Mart",
    tin: "0099887766",
    businessLicenseNumber: "BL-2026-1122",
    uploadedFileName: "Trade License.pdf",
    uploadedFileSize: "0.4 MB",
    city: "Addis Ababa",
    subCity: "Bole",
    buildingName: "Mega Mall",
    floor: "2nd",
    gpsLocation: "",
    certified: true,
    createdAt: "2026-10-23T09:18:08.299Z",
    updatedAt: "2026-10-23T09:29:36.188Z",
    reviewedBy: "Fanuel Goitom · 1123",
    reviewNotes: "f",
    reviewedAt: "2026-10-23T09:29:36.188Z"
  },
  {
    id: "app-1792696582798",
    referenceNumber: "APP-2026-8576",
    submissionDate: "22 Oct 2026",
    status: "Approved",
    fullName: "Kidus Yohannes",
    phoneNumber: "+251911998877",
    passwordHash: "008c70392e3abfbd0fa47bbc2ed96aa99bd49e159727fcba0f2e6abeb3a9d601",
    sellerLegalName: "Kidus Tech Solutions PLC",
    tradeName: "Kidus Tech",
    tin: "0088776655",
    businessLicenseNumber: "BL-2026-9901",
    uploadedFileName: "Commercial_Registration.pdf",
    uploadedFileSize: "0.5 MB",
    city: "Addis Ababa",
    subCity: "Bole",
    buildingName: "Morning Star Mall",
    floor: "4th Floor",
    gpsLocation: "",
    certified: true,
    createdAt: "2026-10-22T19:16:22.787Z",
    updatedAt: "2026-10-22T19:16:34.599Z",
    reviewedBy: "Fanuel Kassahun · RO-305",
    reviewNotes: "All documents valid and accredited",
    reviewedAt: "2026-10-22T19:16:34.599Z"
  }
];

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
        // Ensure any missing initial applications are present
        for (const initial of INITIAL_APPLICATIONS) {
          if (!this.cache.some((c) => c.referenceNumber === initial.referenceNumber || c.tin === initial.tin)) {
            this.cache.push(initial);
          }
        }
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
    return (
      this.cache.find((item) => item.referenceNumber.toUpperCase() === cleanRef) ||
      this.cache.find((item) => item.tin === cleanRef) ||
      this.cache.find((item) => item.id.toUpperCase() === cleanRef) ||
      this.cache.find((item) => item.referenceNumber.toUpperCase().includes(cleanRef) || cleanRef.includes(item.referenceNumber.toUpperCase()))
    );
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

  public updateProfileDetails(
    tin: string,
    updates: {
      phoneNumber?: string;
      email?: string;
      sellerLegalName?: string;
      tradeName?: string;
      buildingName?: string;
      city?: string;
      subCity?: string;
    }
  ): StoredMerchantApplication | null {
    this.ensureLoaded();
    const app = this.getByTin(tin);
    if (!app) return null;
    if (updates.phoneNumber !== undefined && updates.phoneNumber.trim().length > 0) {
      app.phoneNumber = updates.phoneNumber.trim();
    }
    if (updates.email !== undefined && updates.email.trim().length > 0) {
      app.email = updates.email.trim();
    }
    if (updates.sellerLegalName !== undefined && updates.sellerLegalName.trim().length > 0) {
      app.sellerLegalName = updates.sellerLegalName.trim();
    }
    if (updates.tradeName !== undefined && updates.tradeName.trim().length > 0) {
      app.tradeName = updates.tradeName.trim();
    }
    if (updates.buildingName !== undefined && updates.buildingName.trim().length > 0) {
      app.buildingName = updates.buildingName.trim();
    }
    if (updates.city !== undefined && updates.city.trim().length > 0) {
      app.city = updates.city.trim();
    }
    if (updates.subCity !== undefined && updates.subCity.trim().length > 0) {
      app.subCity = updates.subCity.trim();
    }
    app.updatedAt = new Date().toISOString();
    this.saveToFile();
    return app;
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
      if (document.path && fs.existsSync(document.path)) {
        try {
          application.documentBase64 = fs.readFileSync(document.path).toString('base64');
          application.documentMimeType = document.mimetype || 'application/pdf';
        } catch (err) {
          console.warn('Failed to encode reverification document to base64:', err);
        }
      }
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
