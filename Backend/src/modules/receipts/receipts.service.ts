import { NotFoundError, BadRequestError } from "../../common/errors.js";
import { calculateReceiptTaxes } from "../../common/calculator.js";
import { CreateReceiptInput, VoidReceiptInput } from "./receipts.schema.js";
import { Receipt } from "./receipts.types.js";
import { db } from "../../database/db.js";
import { config } from "../../config/index.js";

/**
 * Map the disk-persisted IssuedReceipt shape to the Receipt interface exposed by this module.
 * We store in db.ts using the richer EIMS receipt format; here we adapt it to the simpler module type.
 */
function toModuleReceipt(r: any): Receipt {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber || r.irn || r.id,
    merchantId: r.merchantId || `MER-${(r.merchantTin || "").slice(-5)}`,
    merchantName: r.merchantName || r.merchantLegalName || "Merchant",
    merchantTin: r.merchantTin || "",
    merchantAddress: r.merchantAddress || "Addis Ababa, Ethiopia",
    customerName: r.customerName || "Walk-in Customer",
    customerTin: r.customerTin,
    customerPhone: r.customerPhone,
    items: (r.items || []).map((it: any, idx: number) => ({
      id: it.id || `item-${idx}`,
      name: it.name,
      quantity: it.qty ?? it.quantity ?? 1,
      unitPrice: it.price ?? it.unitPrice ?? 0,
      lineTotal: it.lineTotal ?? (it.qty ?? it.quantity ?? 1) * (it.price ?? it.unitPrice ?? 0),
    })),
    subtotal: r.subtotal ?? (r.total ?? 0) - (r.tax ?? 0),
    taxRate: 0.15,
    taxAmount: r.tax ?? r.taxAmount ?? 0,
    totalAmount: r.total ?? r.totalAmount ?? 0,
    paymentMethod: r.paymentMethod || "Cash",
    status: r.status || "Cleared",
    verificationUrl: r.qrVerificationUrl || `${config.corsOrigin || "http://localhost:5173"}/verify/${r.receiptNumber || r.irn}`,
    qrPayload: r.qrPayload || `ERECEIPT|${r.receiptNumber || r.irn}|TIN:${r.merchantTin}|STATUS:CLEARED`,
    createdAt: r.issuedAt || r.createdAt || new Date().toISOString(),
    voidReason: r.voidReason,
    voidedAt: r.voidedAt,
  };
}

export class ReceiptsService {
  /**
   * Issue a new digital receipt with automated tax calculation
   * Persists to disk via db.ts
   */
  async createReceipt(input: CreateReceiptInput): Promise<Receipt> {
    const taxCalc = calculateReceiptTaxes(input.items);
    const seq = db.getNextSequence();
    const receiptNum = `RC-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
    const id = `rc-${Date.now()}`;
    const now = new Date().toISOString();

    const itemsWithIds = taxCalc.items.map((item, idx) => ({
      id: `item-${Date.now()}-${idx + 1}`,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }));

    // Build QR verification URL using FRONTEND_URL env or fallback
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verificationUrl = `${frontendUrl}/verify/${receiptNum}`;
    const qrPayload = `ERECEIPT|${receiptNum}|TIN:${input.merchantTin}|TOTAL:${taxCalc.totalAmount.toFixed(2)}|TAX:${taxCalc.taxAmount.toFixed(2)}|STATUS:CLEARED`;

    const receipt: Receipt = {
      id,
      receiptNumber: receiptNum,
      merchantId: input.merchantId || `MER-${Date.now()}`,
      merchantName: input.merchantName || "Registered Merchant",
      merchantTin: input.merchantTin || "",
      merchantAddress: input.merchantAddress || "Addis Ababa, Ethiopia",
      customerName: input.customerName || "Walk-in Customer",
      customerTin: input.customerTin,
      customerNationalId: input.customerNationalId,
      customerPhone: input.customerPhone,
      items: itemsWithIds,
      subtotal: taxCalc.subtotal,
      taxRate: taxCalc.taxRate,
      taxAmount: taxCalc.taxAmount,
      totalAmount: taxCalc.totalAmount,
      paymentMethod: input.paymentMethod || "Cash",
      status: "Cleared",
      verificationUrl,
      qrPayload,
      createdAt: now,
    };

    // Persist to disk so data survives restarts
    db.saveReceipt({
      id,
      receiptNumber: receiptNum,
      merchantId: receipt.merchantId,
      merchantTin: receipt.merchantTin,
      merchantName: receipt.merchantName,
      merchantAddress: receipt.merchantAddress,
      customerName: receipt.customerName,
      customerTin: receipt.customerTin || "",
      total: taxCalc.totalAmount,
      tax: taxCalc.taxAmount,
      exciseTax: 0,
      withholdingTax: 0,
      subtotal: taxCalc.subtotal,
      items: itemsWithIds.map((it) => ({
        id: it.id,
        name: it.name,
        qty: it.quantity,
        price: it.unitPrice,
        lineTotal: it.lineTotal,
      })) as any,
      paymentMethod: receipt.paymentMethod,
      status: "Cleared",
      issuedAt: now,
      irn: receiptNum,
      rrn: `RRN-${seq}`,
      digitalSignature: `SIG-${id}`,
      clearanceTimestamp: now,
      qrPayload,
      qrVerificationUrl: verificationUrl,
      documentType: "RECEIPT",
    } as any);

    return receipt;
  }

  /**
   * List receipts with optional filters — reads from disk
   */
  async getReceipts(filters?: {
    merchantId?: string;
    merchantTin?: string;
    status?: string;
    search?: string;
  }): Promise<Receipt[]> {
    const { receipts } = db.getAllReceipts({
      merchantTin: filters?.merchantTin,
      search: filters?.search,
      limit: 500,
    });

    return receipts
      .filter((r: any) => {
        if (filters?.merchantId && r.merchantId !== filters.merchantId) return false;
        if (filters?.status && filters.status !== "All" && r.status !== filters.status) return false;
        return true;
      })
      .map(toModuleReceipt);
  }

  /**
   * Retrieve single receipt by ID or Receipt Number — reads from disk
   */
  async getReceiptById(identifier: string): Promise<Receipt> {
    const rc = db.findReceiptById(identifier);
    if (!rc) {
      throw new NotFoundError(`Receipt '${identifier}' not found.`);
    }
    return toModuleReceipt(rc);
  }

  /**
   * Public verification endpoint for QR code scans
   */
  async verifyReceipt(receiptNumber: string): Promise<{
    isValid: boolean;
    receipt: Receipt;
    verificationTimestamp: string;
  }> {
    const rc = await this.getReceiptById(receiptNumber);
    return {
      isValid: rc.status !== "Voided",
      receipt: rc,
      verificationTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Void a receipt (e.g., in case of cancellation/refund)
   */
  async voidReceipt(id: string, input: VoidReceiptInput): Promise<Receipt> {
    const raw = db.findReceiptById(id);
    if (!raw) {
      throw new NotFoundError(`Receipt '${id}' not found.`);
    }
    if ((raw as any).status === "Voided") {
      throw new BadRequestError("This receipt is already voided.");
    }

    // Update in-place (db stores reference)
    (raw as any).status = "Voided";
    (raw as any).voidReason = input.reason;
    (raw as any).voidedAt = new Date().toISOString();
    (raw as any).qrPayload = `ERECEIPT|${raw.receiptNumber}|STATUS:VOIDED`;

    // Re-persist updated receipts
    (db as any).persistReceipts?.();

    return toModuleReceipt(raw);
  }
}

export const receiptsService = new ReceiptsService();
