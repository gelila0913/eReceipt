import type { Request, Response } from 'express';
import { ReceiptService } from '../services/receiptService.js';
import { calculateTaxes } from '../services/taxCalculationService.js';
import type { ReceiptDraft } from '../models/types.js';
import { applicationStorage } from '../features/merchant-registration/storage.js';
import { ForbiddenError } from '../common/errors.js';

export class ReceiptController {
  /**
   * POST /api/receipts/issue
   */
  public static async issue(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        throw new ForbiddenError('Only authenticated merchants may issue receipts.');
      }

      const merchant = applicationStorage.getByTin(req.user.identifier);
      if (!merchant) {
        throw new ForbiddenError('Merchant registration was not found.');
      }

      const draft = {
        ...req.body,
        merchantId: `MER-${merchant.tin.slice(-5)}`,
        merchantTin: merchant.tin,
        merchantName: merchant.sellerLegalName,
        merchantAddress: [merchant.buildingName, merchant.subCity, merchant.city]
          .filter(Boolean)
          .join(', '),
      } as ReceiptDraft;

      if (!draft) {
        res.status(400).json({ error: 'Receipt payload is required in body.' });
        return;
      }

      const result = ReceiptService.issueReceipt(draft);

      if (!result.success) {
        res.status(422).json({
          success: false,
          error: 'Validation failed according to statutory EIMS rules.',
          details: result.errors,
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'MoR EIMS Clearance confirmed (HTTP 200). Receipt issued.',
        receipt: result.receipt,
      });
    } catch (err) {
      console.error('Error issuing receipt:', err);
      res.status(500).json({ error: 'Internal server error while processing fiscal receipt.' });
    }
  }

  /**
   * POST /api/receipts/calculate
   */
  public static async calculate(req: Request, res: Response): Promise<void> {
    try {
      const { items, transactionMode, withholdingRequested, isDesignatedAgent } = req.body;

      if (!Array.isArray(items)) {
        res.status(400).json({ error: 'items must be an array.' });
        return;
      }

      const results = calculateTaxes(
        items,
        transactionMode || 'B2B / Registered Buyer',
        Boolean(withholdingRequested),
        Boolean(isDesignatedAgent)
      );

      res.json({ success: true, calculations: results });
    } catch (err) {
      console.error('Error calculating taxes:', err);
      res.status(500).json({ error: 'Internal server error during tax calculation.' });
    }
  }

  /**
   * GET /api/receipts
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const { search, documentType, limit, offset } = req.query;

      const result = ReceiptService.getReceipts({
        search: typeof search === 'string' ? search : undefined,
        documentType: typeof documentType === 'string' ? documentType : undefined,
        merchantTin: req.user?.role === 'merchant' ? req.user.identifier : undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });

      res.json({
        success: true,
        total: result.total,
        receipts: result.receipts,
      });
    } catch (err) {
      console.error('Error listing receipts:', err);
      res.status(500).json({ error: 'Internal server error while fetching receipts.' });
    }
  }

  /**
   * GET /api/receipts/:id
   */
  public static async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const receipt = ReceiptService.getReceiptById(id);

      if (!receipt) {
        res.status(404).json({ error: `Receipt with ID/IRN "${id}" not found.` });
        return;
      }
      if (
        req.user?.role === 'merchant' &&
        receipt.merchantTin !== req.user.identifier
      ) {
        res.status(403).json({ error: 'Merchants may only access their own receipts.' });
        return;
      }

      res.json({ success: true, receipt });
    } catch (err) {
      console.error('Error fetching receipt:', err);
      res.status(500).json({ error: 'Internal server error while fetching receipt.' });
    }
  }

  /**
   * GET /api/receipts/verify/:irn
   */
  public static async verify(req: Request, res: Response): Promise<void> {
    try {
      const irn = Array.isArray(req.params.irn) ? req.params.irn[0] : req.params.irn;
      const receipt = ReceiptService.getReceiptByIrn(irn);

      if (!receipt) {
        res.status(404).json({
          valid: false,
          message: `No fiscal receipt found for IRN "${irn}".`,
        });
        return;
      }

      res.json({
        valid: true,
        irn: receipt.irn,
        receiptNumber: receipt.receiptNumber,
        issuedAt: receipt.issuedAt,
        customerName: receipt.customerName,
        customerTin: receipt.customerTin,
        total: receipt.total,
        tax: receipt.tax,
        digitalSignature: receipt.digitalSignature,
        status: receipt.status,
      });
    } catch (err) {
      console.error('Error verifying receipt:', err);
      res.status(500).json({ error: 'Internal server error while verifying receipt.' });
    }
  }
}
