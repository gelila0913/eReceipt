import 'dotenv/config';
import app from './app.js';
import { config } from './config/index.js';
import { NetworkService } from './services/networkService.js';

const port = config.port || 5000;

const server = app.listen(port, '0.0.0.0', () => {
  const lanIp = NetworkService.getPreferredLanIp();

  // ⚠️  Security warnings for insecure defaults
  const defaultJwtSecret = 'ereceipt-dev-secret-key-change-in-prod';
  const defaultEimsKey = 'mor-eims-fiscal-secret-key-2026';
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === defaultJwtSecret) {
    console.warn('\n⚠️  [SECURITY WARNING] JWT_SECRET is not set or is using the insecure default value!');
    console.warn('   Set a strong random JWT_SECRET in your .env file before deploying to production.');
    console.warn('   Generate one: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"\n');
  }
  if (!process.env.EIMS_SECRET_KEY || process.env.EIMS_SECRET_KEY === defaultEimsKey) {
    console.warn('⚠️  [SECURITY WARNING] EIMS_SECRET_KEY is using the default value. Change it in production.\n');
  }
  console.log('====================================================');
  console.log(`🚀 eReceipt Backend Server is RUNNING`);
  console.log(`📡 URL: http://localhost:${port}`);
  console.log(`📱 Mobile LAN URL: http://${lanIp}:${port}`);
  console.log(`📋 Health Check: http://localhost:${port}/api/health`);
  console.log(`📝 Registration API: http://localhost:${port}/api/registration`);
  console.log(`🔐 Officer Auth: http://localhost:${port}/api/admin/auth`);
  console.log(`🏛️  Merchant Approvals: http://localhost:${port}/api/admin/merchants`);
  console.log(`🧾 Receipts API: http://localhost:${port}/api/receipts`);
  console.log(`🔍 TIN Verification: http://localhost:${port}/api/tin/verify`);
  console.log(`📦 Products API: http://localhost:${port}/api/products`);
  console.log(`⚙️  Mode: ${config.eimsClearanceMode} (Merchant: ${config.merchantCode})`);
  console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173 (default)'}`);
  console.log('====================================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server gracefully.');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server gracefully.');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

export default server;
