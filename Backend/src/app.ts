import express, { Application, Request, Response } from 'express';
import cors from 'cors';

// Fani feature routers
import { registrationRouter } from './features/merchant-registration/index.js';
import { officerAuthRouter } from './features/admin/officer-auth/index.js';
import { merchantManagementRouter } from './features/admin/merchant-management/index.js';
import { fiscalOversightRouter } from './features/admin/fiscal-oversight/index.js';
import { otpRouter } from './routes/otp.routes.js';

// Domain feature routers from main
import { authRouter } from './modules/auth/auth.routes.js';
import { merchantsRouter } from './modules/merchants/merchants.routes.js';
import { receiptsRouter } from './modules/receipts/receipts.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { receiptRoutes } from './routes/receiptRoutes.js';
import { tinRoutes } from './routes/tinRoutes.js';
import { productRoutes } from './routes/productRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { taxInvoicePreviewRoutes } from './routes/taxInvoicePreviewRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app: Application = express();

// Middlewares
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoints (both /health and /api/health)
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    service: 'eReceipt API Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Info Root
app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'eReceipt Digital Tax & Receipt Management API',
    endpoints: {
      health: '/api/health',
      registration: '/api/registration',
      officerAuth: '/api/admin/auth',
      adminMerchants: '/api/admin/merchants',
      adminFiscal: '/api/admin/fiscal',
      auth: '/api/auth',
      merchants: '/api/merchants',
      receipts: '/api/receipts',
      tin: '/api/tin',
      products: '/api/products',
      audit: '/api/audit',
      admin: '/api/admin',
    },
  });
});

// Mount Feature: Merchant Registration
app.use('/api/registration', registrationRouter);

// Mount Feature: Revenue Officer Auth
app.use('/api/admin/auth', officerAuthRouter);

// Mount Feature: OTP Verification & Resend
app.use('/api/otp', otpRouter);

// Mount Feature: Merchant Approvals & Directory
app.use('/api/admin/merchants', merchantManagementRouter);

// Mount Feature: Admin Fiscal Oversight & Audit
app.use('/api/admin/fiscal', fiscalOversightRouter);

// Mount Feature: Domain Modules from main
app.use('/api/auth', authRouter);
app.use('/api/merchants', merchantsRouter);
app.use('/api/receipts', receiptRoutes);
app.use('/api/receipts', receiptsRouter);
app.use('/api/tin', tinRoutes);
app.use('/api/products', productRoutes);
app.use('/api/audit', auditRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRoutes);
app.use('/api/invoices', taxInvoicePreviewRoutes);

// 404 & Global Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
