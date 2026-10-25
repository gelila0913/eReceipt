/**
 * Centralized API Base URL configuration.
 *
 * In production or Docker (behind Nginx / Azure App Service / reverse proxy):
 * Defaults to relative '' so all `/api` requests go to the same origin without CORS or mixed-content issues.
 *
 * In local dev:
 * Vite's proxy automatically routes `/api` requests to http://localhost:5000.
 */

const LIVE_AZURE_BACKEND = 'https://backend.salmonwater-89ba5a67.southafricanorth.azurecontainerapps.io';

const isNativeMobileApp =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
   window.location.protocol === 'file:' ||
   Boolean((window as any).Capacitor?.isNativePlatform?.()));

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : (isNativeMobileApp ? LIVE_AZURE_BACKEND : '')
).replace(/\/+$/, '');

export default API_BASE_URL;
