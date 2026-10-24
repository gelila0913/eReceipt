export type SupplyType = 'Goods' | 'Services';

export type VatCategory = 'Standard VAT (15%)' | 'Zero-Rated (0%)' | 'VAT Exempt';

export type UomType = 'PCS' | 'KG' | 'LTR' | 'HRS' | 'BOX';

export type DocumentType =
  | 'Electronic Tax Invoice (VAT Invoice)'
  | 'Electronic Cash / Payment Receipt'
  | 'Credit Note'
  | 'Debit Note';

export type TransactionMode = 'B2B / Registered Buyer' | 'B2C / Walk-in Customer';

export type PaymentMethod =
  | 'Cash'
  | 'Telebirr'
  | 'CBE Birr'
  | 'M-Pesa'
  | 'Bank Transfer — CBE'
  | 'Bank Transfer — Awash'
  | 'Bank Transfer — Abyssinia'
  | 'Bank Transfer — Dashen'
  | 'Check'
  | 'Credit';

export interface CartItem {
  id: number;
  code: string;
  name: string;
  price: number;
  qty: number;
  uom: UomType;
  discount: number;
  vatCategory: VatCategory;
  exciseRate: number;
  supplyType: SupplyType;
}

export interface BuyerInfo {
  name: string;
  tin: string;
  vat: string;
  nationalId: string;
  contact: string;
  designatedAgent: boolean;
  withholdingReference: string;
}

export interface ReceiptDraft {
  merchantId?: string;
  merchantTin?: string;
  merchantName?: string;
  merchantAddress?: string;
  documentType: DocumentType;
  transactionMode: TransactionMode;
  customerName: string;
  customerTin: string;
  customerVat: string;
  customerNationalId: string;
  customerPhone: string;
  designatedWithholdingAgent: boolean;
  withholdingReference: string;
  originalIrn: string;
  adjustmentReason: string;
  items: CartItem[];
  subtotal: number;
  exciseTax: number;
  tax: number;
  withholdingTax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
}

export interface FiscalClearanceData {
  receiptNumber: string;
  issuedAt: string;
  fiscalYear: number;
  branchCode: string;
  registerCode: string;
  sequence: number;
  irn: string;
  rrn: string;
  digitalSignature: string;
  clearanceTimestamp: string;
  qrPayload?: string;
  qrVerificationUrl?: string;
}

export interface IssuedReceipt extends ReceiptDraft, FiscalClearanceData {
  id: string;
  status: 'CLEARED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
}

export interface TaxCalculationResult {
  subtotal: number;
  goodsSubtotal: number;
  servicesSubtotal: number;
  exciseTax: number;
  tax: number;
  withholdingEligible: boolean;
  withholdingTax: number;
  total: number;
  itemBreakdown: Array<{
    id: number;
    code: string;
    name: string;
    netAmount: number;
    exciseAmount: number;
    vatAmount: number;
    lineTotal: number;
  }>;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  price: number;
  uom: UomType;
  vatCategory: VatCategory;
  exciseRate: number;
  supplyType: SupplyType;
}

export interface RegisteredTaxpayer {
  tin: string;
  tradeName: string;
  vatNumber: string;
  registrationStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  designatedWithholdingAgent: boolean;
  taxCenter: string;
  verifiedAt: string;
}
