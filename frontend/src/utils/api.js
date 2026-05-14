/**
 * api.js — Tenant-aware API utility for CafeBill SaaS frontend.
 *
 * Tenant resolution order (mirrors backend middleware):
 *   1. Subdomain in hostname  (mycafe.cafebill.in → "mycafe")
 *   2. localStorage "tenant_id"  (set manually for dev)
 *   3. ?tenant= query param   (dev override)
 *
 * Every request automatically gets:
 *   - X-Tenant-ID header  (so backend resolves the right DB)
 *   - Authorization header (token stored on login)
 */
import axios from "axios";

const RESERVED = new Set(["admin", "www", "api", "app", "landing", "static", "localhost", "cafebilling"]);

/** Derive the current tenant subdomain */
export function getTenantId() {
  // 1. Query param — highest priority (?tenant=mycafe)
  const qp = new URLSearchParams(window.location.search).get("tenant");
  if (qp) return qp;
  // 2. localStorage — persists across page loads (set on login or first visit with ?tenant=)
  const stored = localStorage.getItem("tenant_id");
  if (stored) return stored;
  // 3. Subdomain (production with wildcard DNS: mycafe.domain.in)
  const host  = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3 && !RESERVED.has(parts[0]) && parts[0] !== "localhost") {
    return parts[0];
  }
  return "";
}

/** Auth token stored on login */
export function getToken() {
  return localStorage.getItem("cafe_token") || "";
}

/** Build headers common to every request */
function commonHeaders() {
  const tenantId = getTenantId();
  const token    = getToken();
  return {
    ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
    ...(token    ? { Authorization: token }     : {}),
  };
}

/**
 * Axios instance — use this for all API calls.
 * Interceptors inject tenant + auth headers automatically.
 */
const api = axios.create();

api.interceptors.request.use((config) => {
  const headers = commonHeaders();
  config.headers = { ...config.headers, ...headers };
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("cafe_token");
      localStorage.removeItem("cafe_info");
      localStorage.removeItem("user_role");
      localStorage.removeItem("staff_info");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default api;

/**
 * fetch()-based wrapper for cases that need raw Response (e.g. file streams).
 * Prefer the axios `api` instance for most calls.
 */
export async function apiFetch(path, options = {}) {
  const headers = commonHeaders();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("cafe_token");
    localStorage.removeItem("cafe_info");
    localStorage.removeItem("user_role");
    localStorage.removeItem("staff_info");
    window.location.reload();
    return;
  }
  return res;
}
