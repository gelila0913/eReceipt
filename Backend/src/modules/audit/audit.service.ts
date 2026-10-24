import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MonthlyFinancialRecord, TaxCalculationResponse, AuditLogEvent } from "./audit.types.js";
import { AuditFilterInput, ApproveTaxInput } from "./audit.schema.js";
import { db } from "../../database/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'merchant-audit-logs.json');

/** Load audit logs from disk */
function loadAuditLogs(): AuditLogEvent[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8'));
    }
  } catch {
    // ignore parse errors — start fresh
  }
  return [];
}

/** Persist audit logs to disk */
function saveAuditLogs(logs: AuditLogEvent[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AuditService] Failed to persist audit logs:', err);
  }
}

export class AuditService {
  private auditLogs: AuditLogEvent[] = loadAuditLogs();

  /**
   * Filter monthly financial records by date range, strictly scoped by merchant TIN
   */
  async getMonthlyRecords(filter: AuditFilterInput, merchantTin?: string): Promise<MonthlyFinancialRecord[]> {
    if (!merchantTin) {
      return [];
    }

    const startKey = filter.startDate.slice(0, 7);
    const endKey = filter.endDate.slice(0, 7);

    // Fetch real issued receipts from DB, filtered by merchant TIN
    const { receipts } = db.getAllReceipts({ merchantTin, limit: 10000 });

    const monthMap = new Map<string, { income: number; expenses: number; tax: number; monthName: string }>();

    for (const receipt of receipts) {
      if (!receipt.issuedAt) continue;
      const key = receipt.issuedAt.slice(0, 7); // YYYY-MM
      if (key < startKey || key > endKey) continue;

      const dateObj = new Date(receipt.issuedAt);
      const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const current = monthMap.get(key) || { income: 0, expenses: 0, tax: 0, monthName };
      current.income += receipt.total || 0;
      current.tax += (receipt.tax || 0) + (receipt.exciseTax || 0);
      monthMap.set(key, current);
    }

    const records: MonthlyFinancialRecord[] = [];
    for (const [key, val] of monthMap.entries()) {
      records.push({
        key,
        month: val.monthName,
        income: val.income,
        expenses: val.expenses,
        tax: val.tax,
      });
    }

    // Sort chronologically descending
    return records.sort((a, b) => b.key.localeCompare(a.key));
  }

  /**
   * Compute aggregated tax calculations for a given range, scoped to the merchant
   */
  async calculateTaxPeriod(filter: AuditFilterInput, merchantTin?: string): Promise<TaxCalculationResponse> {
    const records = await this.getMonthlyRecords(filter, merchantTin);
    const totalIncome = records.reduce((sum, r) => sum + r.income, 0);
    const totalExpenses = records.reduce((sum, r) => sum + r.expenses, 0);
    const totalTax = records.reduce((sum, r) => sum + r.tax, 0);

    return {
      startDate: filter.startDate,
      endDate: filter.endDate,
      monthsCount: records.length,
      totalIncome,
      totalExpenses,
      totalTax,
      records,
    };
  }

  /**
   * Approve calculated tax for the period — persisted to disk
   */
  async approveTax(input: ApproveTaxInput, userIdentifier: string) {
    const logEntry: AuditLogEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      user: userIdentifier,
      role: "merchant",
      action: "TAX_DECLARATION_APPROVED",
      resource: `Period ${input.startDate} to ${input.endDate} (ETB ${input.approvedAmount.toFixed(2)})`,
      ipAddress: "127.0.0.1",
    };

    this.auditLogs.unshift(logEntry);
    saveAuditLogs(this.auditLogs);

    return {
      success: true,
      approvedAmount: input.approvedAmount,
      approvedAt: new Date().toISOString(),
      auditLogId: logEntry.id,
    };
  }

  /**
   * Get audit trail logs scoped to the requesting user.
   * Officers see all; merchants see only their own entries.
   */
  async getAuditLogs(merchantTin?: string): Promise<AuditLogEvent[]> {
    if (merchantTin) {
      return this.auditLogs.filter(
        (log) => log.user === merchantTin || log.resource?.includes(merchantTin)
      );
    }
    return this.auditLogs;
  }
}

export const auditService = new AuditService();
