import { Router } from 'express';
import { merchantManagementController } from './merchant.controller.js';
import { requireOfficerSession } from '../../../middleware/requireOfficerSession.js';

export const merchantManagementRouter = Router();

merchantManagementRouter.use(requireOfficerSession);

// Onboarding Applications Review
merchantManagementRouter.get('/applications', (req, res) =>
  merchantManagementController.getApplications(req, res)
);
merchantManagementRouter.get('/applications/:ref', (req, res) =>
  merchantManagementController.getApplication(req, res)
);
merchantManagementRouter.get('/applications/:ref/document', (req, res) =>
  merchantManagementController.downloadDocument(req, res)
);
merchantManagementRouter.post('/applications/:ref/decision', (req, res) =>
  merchantManagementController.submitDecision(req, res)
);

// Central Taxpayers Directory
merchantManagementRouter.get('/directory', (req, res) =>
  merchantManagementController.getDirectory(req, res)
);
merchantManagementRouter.get('/directory/:id', (req, res) =>
  merchantManagementController.getDirectoryMerchant(req, res)
);
merchantManagementRouter.patch('/directory/:id/status', (req, res) =>
  merchantManagementController.updateStatus(req, res)
);
