import { applicationStorage } from './storage.js';
import { hashPassword } from './password.js';
import { otpService } from '../../services/otp.service.js';
import { randomBytes } from 'node:crypto';
import type {
  MerchantRegistrationInput,
  StoredMerchantApplication,
  MerchantReverificationInput,
  TinCheckResult,
  RegistrationSubmissionResult,
  RegistrationStatusResult,
} from './types.js';

function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  let referenceNumber: string;
  do {
    referenceNumber = `APP-${year}-${randomBytes(6).toString('hex').toUpperCase()}`;
  } while (applicationStorage.getByReference(referenceNumber));
  return referenceNumber;
}

export class MerchantRegistrationService {
  /**
   * Validates Ethiopian 10-digit Taxpayer Identification Number format and checks uniqueness
   */
  public checkTin(tinRaw: string): TinCheckResult {
    const tin = (tinRaw || '').trim();

    // Ethiopian TIN is strictly 10 digits
    const isValidFormat = /^\d{10}$/.test(tin);

    if (!isValidFormat) {
      return {
        tin,
        validFormat: false,
        isAvailable: false,
        message: 'Invalid TIN format. Ethiopian TIN must be exactly 10 numeric digits.',
      };
    }

    const existing = applicationStorage.getByTin(tin);
    if (existing) {
      return {
        tin,
        validFormat: true,
        isAvailable: false,
        message: 'This TIN is already associated with a merchant application.',
      };
    }

    return {
      tin,
      validFormat: true,
      isAvailable: true,
      message: 'TIN is valid and eligible for new registration.',
    };
  }

  /**
   * Submits the complete 5-step merchant registration application
   */
  public async submitRegistration(
    input: MerchantRegistrationInput,
    uploadedFile?: Express.Multer.File
  ): Promise<RegistrationSubmissionResult> {
    // 1. Mandatory field validations
    if (!input.fullName?.trim() || !input.phoneNumber?.trim() || !input.password?.trim()) {
      throw new Error('Step 1 missing: Full name, phone number, and password are required.');
    }

    const email = input.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('A valid email address is required.');
    }
    if (applicationStorage.getByEmail(email)) {
      throw new Error('This email address is already associated with a merchant account.');
    }

    if (
      !input.sellerLegalName?.trim() ||
      !input.tradeName?.trim() ||
      !input.tin?.trim() ||
      !input.businessLicenseNumber?.trim()
    ) {
      throw new Error('Step 2 missing: Legal name, trade name, 10-digit TIN, and license number are required.');
    }

    const tinCheck = this.checkTin(input.tin);
    if (!tinCheck.validFormat) {
      throw new Error(tinCheck.message);
    }
    if (!tinCheck.isAvailable) {
      throw new Error(tinCheck.message);
    }

    if (!input.city?.trim() || !input.subCity?.trim() || !input.buildingName?.trim()) {
      throw new Error('Step 4 missing: City, sub-city, and building address are required.');
    }

    if (!input.certified) {
      throw new Error('Step 5 missing: You must certify the accuracy of your business tax registration details.');
    }

    if (!otpService.consumeVerifiedEmail(email, 'merchant_registration')) {
      throw new Error('Verify your email address before submitting your registration.');
    }

    // 2. Prepare record
    const ref = generateReferenceNumber();
    const now = new Date();
    const submissionFormatted = now.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const newApplication: StoredMerchantApplication = {
      id: `app-${Date.now()}`,
      referenceNumber: ref,
      submissionDate: submissionFormatted,
      status: 'Pending',
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      email,
      emailVerified: true,
      passwordHash: await hashPassword(input.password),
      sellerLegalName: input.sellerLegalName.trim(),
      tradeName: input.tradeName.trim(),
      tin: input.tin.trim(),
      businessLicenseNumber: input.businessLicenseNumber.trim(),
      uploadedFileName: uploadedFile ? uploadedFile.originalname : input.uploadedFileName,
      uploadedFileSize: uploadedFile
        ? `${(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB`
        : input.uploadedFileSize,
      documentPath: uploadedFile ? uploadedFile.path : undefined,
      city: input.city.trim(),
      subCity: input.subCity.trim(),
      buildingName: input.buildingName.trim(),
      floor: (input.floor || '').trim(),
      gpsLocation: (input.gpsLocation || '').trim(),
      certified: input.certified,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    applicationStorage.create(newApplication);

    return {
      success: true,
      referenceNumber: ref,
      status: 'Pending',
      submissionDate: submissionFormatted,
      sellerLegalName: newApplication.sellerLegalName,
      tradeName: newApplication.tradeName,
      tin: newApplication.tin,
      message: 'Merchant registration application submitted successfully. Pending Revenue Officer compliance review.',
    };
  }

  public submitReverification(
    tin: string,
    input: MerchantReverificationInput,
    uploadedFile?: Express.Multer.File
  ): { referenceNumber: string; status: 'Under Review'; submittedAt: string } {
    const updates = Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value,
      ])
    ) as MerchantReverificationInput;
    if (!Object.values(updates).some((value) => value !== undefined) && !uploadedFile) {
      throw new Error('Provide updated merchant information or a replacement document.');
    }

    const application = applicationStorage.getByTin(tin);
    if (!application) {
      throw new Error('Merchant registration was not found.');
    }
    if (!['Approved', 'Suspended', 'Additional Information Required'].includes(application.status)) {
      throw new Error('This merchant application is not eligible for re-verification.');
    }

    const updated = applicationStorage.updateForReverification(tin, updates, uploadedFile);
    if (!updated) {
      throw new Error('Merchant registration could not be updated.');
    }

    return {
      referenceNumber: updated.referenceNumber,
      status: 'Under Review',
      submittedAt: updated.updatedAt,
    };
  }

  /**
   * Retrieves live status of a submitted application for WorkflowPipelineStepper
   */
  public getStatus(referenceNumberRaw: string): RegistrationStatusResult {
    const ref = (referenceNumberRaw || '').trim();
    const app = applicationStorage.getByReference(ref);

    if (!app) {
      throw new Error(`Registration application with reference '${ref}' was not found.`);
    }

    let stage = 1; // 1 = Submitted
    if (app.status === 'Under Review' || app.status === 'Additional Information Required') {
      stage = 2;
    } else if (
      app.status === 'Approved' ||
      app.status === 'Rejected' ||
      app.status === 'Suspended'
    ) {
      stage = 3;
    }

    return {
      referenceNumber: app.referenceNumber,
      sellerLegalName: app.sellerLegalName,
      tradeName: app.tradeName,
      tin: app.tin,
      status: app.status,
      submissionDate: app.submissionDate,
      reviewNotes: app.reviewNotes,
      stage,
    };
  }

  /**
   * Retrieves all submitted applications (for admin review list)
   */
  public getAllApplications(): StoredMerchantApplication[] {
    return applicationStorage.getAll();
  }
}

export const registrationService = new MerchantRegistrationService();
