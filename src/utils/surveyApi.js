/**
 * Survey API client — replaces Google Auth + Google Drive for authenticated users.
 * Communicates with the survey-api Cloud Function backend.
 */

const API_BASE = import.meta.env.VITE_SURVEY_API_URL || 'https://survey-api-y32frbh4nq-ew.a.run.app';

let authToken = null;

/**
 * Set the JWT auth token (after OTP verification).
 */
export function setToken(token) {
  authToken = token;
  sessionStorage.setItem('survey_token', token);
}

/**
 * Load token from sessionStorage (survives page refreshes).
 */
export function loadToken() {
  if (!authToken) {
    authToken = sessionStorage.getItem('survey_token');
  }
  return authToken;
}

/**
 * Clear the auth token (sign out).
 */
export function clearToken() {
  authToken = null;
  sessionStorage.removeItem('survey_token');
}

/**
 * Check if we have a valid token.
 */
export function hasToken() {
  return !!loadToken();
}

/**
 * Parse the JWT to extract payload (without verification — server verified it).
 */
export function parseToken(token) {
  try {
    const t = token || loadToken();
    if (!t) return null;
    const payload = JSON.parse(atob(t.split('.')[1]));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Make an authenticated API request.
 */
async function apiRequest(path, options = {}) {
  const token = loadToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── AUTH ─────────────────────────────────────────

/**
 * Request an OTP code for the given email + project.
 */
export async function requestOTP(email, projectCode) {
  return apiRequest('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email, projectCode }),
  });
}

/**
 * Verify an OTP code. Returns { token, email }.
 */
export async function verifyOTP(email, otp, projectCode) {
  const result = await apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp, projectCode }),
  });
  if (result.token) {
    setToken(result.token);
  }
  return result;
}

// ─── PROJECT DATA ─────────────────────────────────

/**
 * Fetch project config (siteName, mapId, etc.).
 */
export async function getProjectConfig(projectCode) {
  return apiRequest(`/project/${projectCode}`);
}

/**
 * Fetch camera placement data for a project.
 */
export async function getCameraData(projectCode) {
  return apiRequest(`/project/${projectCode}/cameras`);
}

// ─── SURVEY DATA ──────────────────────────────────

/**
 * Save survey data to the backend (which stores it in GDrive).
 */
export async function saveSurveyData(projectCode, surveyData) {
  return apiRequest(`/project/${projectCode}/survey`, {
    method: 'POST',
    body: JSON.stringify(surveyData),
  });
}

/**
 * Save updated/final camera placements to GDrive "Final Placements" folder.
 */
export async function saveFinalPlacements(projectCode, placementsJson) {
  return apiRequest(`/project/${projectCode}/placements`, {
    method: 'POST',
    body: JSON.stringify(placementsJson),
  });
}

/**
 * Upload a survey photo.
 * Takes a base64 data URL and converts it for the API.
 */
export async function uploadPhoto(projectCode, dataUrl, filename) {
  // Extract base64 data from data URL
  const [header, base64Data] = dataUrl.split(',');
  const contentType = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';

  return apiRequest(`/project/${projectCode}/photos`, {
    method: 'POST',
    body: JSON.stringify({
      photo: base64Data,
      filename,
      contentType,
    }),
  });
}
