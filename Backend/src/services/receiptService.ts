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
      draft.transactionMode,
      draft.designatedWithholdingAgent,
      draft.designatedWithholdingAgent
    );

    // High value B2C customer identity check (>= 10,000 ETB)
    if (isB2C && taxResults.total >= 10000) {
      const hasName = Boolean(draft.customerName?.trim());
      const hasTinOrFin =
        draft.customerTin?.length === 10 || Boolean(draft.customerNationalId?.trim());
      if (!hasName || !hasTinOrFin) {
        errors.push(
          'High-value sales (>= 10,000 ETB) require customer name and 10-digit TIN or Fayda National ID (FIN).'
        );
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
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
