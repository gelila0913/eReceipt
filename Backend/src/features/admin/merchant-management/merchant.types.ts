export type DecisionKind = 'approve' | 'request' | 'reject';

export interface DecisionPayload {
  kind: DecisionKind;
  reason: string;
  officerName?: string;
}

export type ApplicationReviewStatus =
  | 'Pending'
  | 'Under Review'
  | 'Approved'
  | 'Additional Information Required'
  | 'Rejected'
  | 'Suspended';

export interface MerchantApplicationItem {
  ref: string;
  registrationId?: string;
  name: string;
  tin: string;
  merchantId: string;
  category: string;
  date: string;
  status: ApplicationReviewStatus;
  address: string;
  
  // Extended verification fields
  fullName?: string;
  phoneNumber?: string;
  tradeName?: string;
  businessLicenseNumber?: string;
  city?: string;
  subCity?: string;
  buildingName?: string;
  floor?: string;
  gpsLocation?: string;
  uploadedFileName?: string;
  uploadedFileSize?: string;
  documentUrl?: string;
  decisionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DirectoryMerchantItem {
  id: string;
  name: string;
  tin: string;
  category: string;
  classification: 'VAT' | 'TOT';
  status: 'Active' | 'Suspended';
  authorization: 'Authorized' | 'Suspended';
  registeredDate: string;
  address: string;
  contactEmail?: string;
  contactPhone?: string;
  vatRegistrationNumber?: string;
  monthlySalesAvg?: number;
}

export interface ApplicationQuery {
  status?: string;
  search?: string;
}

export interface DirectoryQuery {
  search?: string;
  category?: string;
  classification?: string;
  status?: string;
}
