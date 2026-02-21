import React, { useState, useRef } from 'react';

export default function SetupScreen({ savedCredentials, onComplete }) {
  const [key, setKey] = useState(savedCredentials?.key || '');
  const [secret, setSecret] = useState(savedCredentials?.secret || '');
  const [mapId, setMapId] = useState(savedCredentials?.mapId || '');
  const [siteName, setSiteName] = useState('');
  const [cameraJson, setCameraJson] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (!json.cameras || !Array.isArray(json.cameras)) {
          setError('Invalid camera JSON: missing "cameras" array');
          setCameraJson(null);
          return;
        }
        setCameraJson(json);
        setError('');

        // Auto-fill site name from filename if empty
        if (!siteName) {
          const name = file.name.replace(/\.json$/i, '').replace(/[-_]/g, ' ');
          setSiteName(name);
        }
      } catch {
        setError('Failed to parse JSON file');
        setCameraJson(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (!key || !secret || !mapId) {
      setError('Please fill in all MappedIn credentials');
      return;
    }
    if (!cameraJson) {
      setError('Please upload a camera placement JSON file');
      return;
    }
    if (!siteName.trim()) {
      setError('Please enter a site name');
      return;
    }

    onComplete({
      credentials: { key, secret, mapId },
      cameraJson,
      siteName: siteName.trim(),
    });
  };

  const isReady = key && secret && mapId && cameraJson && siteName.trim();

  return (
    <div className="screen animate-in">
      <h1 className="screen__title">New Site Survey</h1>
      <p className="screen__subtitle">
        Connect your MappedIn map and upload camera placements to begin the survey.
      </p>

      {/* MappedIn Credentials */}
      <div className="card">
        <div className="card__label">MappedIn Credentials</div>

        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            type="text"
            className="form-input"
            placeholder="mik_..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label className="form-label">API Secret</label>
          <input
            type="password"
            className="form-input"
            placeholder="mis_..."
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Map ID</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 698f27a81e81b9000b335622"
            value={mapId}
            onChange={(e) => setMapId(e.target.value)}
          />
        </div>
      </div>

      {/* Site Info */}
      <div className="card">
        <div className="card__label">Site Information</div>

        <div className="form-group">
          <label className="form-label">Site Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Acme Corp HQ - Building A"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />
        </div>
      </div>

      {/* Camera Data Upload */}
      <div className="card">
        <div className="card__label">Camera Placements</div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        {!cameraJson ? (
          <button
            className="btn btn--secondary btn--block"
            onClick={() => fileRef.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Camera JSON
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{fileName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {cameraJson.cameras.length} camera{cameraJson.cameras.length !== 1 ? 's' : ''} found
              </div>
            </div>
            <button
              className="btn btn--sm btn--secondary"
              onClick={() => {
                setCameraJson(null);
                setFileName('');
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger)',
          fontSize: '0.85rem',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        className="btn btn--primary btn--lg btn--block"
        disabled={!isReady}
        onClick={handleSubmit}
      >
        Start Survey
      </button>
    </div>
  );
}
