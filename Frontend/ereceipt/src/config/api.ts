/**
 * Centralized API Base URL configuration.
 *
 * In production or Docker (behind Nginx / Azure App Service / reverse proxy):
 * Defaults to relative '' so all `/api` requests go to the same origin without CORS or mixed-content issues.
 *
 * In local dev:
 * Vite's proxy automatically routes `/api` requests to http://localhost:5000.
 *
 * If a custom VITE_API_BASE_URL is specified (e.g. separate Azure Container App URL), it will be used.
 */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : ''
).replace(/\/+$/, '');

export default API_BASE_URL;
