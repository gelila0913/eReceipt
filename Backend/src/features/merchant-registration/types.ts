export type ApplicationStatus =
  | 'Pending'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Additional Information Required'
  | 'Suspended';

export interface MerchantRegistrationInput {
  // Step 1: Account details
  fullName: string;
  phoneNumber: string;
  email?: string;
  emailVerified?: boolean;
  password: string;

  // Step 2: Tax identity
  sellerLegalName: string;
  tradeName: string;
  tin: string;
  businessLicenseNumber: string;

  // Step 3: Licenses & attachments
  uploadedFileName?: string;
  uploadedFileSize?: string;
  isDocumentReady?: boolean;

  // Step 4: Business location
  city: string;
  subCity: string;
  buildingName: string;
  floor: string;
  gpsLocation?: string;

  // Step 5: Certification
  certified: boolean;
}

export interface StoredMerchantApplication {
  id: string;
  referenceNumber: string;
  submissionDate: string;
  status: ApplicationStatus;
  
  // Account
  fullName: string;
  phoneNumber: string;
  email?: string;
  emailVerified?: boolean;
  passwordHash: string;

  // Tax Identity
  sellerLegalName: string;
  tradeName: string;
  tin: string;
  businessLicenseNumber: string;

  // License Document
  documentPath?: string;
  uploadedFileName?: string;
  uploadedFileSize?: string;

  // Location
  city: string;
  subCity: string;
  buildingName: string;
  floor: string;
  gpsLocation?: string;

  // Legal
  certified: boolean;

  // Review & Audit
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  verificationHistory?: Array<{
    submittedAt: string;
    changedFields: string[];
    documentName?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type MerchantReverificationInput = Partial<
  Pick<
    MerchantRegistrationInput,
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
>;

export interface TinCheckResult {
  tin: string;
  validFormat: boolean;
  isAvailable: boolean;
  message: string;
}

export interface RegistrationSubmissionResult {
  success: boolean;
  referenceNumber: string;
  status: ApplicationStatus;
  submissionDate: string;
  sellerLegalName: string;
  tradeName: string;
  tin: string;
  message: string;
}

export interface RegistrationStatusResult {
  referenceNumber: string;
  sellerLegalName: string;
  tradeName: string;
  tin: string;
  status: ApplicationStatus;
  submissionDate: string;
  reviewNotes?: string;
  stage: number; // 1 = Submitted, 2 = Under Review, 3 = Approved / Decision
}
