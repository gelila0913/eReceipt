import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads/licenses');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitized}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, PNG, and WebP documents are accepted.'));
  }
};

export const licenseUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes
  },
});

export function hasValidDocumentSignature(file: Express.Multer.File): boolean {
  const descriptor = fs.openSync(file.path, 'r');
  const header = Buffer.alloc(12);
  try {
    const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
    const content = header.subarray(0, bytesRead);

    switch (file.mimetype) {
      case 'application/pdf':
        return content.subarray(0, 5).toString() === '%PDF-';
      case 'image/jpeg':
        return content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
      case 'image/png':
        return content.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        );
      case 'image/webp':
        return (
          content.subarray(0, 4).toString() === 'RIFF' &&
          content.subarray(8, 12).toString() === 'WEBP'
        );
      default:
        return false;
    }
  } finally {
    fs.closeSync(descriptor);
  }
}
