/**
 * Centralized API client with automatic 401 session expiry handling.
 *
 * When ANY API call returns 401 Unauthorized, this intercepts and:
 * 1. Clears all auth tokens and session data
 * 2. Dispatches a global event so the UI can redirect to sign-in
 * 3. Rejects the promise with a clear error message
 */

import { API_BASE_URL } from '../config/api';

export const SESSION_EXPIRED_EVENT = 'ereceipt:session_expired';

function clearAuthSession(): void {
  const keys = [
    'ereceipt_token',
    'ereceipt_merchant',
    'merchant_token',
    'merchant_user',
  ];
  keys.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });

  // Clear active view so refresh goes to landing/signin
  sessionStorage.removeItem('ereceipt_active_view');
  sessionStorage.removeItem('ereceipt_active_screen');
}

function getAuthToken(): string | null {
  return (
    localStorage.getItem('ereceipt_token') ||
    localStorage.getItem('merchant_token') ||
    sessionStorage.getItem('ereceipt_token') ||
    null
  );
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Authenticated fetch wrapper with automatic 401 handling.
 * Use this for all API calls instead of raw fetch/axios.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, headers: customHeaders = {}, ...restOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (response.status === 401) {
    clearAuthSession();
    // Notify the app that the session has expired
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRED_EVENT, {
        detail: { message: 'Your session has expired. Please sign in again.' },
      })
    );
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errData = await response.json();
      errorMessage = errData.message || errData.error || errorMessage;
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  // Return null for empty responses (204 No Content)
  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };
