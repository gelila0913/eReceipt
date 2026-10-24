import { db } from '../database/db.js';
import { calculateTaxes } from './taxCalculationService.js';
import { FiscalClearanceService } from './fiscalClearanceService.js';
import type { ReceiptDraft, IssuedReceipt } from '../models/types.js';

export class ReceiptService {
  /**
   * Validates and issues an official fiscal cleared receipt
   */
  public static issueReceipt(draft: ReceiptDraft): {
    success: boolean;
    receipt?: IssuedReceipt;
    errors?: string[];
  } {
    const errors: string[] = [];

    // 1. Validation checks matching statutory regulations
    if (!draft.items || draft.items.length === 0) {
      errors.push('At least one line item is required.');
    }

    const isB2C = draft.transactionMode?.startsWith('B2C');
    const isB2B = draft.transactionMode?.startsWith('B2B');

    // Credit / Debit notes require adjustment reason & original IRN
    const isAdjustment =
      draft.documentType?.startsWith('Credit') || draft.documentType?.startsWith('Debit');
    if (isAdjustment) {
      if (!draft.adjustmentReason?.trim()) {
        errors.push('Credit/Debit notes require an adjustment reason code.');
      }
      if (!draft.originalIrn?.trim()) {
        errors.push('Credit/Debit notes require the original cleared Invoice Reference Number (IRN).');
      }
    }

    // Digital payments require a transaction reference
    const nonCashMethods = ['Telebirr', 'CBE Birr', 'M-Pesa', 'Bank Transfer'];
    const isDigital = nonCashMethods.some((m) => draft.paymentMethod?.includes(m));
    if (isDigital && !draft.paymentReference?.trim()) {
      errors.push(`Payment method "${draft.paymentMethod}" requires a transaction reference.`);
    }

    // 2. Perform server-side statutory calculation
    const taxResults = calculateTaxes(
      draft.items || [],
      draft.transactionMode || 'B2C / Walk-in Customer',
      draft.designatedWithholdingAgent,
      draft.designatedWithholdingAgent
    );

    // Customer identification statutory rules:
    // 1. For B2B transactions: 10-digit TIN is mandatory for registered business buyers
    if (isB2B) {
      if (!draft.customerTin?.trim() || draft.customerTin.trim().length !== 10) {
        errors.push('B2B transactions require a valid 10-digit customer TIN.');
      }
    }

    // 2. For B2C transactions: TIN and Fayda FIN are both optional for walk-in consumers
    if (isB2C && draft.customerTin?.trim() && draft.customerTin.trim().length !== 10) {
      errors.push('If provided, customer TIN must be exactly 10 digits.');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Check if receipt was already issued under this idempotency key
    const idempotencyKey = (draft as any).idempotencyKey;
    if (idempotencyKey) {
      const existing = db.getAllReceipts().receipts.find((r: any) => r.idempotencyKey === idempotencyKey);
      if (existing) {
        return { success: true, receipt: existing };
      }
    }

    // 3. Obtain official Fiscal Clearance from MoR EIMS
    const clearanceData = FiscalClearanceService.clearInvoice({
      ...draft,
      total: taxResults.total,
    });

    // 4. Construct complete official Issued Receipt record
    const issuedReceipt: IssuedReceipt = {
      ...draft,
      id: clearanceData.irn,
      subtotal: taxResults.subtotal,
      exciseTax: taxResults.exciseTax,
      tax: taxResults.tax,
      withholdingTax: taxResults.withholdingTax,
      total: taxResults.total,
      ...clearanceData,
      status: 'CLEARED',
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };

    // 5. Persist to database
    db.saveReceipt(issuedReceipt);

    return {
      success: true,
      receipt: issuedReceipt,
    };
  }

  public static getReceipts(options?: {
    search?: string;
    documentType?: string;
    merchantTin?: string;
    limit?: number;
    offset?: number;
  }) {
    return db.getAllReceipts(options);
  }

  public static getReceiptById(id: string) {
    return db.findReceiptById(id);
  }

  public static getReceiptByIrn(irn: string) {
    return db.findReceiptByIrn(irn);
  }
}
