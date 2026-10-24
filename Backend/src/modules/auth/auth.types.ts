export interface MerchantAuthResponse {
  token: string;
  user: {
    id: string;
    role: "merchant";
    tin: string;
    businessName: string;
    tradeName?: string;
    status:
      | "Pending"
      | "Under Review"
      | "Approved"
      | "Rejected"
      | "Additional Information Required"
      | "Suspended";
    phoneNumber?: string;
    email?: string;
    fullName?: string;
    businessLicenseNumber?: string;
    city?: string;
    subCity?: string;
    buildingName?: string;
    floor?: string;
    gpsLocation?: string;
    referenceNumber?: string;
    submissionDate?: string;
  };
}

export interface OfficerAuthResponse {
  token: string;
  user: {
    id: string;
    role: "officer" | "admin";
    username: string;
    fullName: string;
    department: string;
  };
}
