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
  documentType: DocumentType;
  transactionMode: TransactionMode;
  customerName?: string;
  customerTin?: string;
  customerVat?: string;
  customerNationalId?: string;
  customerPhone?: string;
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
  idempotencyKey?: string;
}

export interface IssuedReceipt extends ReceiptDraft {
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
}

export const MERCHANT_CODE = 'MCH-01';
export const BRANCH_CODE = 'BR01';
export const REGISTER_CODE = 'REG01';

export const INITIAL_ITEMS: CartItem[] = [];


export function netLineAmount(item: CartItem): number {
  return Math.max(0, item.price * item.qty - item.discount);
}

export function lineExcise(item: CartItem): number {
  return (netLineAmount(item) * item.exciseRate) / 100;
}

export function lineVat(item: CartItem): number {
  if (item.vatCategory !== 'Standard VAT (15%)') return 0;
  return (netLineAmount(item) + lineExcise(item)) * 0.15;
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function amountInWords(value: number): string {
  const ones = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const underThousand = (num: number): string =>
    num < 20
      ? ones[num]
      : num < 100
      ? `${tens[Math.floor(num / 10)]}${num % 10 ? `-${ones[num % 10]}` : ''}`
      : `${ones[Math.floor(num / 100)]} hundred${num % 100 ? ` ${underThousand(num % 100)}` : ''}`;

  const integer = Math.floor(value);
  const cents = Math.round((value - integer) * 100);
  const words =
    integer < 1000
      ? underThousand(integer)
      : integer < 1000000
      ? `${underThousand(Math.floor(integer / 1000))} thousand${integer % 1000 ? ` ${underThousand(integer % 1000)}` : ''}`
      : integer.toLocaleString('en-US');

  return `${words} birr and ${String(cents).padStart(2, '0')}/100 cents`;
}

export function amountInAmharic(value: number): string {
  const ones = ['ዜሮ', 'አንድ', 'ሁለት', 'ሶስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ'];
  const tens = ['', 'አስር', 'ሃያ', 'ሰላሳ', 'አርባ', 'ሃምሳ', 'ስልሳ', 'ሰባ', 'ሰማንያ', 'ዘጠና'];
  const underHundred = (num: number) =>
    num < 10
      ? ones[num]
      : num === 10
      ? tens[1]
      : num < 20
      ? `አስራ ${ones[num - 10]}`
      : `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ''}`;
  const underThousand = (num: number): string =>
    num < 100
      ? underHundred(num)
      : `${ones[Math.floor(num / 100)]} መቶ${num % 100 ? ` ${underHundred(num % 100)}` : ''}`;

  const integer = Math.floor(value);
  const cents = Math.round((value - integer) * 100);
  const words =
    integer < 1000
      ? underThousand(integer)
      : integer < 1000000
      ? `${underThousand(Math.floor(integer / 1000))} ሺህ${integer % 1000 ? ` ${underThousand(integer % 1000)}` : ''}`
      : integer.toLocaleString('am-ET');

  return `${words} ብር ከ${String(cents).padStart(2, '0')}/100 ሳንቲም`;
}
