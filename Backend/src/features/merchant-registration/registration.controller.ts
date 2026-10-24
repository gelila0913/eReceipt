import type { Request, Response } from 'express';
import fs from 'node:fs';
import { registrationService } from './registration.service.js';
import type { MerchantRegistrationInput } from './types.js';
import { hasValidDocumentSignature } from './upload.middleware.js';

export class MerchantRegistrationController {
  /**
   * POST /api/registration/submit
   */
  public async submitApplication(req: Request, res: Response): Promise<void> {
    try {
      const input: MerchantRegistrationInput = req.body;
      const uploadedFile = req.file;

      if (uploadedFile && !hasValidDocumentSignature(uploadedFile)) {
        fs.unlinkSync(uploadedFile.path);
        res.status(400).json({
          success: false,
          error: 'The uploaded file content does not match a supported document type.',
        });
        return;
      }

      const result = await registrationService.submitRegistration(input, uploadedFile);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration submission failed.';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  }

  public async submitReverification(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ success: false, error: 'Merchant authentication is required.' });
        return;
      }
      if (req.file && !hasValidDocumentSignature(req.file)) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({
          success: false,
          error: 'The uploaded file content does not match a supported document type.',
        });
        return;
      }

      const result = registrationService.submitReverification(
        req.user.identifier,
        req.body,
        req.file
      );
      res.status(202).json({ success: true, data: result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Re-verification submission failed.';
      res.status(400).json({ success: false, error: message });
    }
  }

  /**
   * POST /api/registration/upload-license
   */
  public async uploadLicense(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No document file provided. Please attach a PDF or image.',
        });
        return;
      }
      if (!hasValidDocumentSignature(req.file)) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({
          success: false,
          error: 'The uploaded file content does not match a supported document type.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          originalName: req.file.originalname,
          sizeBytes: req.file.size,
          sizeFormatted: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
          filename: req.file.filename,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'File upload failed.';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * GET /api/registration/check-tin/:tin
   */
  public async checkTin(req: Request, res: Response): Promise<void> {
    try {
      const tin = String(req.params.tin ?? '');
      const result = registrationService.checkTin(tin);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'TIN verification failed.';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * GET /api/registration/status/:referenceNumber
   */
  public async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const referenceNumber = String(req.params.referenceNumber ?? '');
      const statusData = registrationService.getStatus(referenceNumber);
      res.status(200).json({
        success: true,
        data: statusData,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not retrieve application status.';
      res.status(404).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * GET /api/registration/applications
   */
  public async getAllApplications(_req: Request, res: Response): Promise<void> {
    try {
      const applications = registrationService.getAllApplications().map(
        ({ passwordHash: _passwordHash, ...application }) => application
      );
      res.status(200).json({
        success: true,
        count: applications.length,
        data: applications,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve applications.';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
}

export const registrationController = new MerchantRegistrationController();
