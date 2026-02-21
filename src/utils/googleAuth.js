/**
 * Google Auth utility — Google Identity Services (GIS) token model.
 * Handles sign-in, token management, and sign-out for browser-based OAuth.
 */

const CLIENT_ID = '277420573351-e928i3ea0fbdttcsdoau90mnc45l9fr7.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = null;

/**
 * Load the Google Identity Services script if not already loaded.
 */
function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize the token client. Must be called before signIn().
 */
export async function initGoogleAuth() {
  await loadGisScript();

  return new Promise((resolve) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          resolve({ success: false, error: response.error });
          return;
        }
        accessToken = response.access_token;
        // Token typically expires in 3600 seconds
        tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
        resolve({ success: true, token: accessToken });
      },
    });
    resolve({ success: true, initialized: true });
  });
}

/**
 * Trigger the Google sign-in popup.
 * Returns a promise that resolves with the access token.
 */
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Call initGoogleAuth() first.'));
      return;
    }

    // Override the callback for this specific sign-in request
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      accessToken = response.access_token;
      tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
      resolve(accessToken);
    };

    // If we already have a valid token, return it
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
      resolve(accessToken);
      return;
    }

    // Request a new token (shows popup)
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Get the current access token, or null if not signed in / expired.
 */
export function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }
  return null;
}

/**
 * Check if user is currently signed in with a valid token.
 */
export function isSignedIn() {
  return !!getAccessToken();
}

/**
 * Sign out — revoke the token.
 */
export function signOut() {
  if (accessToken) {
    window.google?.accounts?.oauth2?.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiry = null;
}

/**
 * Get basic user info from the token.
 */
export async function getUserInfo() {
  const token = getAccessToken();
  if (!token) return null;

  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json(); // { sub, name, email, picture, ... }
}
