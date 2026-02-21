import React, { useState, useCallback, useEffect } from 'react';
import SetupScreen from './components/SetupScreen';
import SurveyShell from './components/SurveyShell';
import ReviewScreen from './components/ReviewScreen';
import { parseCameraData, buildSurveyItems } from './utils/cameraData';
import { saveSurveyProgress, loadSurveyProgress, loadCredentials, saveCredentials } from './utils/storage';

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

  // Attempt to restore saved credentials
  const savedCredentials = loadCredentials();

  const handleSetupComplete = useCallback(({ credentials, cameraJson, siteName }) => {
    // Save credentials for next time
    saveCredentials(credentials);

    // Parse camera data
    const parsed = parseCameraData(cameraJson);
    const items = buildSurveyItems(parsed);
    const id = `survey_${Date.now()}`;

    setConfig({ credentials, cameraJson, siteName, parsed });
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
    setScreen(SCREENS.SURVEY);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(null);
    setSurveyItems([]);
    setSurveyId(null);
    setScreen(SCREENS.SETUP);
  }, []);

  // Auto-save progress periodically
  useEffect(() => {
    if (!surveyId || surveyItems.length === 0) return;
    const timer = setTimeout(() => {
      saveSurveyProgress(surveyId, { items: surveyItems, config });
    }, 2000);
    return () => clearTimeout(timer);
  }, [surveyItems, surveyId, config]);

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
        {screen !== SCREENS.SETUP && (
          <div className="app-header__actions">
            {screen === SCREENS.SURVEY && (
              <button className="btn btn--sm btn--secondary" onClick={handleGoToReview}>
                Review & Submit
              </button>
            )}
          </div>
        )}
      </header>

      <div className="app-content">
        {screen === SCREENS.SETUP && (
          <SetupScreen
            savedCredentials={savedCredentials}
            onComplete={handleSetupComplete}
          />
        )}

        {screen === SCREENS.SURVEY && config && (
          <SurveyShell
            config={config}
            surveyItems={surveyItems}
            onUpdateItem={handleUpdateSurveyItem}
            onUpdateCamera={handleUpdateCamera}
            onGoToReview={handleGoToReview}
          />
        )}

        {screen === SCREENS.REVIEW && (
          <ReviewScreen
            config={config}
            surveyItems={surveyItems}
            onBack={handleBackToSurvey}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
