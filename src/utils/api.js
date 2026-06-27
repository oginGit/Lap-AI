/**
 * api.js — Backend API client
 * Connects the React frontend to the Flask backend for real hardware monitoring.
 * Uses Vite proxy — all requests go through relative paths (no hardcoded ports).
 * Also handles authenticated scan history via the auth backend.
 */

// Use environment variables or relative paths fallback
const API_BASE = '';
let baseAuthApi = import.meta.env.VITE_AUTH_API_URL || '/api/auth';
if (baseAuthApi.startsWith('http') && !baseAuthApi.endsWith('/api/auth') && !baseAuthApi.endsWith('/api/auth/')) {
  baseAuthApi = baseAuthApi.replace(/\/$/, '') + '/api/auth';
}
const AUTH_API = baseAuthApi;
const AGENT_API = import.meta.env.VITE_AGENT_URL || 'http://localhost:5050';

/**
 * Get the current auth token
 */
function getAuthToken() {
  return localStorage.getItem('laptopmd_token');
}

/**
 * Generic fetch wrapper with timeout and error handling
 */
async function apiFetch(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — is the backend running?');
    }
    throw err;
  }
}

/**
 * Agent fetch wrapper for local Windows monitoring service
 */
async function agentFetch(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${AGENT_API}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Agent error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — is the local LapGuard Agent running?');
    }
    throw err;
  }
}

/**
 * Authenticated fetch wrapper — includes JWT token
 */
async function authFetch(endpoint, options = {}) {
  const token = getAuthToken();
  return apiFetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Check if backend is reachable
 */
export async function checkBackendHealth() {
  try {
    const data = await agentFetch('/api/health');
    return { online: true, ...data };
  } catch {
    return { online: false };
  }
}

/**
 * Fetch real hardware status from the backend
 * GET /api/hardware/status
 */
export async function fetchHardwareStatus() {
  return agentFetch('/api/hardware/status');
}

/**
 * Send hardware data + user responses for LLM/rule-based analysis
 * POST /api/llm/analyze
 */
export async function sendToLLM(hardware, userResponses) {
  return agentFetch('/api/llm/analyze', {
    method: 'POST',
    body: JSON.stringify({ hardware, userResponses }),
  });
}

/**
 * Get scan history from the authenticated user's database
 * GET /api/auth/history
 */
export async function fetchHistory() {
  try {
    const data = await authFetch(`${AUTH_API}/history`);
    if (data.success && data.history) {
      return data.history;
    }
    return data;
  } catch {
    // Fall back to localStorage if auth backend is down
    const stored = localStorage.getItem('laptop_health_history');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return [];
  }
}

/**
 * Save a scan report to the authenticated user's history
 * POST /api/auth/history/save
 */
export async function saveReport(report) {
  try {
    const data = await authFetch(`${AUTH_API}/history/save`, {
      method: 'POST',
      body: JSON.stringify(report),
    });
    // Also save to localStorage as backup
    _saveToLocalStorage(report);
    return data;
  } catch {
    // Fall back to localStorage
    _saveToLocalStorage(report);
    return report;
  }
}

/**
 * Delete a single scan from history
 * DELETE /api/auth/history/:id
 */
export async function deleteHistoryEntry(id) {
  return authFetch(`${AUTH_API}/history/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Clear all scan history for the authenticated user
 * DELETE /api/auth/history
 */
export async function clearAllHistory() {
  return authFetch(`${AUTH_API}/history`, {
    method: 'DELETE',
  });
}

function _saveToLocalStorage(report) {
  try {
    const stored = localStorage.getItem('laptop_health_history');
    const history = stored ? JSON.parse(stored) : [];
    history.unshift({ id: Date.now().toString(), ...report });
    localStorage.setItem('laptop_health_history', JSON.stringify(history.slice(0, 50)));
  } catch { /* ignore */ }
}
