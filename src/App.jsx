import React, { useState, useCallback, useEffect } from 'react';
import SetupScreen from './components/SetupScreen';
import AuthScreen from './components/AuthScreen';
import SurveyShell from './components/SurveyShell';
import ReviewScreen from './components/ReviewScreen';
import { parseCameraData, buildSurveyItems } from './utils/cameraData';
import { saveSurveyProgress, loadSurveyProgress, loadCredentials, saveCredentials } from './utils/storage';
import { initGoogleAuth, signIn, signOut, isSignedIn, getUserInfo } from './utils/googleAuth';
import {
  loadToken, clearToken, parseToken, hasToken,
  getProjectConfig, getCameraData, saveSurveyData, uploadPhoto,
} from './utils/surveyApi';

const SCREENS = {
  AUTH: 'auth',
  LOADING: 'loading',
  SETUP: 'setup',
  SURVEY: 'survey',
  REVIEW: 'review',
};

/**
 * Extract project code from URL.
 * Supports: /s/PRJ-001, /?project=PRJ-001, and hash routing /#/s/PRJ-001
 */
function getProjectCodeFromURL() {
  // Path-based: /s/PRJ-001
  const pathMatch = window.location.pathname.match(/\/s\/([A-Za-z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  // Query param: ?project=PRJ-001
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('project');
  if (fromQuery) return fromQuery;

  // Hash-based: /#/s/PRJ-001
  const hashMatch = window.location.hash.match(/\/s\/([A-Za-z0-9_-]+)/);
  if (hashMatch) return hashMatch[1];

  return null;
}

export default function App() {
  // URL-based project code (link-based flow)
  const [projectCode] = useState(() => getProjectCodeFromURL());
  const [isLinkFlow] = useState(() => !!getProjectCodeFromURL());

  // Screen state
  const [screen, setScreen] = useState(() => {
    if (projectCode) {
      // Check for existing valid token
      const payload = parseToken();
      if (payload && payload.projectCode === projectCode) {
        return SCREENS.LOADING; // Token exists, load project
      }
      return SCREENS.AUTH; // Need to authenticate
    }
    return SCREENS.SETUP; // Classic flow
  });

  const [config, setConfig] = useState(null);
  const [surveyItems, setSurveyItems] = useState([]);
  const [surveyId, setSurveyId] = useState(null);
  const [jumpToRoomId, setJumpToRoomId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [loadError, setLoadError] = useState('');

  // Auth state
  const [userEmail, setUserEmail] = useState(() => {
    const payload = parseToken();
    return payload?.email || null;
  });

  // Google auth state (classic flow only)
  const [googleUser, setGoogleUser] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);

  // Online/offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Attempt to restore saved credentials (classic flow)
  const savedCredentials = loadCredentials();

  // Initialize Google Auth on mount (classic flow only)
  useEffect(() => {
    if (!isLinkFlow) {
      initGoogleAuth().then(() => setGoogleReady(true));
    }
  }, [isLinkFlow]);

  // Auto-load project if we have a valid token (link flow)
  useEffect(() => {
    if (screen === SCREENS.LOADING && projectCode) {
      loadProjectFromAPI(projectCode);
    }
  }, [screen, projectCode]);

  /**
   * Load project config + cameras from the survey API.
   */
  const loadProjectFromAPI = async (code) => {
    setLoadError('');
    try {
      // Fetch project config
      const projectConfig = await getProjectConfig(code);

      // Fetch camera data
      const cameraJson = await getCameraData(code);

      // Parse camera data
      const parsed = parseCameraData(cameraJson);
      const items = buildSurveyItems(parsed);
      const id = `survey_${code}_${Date.now()}`;

      // Build MappedIn credentials from project config
      const credentials = {
        key: projectConfig.mappedInKey || '',
        secret: projectConfig.mappedInSecret || '',
        mapId: projectConfig.mapId,
      };

      setConfig({
        credentials,
        cameraJson,
        siteName: projectConfig.siteName,
        parsed,
        projectCode: code,
        isLinkFlow: true,
      });
      setSurveyItems(items);
      setSurveyId(id);
      setScreen(SCREENS.SURVEY);
    } catch (err) {
      console.error('Failed to load project:', err);
      if (err.message.includes('expired') || err.message.includes('Invalid session')) {
        clearToken();
        setScreen(SCREENS.AUTH);
      } else {
        setLoadError(err.message);
      }
    }
  };

  /**
   * Handle successful OTP authentication (link flow).
   */
  const handleAuthenticated = useCallback(({ email, token }) => {
    setUserEmail(email);
    setScreen(SCREENS.LOADING);
  }, []);

  /**
   * Handle Google sign-in (classic flow).
   */
  const handleGoogleSignIn = useCallback(async () => {
    try {
      await signIn();
      const user = await getUserInfo();
      setGoogleUser(user);
      return true;
    } catch (err) {
      console.error('Google sign-in failed:', err);
      return false;
    }
  }, []);

  const handleGoogleSignOut = useCallback(() => {
    signOut();
    setGoogleUser(null);
  }, []);

  /**
   * Handle classic setup completion.
   */
  const handleSetupComplete = useCallback(({ credentials, cameraJson, siteName, gdriveProject }) => {
    saveCredentials(credentials);
    const parsed = parseCameraData(cameraJson);
    const items = buildSurveyItems(parsed);
    const id = `survey_${Date.now()}`;

    setConfig({ credentials, cameraJson, siteName, parsed, gdriveProject });
    setSurveyItems(items);
    setSurveyId(id);
    setScreen(SCREENS.SURVEY);
  }, []);

  const handleUpdateSurveyItem = useCallback((itemId, updates) => {
    setSurveyItems((prev) =>
      prev.map((item) => item.id === itemId ? { ...item, ...updates } : item)
    );
  }, []);

  const handleUpdateCamera = useCallback((itemId, cameraId, cameraUpdates) => {
    setSurveyItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          cameras: item.cameras.map((cam) =>
            cam.id === cameraId ? { ...cam, ...cameraUpdates } : cam
          ),
        };
      })
    );
  }, []);

  const handleGoToReview = useCallback(() => setScreen(SCREENS.REVIEW), []);
  const handleBackToSurvey = useCallback(() => {
    setJumpToRoomId(null);
    setScreen(SCREENS.SURVEY);
  }, []);
  const handleGoToRoom = useCallback((roomId) => {
    setJumpToRoomId(roomId);
    setScreen(SCREENS.SURVEY);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(null);
    setSurveyItems([]);
    setSurveyId(null);
    setJumpToRoomId(null);
    if (isLinkFlow) {
      clearToken();
      setUserEmail(null);
      setScreen(SCREENS.AUTH);
    } else {
      setScreen(SCREENS.SETUP);
    }
  }, [isLinkFlow]);

  const handleSignOut = useCallback(() => {
    if (isLinkFlow) {
      clearToken();
      setUserEmail(null);
      setConfig(null);
      setSurveyItems([]);
      setScreen(SCREENS.AUTH);
    } else {
      handleGoogleSignOut();
    }
  }, [isLinkFlow, handleGoogleSignOut]);

  // Auto-save progress
  useEffect(() => {
    if (!surveyId || surveyItems.length === 0) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      await saveSurveyProgress(surveyId, { items: surveyItems, config });
      setSaveStatus(isOnline ? 'saved' : 'offline');
    }, 2000);
    return () => clearTimeout(timer);
  }, [surveyItems, surveyId, config, isOnline]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Site Survey
        </div>
        {config && (
          <span className="app-header__breadcrumb">{config.siteName}</span>
        )}
        <div className="app-header__actions">
          {/* Save/Offline status indicator */}
          {(screen === SCREENS.SURVEY || screen === SCREENS.REVIEW) && (
            <div className={`status-indicator ${!isOnline ? 'status-indicator--offline' : ''}`}
              title={
                !isOnline ? 'Offline — data saved locally'
                : saveStatus === 'saving' ? 'Saving...'
                : 'All changes saved'
              }
            >
              {!isOnline ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                    <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" />
                  </svg>
                  <span>Offline</span>
                </>
              ) : saveStatus === 'saving' ? (
                <>
                  <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                  <span>Saving</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Saved</span>
                </>
              )}
            </div>
          )}

          {screen === SCREENS.SURVEY && (
            <button className="btn btn--sm btn--secondary" onClick={handleGoToReview}>
              Review & Submit
            </button>
          )}

          {/* User info — link flow */}
          {isLinkFlow && userEmail && screen !== SCREENS.AUTH && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '0.75rem', color: 'var(--text-muted)',
            }}>
              <span>{userEmail}</span>
              <button
                className="btn btn--sm btn--secondary"
                onClick={handleSignOut}
                style={{ fontSize: '0.7rem', padding: '4px 8px' }}
              >
                Sign out
              </button>
            </div>
          )}

          {/* User info — classic flow */}
          {!isLinkFlow && googleUser && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '0.75rem', color: 'var(--text-muted)',
            }}>
              {googleUser.picture && (
                <img
                  src={googleUser.picture}
                  alt=""
                  style={{ width: 24, height: 24, borderRadius: '50%' }}
                />
              )}
              <button
                className="btn btn--sm btn--secondary"
                onClick={handleGoogleSignOut}
                style={{ fontSize: '0.7rem', padding: '4px 8px' }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="app-content">
        {/* Auth screen — link flow */}
        {screen === SCREENS.AUTH && projectCode && (
          <AuthScreen
            projectCode={projectCode}
            onAuthenticated={handleAuthenticated}
          />
        )}

        {/* Loading screen — link flow */}
        {screen === SCREENS.LOADING && (
          <div className="screen animate-in" style={{ textAlign: 'center', paddingTop: 80 }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Loading project...
            </p>
            {loadError && (
              <div style={{
                maxWidth: 400, margin: '24px auto',
                padding: '14px 18px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
              }}>
                <p style={{ marginBottom: 12 }}>{loadError}</p>
                <button
                  className="btn btn--sm btn--primary"
                  onClick={() => {
                    setLoadError('');
                    loadProjectFromAPI(projectCode);
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Setup screen — classic flow */}
        {screen === SCREENS.SETUP && (
          <SetupScreen
            savedCredentials={savedCredentials}
            onComplete={handleSetupComplete}
            googleUser={googleUser}
            googleReady={googleReady}
            onGoogleSignIn={handleGoogleSignIn}
          />
        )}

        {/* Survey */}
        {screen === SCREENS.SURVEY && config && (
          <SurveyShell
            config={config}
            surveyItems={surveyItems}
            onUpdateItem={handleUpdateSurveyItem}
            onUpdateCamera={handleUpdateCamera}
            onGoToReview={handleGoToReview}
            jumpToRoomId={jumpToRoomId}
            onJumpHandled={() => setJumpToRoomId(null)}
          />
        )}

        {/* Review */}
        {screen === SCREENS.REVIEW && (
          <ReviewScreen
            config={config}
            surveyItems={surveyItems}
            onBack={handleBackToSurvey}
            onGoToRoom={handleGoToRoom}
            onReset={handleReset}
            isOnline={isOnline}
          />
        )}
      </div>
    </div>
  );
}
