import { Router } from 'express';
import { registrationController } from './registration.controller.js';
import { licenseUpload } from './upload.middleware.js';
import { requireOfficerSession } from '../../middleware/requireOfficerSession.js';
import { requireAuth, requireRole } from '../../middleware/authMiddleware.js';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validateRequest.js';

export const registrationRouter = Router();

const reverificationSchema = z.object({
  fullName: z.string().min(2).optional(),
  phoneNumber: z.string().min(9).optional(),
  sellerLegalName: z.string().min(2).optional(),
  tradeName: z.string().min(2).optional(),
  businessLicenseNumber: z.string().min(3).optional(),
  city: z.string().min(2).optional(),
  subCity: z.string().min(2).optional(),
  buildingName: z.string().min(2).optional(),
  floor: z.string().optional(),
  gpsLocation: z.string().optional(),
}).strict();

registrationRouter.post(
  '/reverify',
  requireAuth,
  requireRole('merchant'),
  licenseUpload.single('document'),
  validateRequest({ body: reverificationSchema }),
  (req, res) => registrationController.submitReverification(req, res)
);

// 1. Submit complete 5-step registration (accepts JSON or multipart file attachment)
registrationRouter.post(
  '/submit',
  licenseUpload.single('document'),
  (req, res) => registrationController.submitApplication(req, res)
);

// 2. Upload standalone business license / trade permit (Step 3)
registrationRouter.post(
  '/upload-license',
  licenseUpload.single('document'),
  (req, res) => registrationController.uploadLicense(req, res)
);

// 3. Pre-validate Ethiopian 10-digit TIN & check uniqueness (Step 2)
registrationRouter.get(
  '/check-tin/:tin',
  (req, res) => registrationController.checkTin(req, res)
);

// 4. Live status lookup for WorkflowPipelineStepper post-submission
registrationRouter.get(
  '/status/:referenceNumber',
  (req, res) => registrationController.getStatus(req, res)
);

// 5. Get all applications (for Revenue Admin portal review)
registrationRouter.get(
  '/applications',
  requireOfficerSession,
  (req, res) => registrationController.getAllApplications(req, res)
);
