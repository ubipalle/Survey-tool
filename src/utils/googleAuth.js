/**
 * Google Auth utility — Google Identity Services (GIS) token model.
 * Handles sign-in, token management, and sign-out for browser-based OAuth.
 */

const CLIENT_ID = '277420573351-e928i3ea0fbdttcsdoau90mnc45l9fr7.apps.googleusercontent.com';
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

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

  // Just create the client — callback will be set per signIn() call
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {}, // placeholder, overridden by signIn()
  });

  return { success: true };
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

    // If we already have a valid token, return it
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
      resolve(accessToken);
      return;
    }

    // Set the callback for this sign-in request
    tokenClient.callback = (response) => {
      if (response.error) {
        console.error('Google OAuth error:', response);
        reject(new Error(response.error_description || response.error));
        return;
      }
      accessToken = response.access_token;
      tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
      console.log('Google sign-in successful, token received');
      resolve(accessToken);
    };

    // Request a new token (shows popup)
    tokenClient.requestAccessToken({ prompt: 'consent' });
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
    try {
      window.google?.accounts?.oauth2?.revoke(accessToken);
    } catch (e) {
      console.warn('Token revoke failed:', e);
    }
  }
  accessToken = null;
  tokenExpiry = null;
}

/**
 * Get basic user info from the token.
 */
export async function getUserInfo() {
  const token = getAccessToken();
  if (!token) {
    console.warn('getUserInfo called without valid token');
    return null;
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error('getUserInfo failed:', res.status);
      return null;
    }

    const data = await res.json();
    console.log('User info retrieved:', data.email);
    return data; // { sub, name, email, picture, ... }
  } catch (err) {
    console.error('getUserInfo error:', err);
    return null;
  }
}
