import React, { useState, useCallback, useEffect } from 'react';
import SetupScreen from './components/SetupScreen';
import SurveyShell from './components/SurveyShell';
import ReviewScreen from './components/ReviewScreen';
import { parseCameraData, buildSurveyItems } from './utils/cameraData';
import { saveSurveyProgress, loadSurveyProgress, loadCredentials, saveCredentials } from './utils/storage';
import { initGoogleAuth, signIn, signOut, isSignedIn, getUserInfo } from './utils/googleAuth';

const SCREENS = {
  SETUP: 'setup',
  SURVEY: 'survey',
  REVIEW: 'review',
};

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SETUP);
  const [config, setConfig] = useState(null);
  const [surveyItems, setSurveyItems] = useState([]);
  const [surveyId, setSurveyId] = useState(null);
  const [jumpToRoomId, setJumpToRoomId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'offline'

  // Google auth state
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

  // Attempt to restore saved credentials
  const savedCredentials = loadCredentials();

  // Initialize Google Auth on mount
  useEffect(() => {
    initGoogleAuth().then(() => setGoogleReady(true));
  }, []);

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

  const handleSetupComplete = useCallback(({ credentials, cameraJson, siteName, gdriveProject }) => {
    // Save credentials for next time
    saveCredentials(credentials);

    // Parse camera data
    const parsed = parseCameraData(cameraJson);
    const items = buildSurveyItems(parsed);
    const id = `survey_${Date.now()}`;

    setConfig({ credentials, cameraJson, siteName, parsed, gdriveProject });
    setSurveyItems(items);
    setSurveyId(id);
    setScreen(SCREENS.SURVEY);
  }, []);

  const handleUpdateSurveyItem = useCallback((itemId, updates) => {
    setSurveyItems((prev) => {
      const next = prev.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      return next;
    });
  }, []);

  const handleUpdateCamera = useCallback((itemId, cameraId, cameraUpdates) => {
    setSurveyItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          cameras: item.cameras.map((cam) =>
            cam.id === cameraId ? { ...cam, ...cameraUpdates } : cam
          ),
        };
      });
      return next;
    });
  }, []);

  const handleGoToReview = useCallback(() => {
    setScreen(SCREENS.REVIEW);
  }, []);

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
    setScreen(SCREENS.SETUP);
  }, []);

  // Auto-save progress periodically (now async with IndexedDB)
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
          {screen !== SCREENS.SETUP && (
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
          {googleUser && (
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
        {screen === SCREENS.SETUP && (
          <SetupScreen
            savedCredentials={savedCredentials}
            onComplete={handleSetupComplete}
            googleUser={googleUser}
            googleReady={googleReady}
            onGoogleSignIn={handleGoogleSignIn}
          />
        )}

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
