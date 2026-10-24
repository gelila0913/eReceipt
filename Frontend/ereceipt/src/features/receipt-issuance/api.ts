import type { ReceiptDraft, IssuedReceipt, CartItem } from './types';
import { API_BASE_URL as ROOT_API_BASE_URL } from '../../config/api';

const API_BASE_URL = `${ROOT_API_BASE_URL}/api`.replace(/\/+api\/api$/, '/api');

export interface BackendHealthResponse {
  status: string;
  service: string;
  version: string;
  mode?: string;
  merchantCode?: string;
  branchCode?: string;
  registerCode?: string;
  timestamp: string;
  network?: {
    lanIp: string;
    preferredHost: string;
    frontendMobileUrl: string;
  };
}

export interface TinVerifyResult {
  valid: boolean;
  tin: string;
  message: string;
  taxpayer?: {
    tin: string;
    tradeName: string;
    vatNumber: string;
    registrationStatus: string;
    designatedWithholdingAgent: boolean;
    taxCenter: string;
    verifiedAt: string;
  };
}

/**
 * Check if the eReceipt MoR EIMS Backend is online
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Retrieves the preferred scannable host URL for mobile devices (using detected LAN IP)
 */
export async function getScannableHostUrl(): Promise<string> {
  // If the page is already accessed via an IP address (not localhost), use that
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  try {
    const health = await checkBackendHealth();
    if (health?.network?.frontendMobileUrl) {
      return health.network.frontendMobileUrl;
    }
  } catch {
    // fallback to current origin
  }
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
}

/**
 * Verify a 10-digit Ethiopian TIN with the backend registry
 */
export async function verifyTinApi(tin: string): Promise<TinVerifyResult> {
  const res = await fetch(`${API_BASE_URL}/tin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tin }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `TIN verification failed (HTTP ${res.status})`);
  }

  return await res.json();
}

/**
 * Submit draft receipt to Backend for official MoR EIMS fiscal clearance with idempotency
 */
export async function issueReceiptApi(
  draft: ReceiptDraft,
  idempotencyKey?: string
): Promise<IssuedReceipt> {
  const token =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('ereceipt_token') ||
        localStorage.getItem('merchant_token') ||
        sessionStorage.getItem('ereceipt_token'))) ||
    null;

  const key =
    idempotencyKey ||
    (draft as any).idempotencyKey ||
    `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': key,
    'X-Idempotency-Key': key,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/receipts/issue`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ ...draft, idempotencyKey: key }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData.details?.join(' ') ||
      errorData.error ||
      `Fiscal clearance failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  const data = await res.json();
  return data.receipt;
}

/**
 * Fetch latest products catalog from backend
 */
export async function fetchProductsApi(): Promise<CartItem[]> {
  const res = await fetch(`${API_BASE_URL}/products`);
  if (!res.ok) throw new Error('Failed to fetch products');
  const data = await res.json();
  return data.products;
}
