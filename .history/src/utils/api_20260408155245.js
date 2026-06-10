/**
 * api.js — Backend API client
 * Connects the React frontend to the Flask backend for real hardware monitoring.
 * Falls back to mock data if the backend is unreachable.
 */

const API_BASE = 'http://localhost:5050';

/**
 * Generic fetch wrapper with timeout and error handling
 */
async function apiFetch(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 10s timeout

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

    let errorText;
try {
  const errorData = await res.json();
  errorText = errorData.error || JSON.stringify(errorData);
} catch {
  errorText = await res.text();
}
throw new Error(errorText || `API error: ${res.status}`);
    
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — is the backend running?');
    }
    throw err;
  }
}

/**
 * Check if backend is reachable
 */
export async function checkBackendHealth() {
  try {
    const data = await apiFetch('/api/health');
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
  return apiFetch('/api/hardware/status');
}

/**
 * Send hardware data + user responses for LLM/rule-based analysis
 * POST /api/llm/analyze
 */
export async function sendToLLM(hardware, userResponses) {
  return apiFetch('/api/llm/analyze', {
    method: 'POST',
    body: JSON.stringify({ hardware, userResponses }),
  });
}

/**
 * Get scan history
 * GET /api/reports/history
 */
export async function fetchHistory() {
  try {
    const data = await apiFetch('/api/reports/history');
    return data;
  } catch {
    // Fall back to localStorage
    const stored = localStorage.getItem('laptop_health_history');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return [];
  }
}

/**
 * Save a report to history
 * POST /api/reports/save
 */
export async function saveReport(report) {
  try {
    const data = await apiFetch('/api/reports/save', {
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

function _saveToLocalStorage(report) {
  try {
    const stored = localStorage.getItem('laptop_health_history');
    const history = stored ? JSON.parse(stored) : [];
    history.unshift({ id: Date.now().toString(), ...report });
    localStorage.setItem('laptop_health_history', JSON.stringify(history.slice(0, 50)));
  } catch { /* ignore */ }
}
