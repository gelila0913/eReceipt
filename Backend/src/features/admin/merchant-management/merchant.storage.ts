import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationStorage } from '../../merchant-registration/storage.js';
import type { StoredMerchantApplication } from '../../merchant-registration/types.js';
import type {
  MerchantApplicationItem,
  DirectoryMerchantItem,
  ApplicationQuery,
  DirectoryQuery,
  ApplicationReviewStatus,
} from './merchant.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../data');
const MERCHANTS_FILE = path.join(DATA_DIR, 'admin-merchants.json');

// Helper to deduce realistic business category if not explicitly tagged
function deduceCategory(name: string, tradeName: string): string {
  const combined = `${name} ${tradeName}`.toLowerCase();
  if (combined.includes('pharmacy') || combined.includes('medical') || combined.includes('health') || combined.includes('clinic')) {
    return 'Pharmacy';
  }
  if (combined.includes('cafe') || combined.includes('restaurant') || combined.includes('bakery') || combined.includes('hotel') || combined.includes('bar')) {
    return 'Hospitality';
  }
  if (combined.includes('auto') || combined.includes('parts') || combined.includes('garage') || combined.includes('motor')) {
    return 'Automotive';
  }
  if (combined.includes('stationery') || combined.includes('printing') || combined.includes('wholesale') || combined.includes('import')) {
    return 'Wholesale';
  }
  if (combined.includes('textile') || combined.includes('garment') || combined.includes('mills') || combined.includes('factory')) {
    return 'Manufacturing';
  }
  if (combined.includes('electronics') || combined.includes('tech') || combined.includes('computer')) {
    return 'Electronics';
  }
  return 'Retail';
}

export class MerchantManagementStorage {
  private directoryCache: DirectoryMerchantItem[] = [];
  private isDirectoryLoaded = false;

  private ensureDirectoryLoaded(): void {
    if (this.isDirectoryLoaded) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(MERCHANTS_FILE)) {
        const raw = fs.readFileSync(MERCHANTS_FILE, 'utf-8');
        this.directoryCache = JSON.parse(raw);
      } else {
        this.directoryCache = [];
      }
    } catch {
      this.directoryCache = [];
    }

    this.isDirectoryLoaded = true;
  }

  private saveDirectory(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(MERCHANTS_FILE, JSON.stringify(this.directoryCache, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save directory merchants:', err);
    }
  }

  /**
   * Convert stored registration to Admin application format
   */
  private mapToApplicationItem(app: StoredMerchantApplication): MerchantApplicationItem {
    const category = deduceCategory(app.sellerLegalName, app.tradeName);
    const merchantId = `MER-${app.tin.slice(-5) || app.referenceNumber.slice(-5)}`;
    const address = [app.city, app.subCity, app.buildingName, app.floor].filter(Boolean).join(', ');

    return {
      ref: app.referenceNumber,
      registrationId: app.id,
      name: app.sellerLegalName || app.tradeName || app.fullName,
      tin: app.tin,
      merchantId,
      category,
      date: app.submissionDate,
      status: app.status as ApplicationReviewStatus,
      address,
      fullName: app.fullName,
      phoneNumber: app.phoneNumber,
      tradeName: app.tradeName,
      businessLicenseNumber: app.businessLicenseNumber,
      city: app.city,
      subCity: app.subCity,
      buildingName: app.buildingName,
      floor: app.floor,
      gpsLocation: app.gpsLocation,
      uploadedFileName: app.uploadedFileName,
      uploadedFileSize: app.uploadedFileSize,
      decisionReason: app.reviewNotes,
      reviewedBy: app.reviewedBy,
      reviewedAt: app.reviewedAt,
    };
  }

  /**
   * List all applications from registrations storage with optional filters
   */
  getApplications(query?: ApplicationQuery): MerchantApplicationItem[] {
    const rawApps: StoredMerchantApplication[] = applicationStorage.getAll();
    let items = rawApps.map((a: StoredMerchantApplication) => this.mapToApplicationItem(a));

    if (query?.status) {
      const targetStatus = query.status.toLowerCase();
      items = items.filter((item: MerchantApplicationItem) => item.status.toLowerCase() === targetStatus);
    }

    if (query?.search) {
      const q = query.search.toLowerCase().trim();
      items = items.filter(
        (item: MerchantApplicationItem) =>
          item.ref.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.tin.includes(q) ||
          item.merchantId.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    return items;
  }

  /**
   * Find application by reference number
   */
  getApplicationByRef(ref: string): MerchantApplicationItem | null {
    const app = applicationStorage.getByReference(ref);
    if (!app) return null;
    return this.mapToApplicationItem(app);
  }

  /**
   * Update application status with officer review notes
   */
  updateApplicationStatus(
    ref: string,
    nextStatus: ApplicationReviewStatus,
    officerName: string,
    reason: string
  ): MerchantApplicationItem | null {
    const updated = applicationStorage.updateStatus(ref, nextStatus, officerName, reason);
    if (!updated) return null;
    return this.mapToApplicationItem(updated);
  }

  /**
   * Query directory merchants
   */
  getDirectory(query?: DirectoryQuery): DirectoryMerchantItem[] {
    this.ensureDirectoryLoaded();
    let list = [...this.directoryCache];

    if (query?.search) {
      const q = query.search.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.tin.includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.address.toLowerCase().includes(q)
      );
    }

    if (query?.category) {
      const cat = query.category.toLowerCase().trim();
      list = list.filter((m) => m.category.toLowerCase() === cat);
    }

    if (query?.classification) {
      const cls = query.classification.toUpperCase().trim();
      list = list.filter((m) => m.classification === cls);
    }

    if (query?.status) {
      const st = query.status.toLowerCase().trim();
      list = list.filter((m) => m.status.toLowerCase() === st);
    }

    return list;
  }

  /**
   * Get directory merchant by ID or TIN
   */
  getDirectoryMerchantById(id: string): DirectoryMerchantItem | null {
    this.ensureDirectoryLoaded();
    const cleanId = id.trim().toLowerCase();
    return (
      this.directoryCache.find(
        (m) => m.id.toLowerCase() === cleanId || m.tin === id.trim()
      ) || null
    );
  }

  /**
   * Add newly approved merchant to Directory
   */
  addDirectoryMerchant(merchant: DirectoryMerchantItem): DirectoryMerchantItem {
    this.ensureDirectoryLoaded();
    // Check if already in directory
    const existingIndex = this.directoryCache.findIndex(
      (m) => m.tin === merchant.tin || m.id === merchant.id
    );

    if (existingIndex >= 0) {
      this.directoryCache[existingIndex] = { ...this.directoryCache[existingIndex], ...merchant };
    } else {
      this.directoryCache.unshift(merchant);
    }

    this.saveDirectory();
    return merchant;
  }

  /**
   * Toggle merchant status between Active and Suspended
   */
  updateDirectoryStatus(id: string, nextStatus: 'Active' | 'Suspended'): DirectoryMerchantItem | null {
    this.ensureDirectoryLoaded();
    const cleanId = id.trim().toLowerCase();
    const merchant = this.directoryCache.find(
      (m) => m.id.toLowerCase() === cleanId || m.tin === id.trim()
    );

    if (!merchant) return null;

    merchant.status = nextStatus;
    merchant.authorization = nextStatus === 'Active' ? 'Authorized' : 'Suspended';
    this.saveDirectory();
    return merchant;
  }
}

export const merchantManagementStorage = new MerchantManagementStorage();
