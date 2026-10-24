import { API_BASE_URL } from '../config/api';

export interface ReceiptItem {
  id: number | string;
  code: string;
  name: string;
  price: number;
  qty: number;
  uom: string;
  discount: number;
  vatCategory: string;
  exciseRate: number;
  supplyType?: string;
}

export interface StoredReceipt {
  id: string;
  merchantTin: string;
  merchantName: string;
  merchantLegalName?: string;
  merchantTradeName?: string;
  merchantAddress?: string;
  cashierName?: string;
  operatorId?: string;
  branchCode?: string;
  documentType: string;
  transactionMode: string;
  customerName: string;
  customerTin?: string;
  customerVat?: string;
  customerNationalId?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  exciseTax: number;
  withholdingTax: number;
  total: number;
  paymentMethod: string;
  paymentReference?: string;
  receiptNumber: string;
  issuedAt: string;
  irn: string;
  rrn: string;
  digitalSignature: string;
  clearanceTimestamp: string;
  qrPayload?: string;
  qrVerificationUrl?: string;
  status: string;
  idempotencyKey?: string;
}

export interface MonthlyLedgerRecord {
  id: string;
  month: string;
  year: number;
  monthKey: string; // YYYY-MM
  totalIncome: number;
  totalTax: number;
  expenses: number;
  invoicesCount: number;
  vatStandard: number;
  withholdingTax: number;
  receipts: StoredReceipt[];
}

export interface MonthlyAuditRecord {
  key: string;
  month: string;
  income: number;
  expenses: number;
  tax: number;
  invoicesCount: number;
}

const STORAGE_PREFIX = 'ereceipt_merchant_receipts_';

/**
 * Get all receipts issued by a specific merchant.
 * Strictly isolated per merchant TIN.
 */
export function getMerchantReceipts(merchantTin: string): StoredReceipt[] {
  if (!merchantTin || !merchantTin.trim()) return [];

  const cleanTin = merchantTin.trim();
  const key = `${STORAGE_PREFIX}${cleanTin}`;
  try {
    const raw = localStorage.getItem(key);
    const receipts: StoredReceipt[] = raw ? JSON.parse(raw) : [];
    // Strict isolation guarantee: filter to ensure no cross-contamination
    return receipts.filter((r) => r.merchantTin === cleanTin);
  } catch {
    return [];
  }
}

/**
 * Save a new receipt exclusively for a specific merchant
 */
export function saveMerchantReceipt(merchantTin: string, receipt: StoredReceipt): void {
  if (!merchantTin || !merchantTin.trim()) return;

  const cleanTin = merchantTin.trim();
  const key = `${STORAGE_PREFIX}${cleanTin}`;
  try {
    const receipts = getMerchantReceipts(cleanTin);
    const boundedReceipt: StoredReceipt = {
      ...receipt,
      merchantTin: cleanTin,
    };
    // Prepend new receipt and deduplicate idempotently by id, irn, or idempotencyKey
    const updated = [
      boundedReceipt,
      ...receipts.filter(
        (r) =>
          r.id !== receipt.id &&
          (!receipt.irn || r.irn !== receipt.irn) &&
          (!receipt.idempotencyKey || r.idempotencyKey !== receipt.idempotencyKey)
      ),
    ];
    localStorage.setItem(key, JSON.stringify(updated));

    // Dispatch global event so all screens re-compute immediately
    window.dispatchEvent(
      new CustomEvent('ereceipt:receipts_updated', { detail: { merchantTin: cleanTin } })
    );
  } catch (err) {
    console.error('Error saving merchant receipt:', err);
  }
}

/**
 * Sync receipts from backend for this merchant and merge into isolated store
 */
export async function syncMerchantReceipts(
  merchantTin: string,
  token?: string
): Promise<StoredReceipt[]> {
  if (!merchantTin || !merchantTin.trim()) return [];

  const cleanTin = merchantTin.trim();
  try {
    const authToken =
      token ||
      localStorage.getItem('ereceipt_token') ||
      localStorage.getItem('merchant_token');
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(
      `${API_BASE_URL}/api/receipts?merchantTin=${encodeURIComponent(cleanTin)}`,
      { headers }
    );
    if (!res.ok) return getMerchantReceipts(cleanTin);

    const json = await res.json();
    const serverReceipts = json.receipts || [];
    // Strictly isolate only receipts belonging to this merchant
    const valid = serverReceipts.filter((r: StoredReceipt) => r.merchantTin === cleanTin);

    const local = getMerchantReceipts(cleanTin);
    const map = new Map<string, StoredReceipt>();
    for (const r of valid) map.set(r.id, r);
    for (const r of local) map.set(r.id, r);

    const merged = Array.from(map.values()).sort((a, b) =>
      (b.issuedAt || '').localeCompare(a.issuedAt || '')
    );

    localStorage.setItem(`${STORAGE_PREFIX}${cleanTin}`, JSON.stringify(merged));
    window.dispatchEvent(
      new CustomEvent('ereceipt:receipts_updated', { detail: { merchantTin: cleanTin } })
    );
    return merged;
  } catch {
    return getMerchantReceipts(cleanTin);
  }
}

/**
 * Get the latest cleared receipt for the merchant
 */
export function getLatestMerchantReceipt(merchantTin: string): StoredReceipt | null {
  if (!merchantTin || !merchantTin.trim()) return null;
  const receipts = getMerchantReceipts(merchantTin.trim());
  return receipts.length > 0 ? receipts[0] : null;
}

/**
 * Compute monthly transaction ledger solely from the merchant's real receipts
 */
export function getMerchantMonthlyLedger(
  merchantTin: string,
  filterYear?: number
): MonthlyLedgerRecord[] {
  if (!merchantTin || !merchantTin.trim()) return [];

  const receipts = getMerchantReceipts(merchantTin.trim());
  const groups = new Map<string, MonthlyLedgerRecord>();

  for (const receipt of receipts) {
    if (!receipt.issuedAt) continue;
    const dateObj = new Date(receipt.issuedAt);
    const year = dateObj.getFullYear();
    if (filterYear && year !== filterYear) continue;

    const monthKey = receipt.issuedAt.slice(0, 7); // e.g. "2026-10"
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });

    let record = groups.get(monthKey);
    if (!record) {
      record = {
        id: `rec-${monthKey}`,
        month: monthName,
        year,
        monthKey,
        totalIncome: 0,
        totalTax: 0,
        expenses: 0,
        invoicesCount: 0,
        vatStandard: 0,
        withholdingTax: 0,
        receipts: [],
      };
      groups.set(monthKey, record);
    }

    record.totalIncome += receipt.total || 0;
    record.totalTax += (receipt.tax || 0) + (receipt.exciseTax || 0);
    record.vatStandard += receipt.tax || 0;
    record.withholdingTax += receipt.withholdingTax || 0;
    record.invoicesCount += 1;
    record.receipts.push(receipt);
  }

  // Sort descending by monthKey
  return Array.from(groups.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/**
 * Compute monthly audit records strictly from merchant's real receipts within date range
 */
export function getMerchantAuditRecords(
  merchantTin: string,
  startDate: string,
  endDate: string
): MonthlyAuditRecord[] {
  if (!merchantTin || !merchantTin.trim()) return [];

  const receipts = getMerchantReceipts(merchantTin.trim());
  const startKey = startDate.slice(0, 7);
  const endKey = endDate.slice(0, 7);

  const groups = new Map<string, MonthlyAuditRecord>();

  for (const receipt of receipts) {
    if (!receipt.issuedAt) continue;
    const monthKey = receipt.issuedAt.slice(0, 7);
    if (monthKey < startKey || monthKey > endKey) continue;

    const dateObj = new Date(receipt.issuedAt);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let record = groups.get(monthKey);
    if (!record) {
      record = {
        key: monthKey,
        month: monthName,
        income: 0,
        expenses: 0,
        tax: 0,
        invoicesCount: 0,
      };
      groups.set(monthKey, record);
    }

    record.income += receipt.total || 0;
    record.tax += (receipt.tax || 0) + (receipt.exciseTax || 0);
    record.invoicesCount += 1;
  }

  // Sort descending
  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Find a receipt by its IRN across all locally stored merchant receipt collections
 */
export function findReceiptByIrn(irn: string): StoredReceipt | null {
  if (!irn || !irn.trim()) return null;
  const targetIrn = irn.trim().toLowerCase();

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('ereceipt:receipts:')) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const list: StoredReceipt[] = JSON.parse(raw);
          const found = list.find(
            (r) =>
              r.irn?.toLowerCase() === targetIrn ||
              r.receiptNumber?.toLowerCase() === targetIrn
          );
          if (found) return found;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}
