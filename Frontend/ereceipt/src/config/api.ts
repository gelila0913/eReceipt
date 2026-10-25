/**
 * Centralized API Base URL configuration.
 *
 * In production or Docker (behind Nginx / Azure App Service / reverse proxy):
 * Defaults to relative '' so all `/api` requests go to the same origin without CORS or mixed-content issues.
 *
 * In local dev:
 * Vite's proxy automatically routes `/api` requests to http://localhost:5000.
 */

export const LIVE_AZURE_BACKEND =
  'https://backend.salmonwater-89ba5a67.southafricanorth.azurecontainerapps.io';

export const API_BASE_URL: string = (() => {
  // 1. Explicit Vite environment variable override
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 2. Local Vite development server on port 5173
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '5173'
  ) {
    return '';
  }

  // 3. Everywhere else (Azure production web container, Capacitor Android mobile APK):
  // ALWAYS communicate directly with the official live Azure backend!
  return LIVE_AZURE_BACKEND;
})().replace(/\/+$/, '');

export default API_BASE_URL;
