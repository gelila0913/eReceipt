import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IssuedReceipt, Product, RegisteredTaxpayer } from '../models/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.json');
const SEQUENCE_FILE = path.join(DATA_DIR, 'sequence.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const SAMPLE_PRODUCTS: Product[] = [];

export const REGISTERED_TAXPAYERS: Record<string, RegisteredTaxpayer> = {};

class Database {
  private receipts: IssuedReceipt[] = [];
  private sequence: number = 194;

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    try {
      if (fs.existsSync(RECEIPTS_FILE)) {
        const raw = fs.readFileSync(RECEIPTS_FILE, 'utf-8');
        this.receipts = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Could not read receipts.json, initializing empty array:', err);
      this.receipts = [];
    }

    try {
      if (fs.existsSync(SEQUENCE_FILE)) {
        const raw = fs.readFileSync(SEQUENCE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.sequence === 'number') {
          this.sequence = parsed.sequence;
        }
      }
    } catch {
      this.sequence = 194;
    }
  }

  public persistReceipts(): void {
    try {
      fs.writeFileSync(RECEIPTS_FILE, JSON.stringify(this.receipts, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving receipts to disk:', err);
    }
  }

  private persistSequence(): void {
    try {
      fs.writeFileSync(SEQUENCE_FILE, JSON.stringify({ sequence: this.sequence }), 'utf-8');
    } catch (err) {
      console.error('Error saving sequence to disk:', err);
    }
  }

  public getNextSequence(): number {
    this.sequence += 1;
    this.persistSequence();
    return this.sequence;
  }

  public getCurrentSequence(): number {
    return this.sequence;
  }

  public saveReceipt(receipt: IssuedReceipt): IssuedReceipt {
    this.receipts.unshift(receipt);
    this.persistReceipts();
    return receipt;
  }

  public getAllReceipts(options?: {
    search?: string;
    documentType?: string;
    merchantTin?: string;
    limit?: number;
    offset?: number;
  }): { receipts: IssuedReceipt[]; total: number } {
    let list = [...this.receipts];

    if (options?.merchantTin) {
      list = list.filter((receipt) => receipt.merchantTin === options.merchantTin);
    }

    if (options?.documentType) {
      list = list.filter((r) => r.documentType === options.documentType);
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(q) ||
          r.irn.toLowerCase().includes(q) ||
          r.customerName?.toLowerCase().includes(q) ||
          r.customerTin?.toLowerCase().includes(q)
      );
    }

    const total = list.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    const paginated = list.slice(offset, offset + limit);

    return { receipts: paginated, total };
  }

  public findReceiptById(id: string): IssuedReceipt | undefined {
    return this.receipts.find((r) => r.id === id || r.receiptNumber === id || r.irn === id);
  }

  public findReceiptByIrn(irn: string): IssuedReceipt | undefined {
    return this.receipts.find((r) => r.irn === irn);
  }

  public getProducts(): Product[] {
    return SAMPLE_PRODUCTS;
  }

  public getTaxpayer(tin: string): RegisteredTaxpayer | undefined {
    return REGISTERED_TAXPAYERS[tin];
  }
}

export const db = new Database();
