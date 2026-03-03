/**
 * api.js — Central API config for the admin web page.
 * Mirrors the role of port.dart in the Flutter app.
 *
 * Usage in any page:
 *   import { BASE_URL, apiFetch } from '../assets/js/api.js';
 */

// ── Base URL ─────────────────────────────────────────────────────────────────
// Set USE_LOCAL to true while developing locally; false for production.
const USE_LOCAL = true;
const LOCAL_URL = 'http://localhost:5001';
const PROD_URL = 'https://hrmbackend-ndzp.onrender.com'; // update when deployed

export const BASE_URL = USE_LOCAL ? LOCAL_URL : PROD_URL;

// ── Token helpers ─────────────────────────────────────────────────────────────
export function getToken() { return localStorage.getItem('admin_token'); }
export function setToken(t) { localStorage.setItem('admin_token', t); }
export function clearToken() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
}
export function isLoggedIn() { return !!getToken(); }

// ── Universal fetch wrapper ───────────────────────────────────────────────────
/**
 * apiFetch(path, options?)
 * Prepends BASE_URL, attaches JWT Bearer token, parses JSON,
 * and throws on non-2xx with a human-readable message.
 *
 * Examples:
 *   const calls  = await apiFetch('/api/calls');
 *   const result = await apiFetch('/api/admin/login', {
 *       method: 'POST',
 *       body: JSON.stringify({ username, password }),
 *   });
 */
export async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
}
