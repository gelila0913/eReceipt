import { NotFoundError, ConflictError } from "../../common/errors.js";
import {
  MerchantRegistrationInput,
  UpdateMerchantStatusInput,
} from "./merchants.schema.js";
import {
  MerchantApplication,
  MerchantProfile,
} from "./merchants.types.js";
// Use the real disk-persisted application storage shared with registration
import { applicationStorage } from "../../features/merchant-registration/storage.js";

export class MerchantsService {
  /**
   * Register a new merchant application (delegates to applicationStorage)
   */
  async register(input: MerchantRegistrationInput): Promise<MerchantApplication> {
    const existing = applicationStorage.getByTin(input.tin);
    if (existing && existing.status !== "Rejected") {
      throw new ConflictError(
        `A registration application with TIN ${input.tin} already exists (Ref: ${existing.referenceNumber}).`
      );
    }

    const all = applicationStorage.getAll();
    const nextIdNumber = all.length + 149;
    const ref = `APP-${new Date().getFullYear()}-0${nextIdNumber}`;
    const merchantId = `MER-10${nextIdNumber}`;

    const newApp = {
      id: `app-${Date.now()}`,
      referenceNumber: ref,
      merchantId,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      sellerLegalName: input.sellerLegalName,
      tradeName: input.tradeName,
      tin: input.tin,
      businessLicenseNumber: input.businessLicenseNumber,
      category: input.category || "General Merchant",
      uploadedFileName: input.uploadedFileName,
      uploadedFileSize: input.uploadedFileSize,
      isDocumentReady: input.isDocumentReady ?? false,
      city: input.city,
      subCity: input.subCity,
      buildingName: input.buildingName,
      floor: input.floor,
      gpsLocation: input.gpsLocation,
      certified: input.certified,
      status: "Pending" as const,
      submissionDate: new Date().toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    applicationStorage.create(newApp as any);

    return {
      id: newApp.id,
      ref: newApp.referenceNumber,
      merchantId: newApp.merchantId,
      fullName: newApp.fullName,
      phoneNumber: newApp.phoneNumber,
      sellerLegalName: newApp.sellerLegalName,
      tradeName: newApp.tradeName,
      tin: newApp.tin,
      businessLicenseNumber: newApp.businessLicenseNumber,
      category: newApp.category,
      uploadedFileName: newApp.uploadedFileName,
      uploadedFileSize: newApp.uploadedFileSize,
      isDocumentReady: newApp.isDocumentReady,
      city: newApp.city,
      subCity: newApp.subCity,
      buildingName: newApp.buildingName,
      floor: newApp.floor,
      gpsLocation: newApp.gpsLocation,
      certified: newApp.certified,
      status: newApp.status,
      createdAt: newApp.createdAt,
      updatedAt: newApp.updatedAt,
    };
  }

  /**
   * Get all merchant applications (with optional status & search filtering)
   */
  async getAllApplications(filters?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<MerchantApplication[]> {
    const all = applicationStorage.getAll();
    return all
      .filter((app) => {
        if (
          filters?.status &&
          filters.status !== "All Applications" &&
          filters.status !== "All statuses"
        ) {
          if (app.status !== filters.status) return false;
        }
        if (
          filters?.search
        ) {
          const q = filters.search.toLowerCase();
          const matches =
            app.sellerLegalName.toLowerCase().includes(q) ||
            app.tradeName.toLowerCase().includes(q) ||
            app.tin.includes(q) ||
            app.referenceNumber.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .map((app) => ({
        id: app.id,
        ref: app.referenceNumber,
        merchantId: (app as any).merchantId || `MER-${app.tin.slice(-5)}`,
        fullName: app.fullName,
        phoneNumber: app.phoneNumber,
        sellerLegalName: app.sellerLegalName,
        tradeName: app.tradeName,
        tin: app.tin,
        businessLicenseNumber: app.businessLicenseNumber,
        category: (app as any).category || "General Merchant",
        uploadedFileName: app.uploadedFileName,
        uploadedFileSize: app.uploadedFileSize,
        isDocumentReady: (app as any).isDocumentReady ?? false,
        city: app.city,
        subCity: app.subCity,
        buildingName: app.buildingName,
        floor: app.floor,
        gpsLocation: app.gpsLocation,
        certified: app.certified,
        status: app.status as any,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      }));
  }

  /**
   * Find application by ref, ID, merchantId, or TIN
   */
  async getByRefOrId(identifier: string): Promise<MerchantApplication> {
    const all = applicationStorage.getAll();
    const app = all.find(
      (a) =>
        a.referenceNumber === identifier ||
        a.id === identifier ||
        (a as any).merchantId === identifier ||
        a.tin === identifier
    );
    if (!app) {
      throw new NotFoundError(`Merchant application '${identifier}' not found.`);
    }
    return {
      id: app.id,
      ref: app.referenceNumber,
      merchantId: (app as any).merchantId || `MER-${app.tin.slice(-5)}`,
      fullName: app.fullName,
      phoneNumber: app.phoneNumber,
      sellerLegalName: app.sellerLegalName,
      tradeName: app.tradeName,
      tin: app.tin,
      businessLicenseNumber: app.businessLicenseNumber,
      category: (app as any).category || "General Merchant",
      uploadedFileName: app.uploadedFileName,
      uploadedFileSize: app.uploadedFileSize,
      isDocumentReady: (app as any).isDocumentReady ?? false,
      city: app.city,
      subCity: app.subCity,
      buildingName: app.buildingName,
      floor: app.floor,
      gpsLocation: app.gpsLocation,
      certified: app.certified,
      status: app.status as any,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  /**
   * Update application status (Officer decision)
   */
  async updateStatus(
    refOrId: string,
    update: UpdateMerchantStatusInput
  ): Promise<MerchantApplication> {
    // Find by multiple identifiers
    const all = applicationStorage.getAll();
    const app = all.find(
      (a) =>
        a.referenceNumber === refOrId ||
        a.id === refOrId ||
        (a as any).merchantId === refOrId ||
        a.tin === refOrId
    );
    if (!app) {
      throw new NotFoundError(`Merchant application '${refOrId}' not found.`);
    }

    const updated = applicationStorage.updateStatus(
      app.referenceNumber,
      update.status as any,
      undefined,
      update.reason
    );
    if (!updated) {
      throw new NotFoundError(`Could not update application '${refOrId}'.`);
    }

    return this.getByRefOrId(updated.referenceNumber);
  }

  /**
   * Get merchant profile for verified merchant
   */
  async getProfile(merchantIdOrTin: string): Promise<MerchantProfile> {
    const app = await this.getByRefOrId(merchantIdOrTin);
    return {
      id: app.id,
      merchantId: app.merchantId,
      tin: app.tin,
      sellerLegalName: app.sellerLegalName,
      tradeName: app.tradeName,
      phoneNumber: app.phoneNumber,
      category: app.category,
      city: app.city,
      subCity: app.subCity,
      status: app.status,
    };
  }
}

export const merchantsService = new MerchantsService();
