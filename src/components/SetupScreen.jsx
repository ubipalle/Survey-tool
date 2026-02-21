import React, { useState, useRef, useEffect } from 'react';
import {
  findCustomerProjectsDrive,
  listProjectFolders,
  ensureSurveyFolders,
  listFiles,
  downloadJsonFile,
} from '../utils/googleDrive';

export default function SetupScreen({ savedCredentials, onComplete, googleUser, googleReady, onGoogleSignIn }) {
  // MappedIn credentials
  const [key, setKey] = useState(savedCredentials?.key || '');
  const [secret, setSecret] = useState(savedCredentials?.secret || '');
  const [mapId, setMapId] = useState(savedCredentials?.mapId || '');

  // Site info
  const [siteName, setSiteName] = useState('');

  // Camera data
  const [cameraJson, setCameraJson] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef();

  // Google Drive state
  const [signingIn, setSigningIn] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [sharedDrive, setSharedDrive] = useState(null);
  const [projectFolders, setProjectFolders] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectSubfolders, setProjectSubfolders] = useState(null);
  const [cameraFileStatus, setCameraFileStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'not-found' | 'error'
  const [cameraFileError, setCameraFileError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Error
  const [error, setError] = useState('');

  // After Google sign-in, load the shared drive and project folders
  useEffect(() => {
    if (!googleUser) return;
    loadDrive();
  }, [googleUser]);

  const loadDrive = async () => {
    setDriveLoading(true);
    setDriveError('');
    try {
      const drive = await findCustomerProjectsDrive();
      if (!drive) {
        setDriveError('Could not find "Customer projects" shared drive. Make sure you have access.');
        setDriveLoading(false);
        return;
      }
      setSharedDrive(drive);

      const folders = await listProjectFolders(drive.id);
      setProjectFolders(folders);
    } catch (err) {
      console.error('Drive load error:', err);
      setDriveError(err.message);
    }
    setDriveLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setDriveError('');
    try {
      await onGoogleSignIn();
    } catch (err) {
      setDriveError('Sign-in failed: ' + err.message);
    }
    setSigningIn(false);
  };

  const handleSelectProject = async (folder) => {
    setSelectedProject(folder);
    setSiteName(folder.name);
    setDriveLoading(true);
    setDriveError('');
    setCameraJson(null);
    setFileName('');
    setCameraFileStatus('loading');
    setCameraFileError('');

    try {
      // Ensure subfolder structure exists
      const subfolders = await ensureSurveyFolders(folder.id, sharedDrive.id);
      setProjectSubfolders(subfolders);

      // Look for camera placement files
      const files = await listFiles(subfolders.cameraPlacementsFolder, sharedDrive.id);
      const jsonFiles = files.filter((f) => f.name.endsWith('.json'));

      if (jsonFiles.length === 0) {
        setCameraFileStatus('not-found');
      } else {
        // Load the first (or only) JSON file
        const file = jsonFiles[0];
        try {
          const json = await downloadJsonFile(file.id);
          if (!json.cameras || !Array.isArray(json.cameras)) {
            setCameraFileStatus('error');
            setCameraFileError(`"${file.name}" is not a valid camera placement file (missing "cameras" array).`);
          } else {
            setCameraJson(json);
            setFileName(file.name);
            setCameraFileStatus('loaded');

            // If there are multiple files, log it
            if (jsonFiles.length > 1) {
              console.log(`Found ${jsonFiles.length} JSON files in Camera Placements, loaded: ${file.name}`);
            }
          }
        } catch (err) {
          setCameraFileStatus('error');
          setCameraFileError(`Failed to load "${file.name}": ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Project load error:', err);
      setDriveError(err.message);
      setCameraFileStatus('error');
      setCameraFileError(err.message);
    }
    setDriveLoading(false);
  };

  const handleRetryLoadCamera = () => {
    if (selectedProject && sharedDrive) {
      handleSelectProject(selectedProject);
    }
  };

  // Manual file upload — only used when NOT connected to GDrive
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
      gdriveProject: selectedProject
        ? {
            driveId: sharedDrive.id,
            projectFolderId: selectedProject.id,
            projectName: selectedProject.name,
            subfolders: projectSubfolders,
          }
        : null,
    });
  };

  const isReady = key && secret && mapId && cameraJson && siteName.trim();

  // Filter projects by search
  const filteredProjects = searchQuery
    ? projectFolders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projectFolders;

  return (
    <div className="screen animate-in">
      <h1 className="screen__title">New Site Survey</h1>
      <p className="screen__subtitle">
        Connect to Google Drive, select a project, and start surveying.
      </p>

      {/* Step 1: Google Drive Connection */}
      <div className="card">
        <div className="card__label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StepNumber n={1} done={!!googleUser} />
            Google Drive
          </span>
        </div>

        {!googleUser ? (
          <button
            className="btn btn--primary btn--block"
            onClick={handleGoogleSignIn}
            disabled={!googleReady || signingIn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {googleUser.picture && (
              <img
                src={googleUser.picture}
                alt=""
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{googleUser.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{googleUser.email}</div>
            </div>
            <span className="badge badge--success">Connected</span>
          </div>
        )}

        {driveError && (
          <div style={{
            marginTop: '10px', padding: '8px 12px',
            background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)', fontSize: '0.8rem',
          }}>
            {driveError}
          </div>
        )}
      </div>

      {/* Step 2: Select Project */}
      {googleUser && (
        <div className="card animate-in">
          <div className="card__label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <StepNumber n={2} done={!!selectedProject} />
              Customer Project
            </span>
          </div>

          {driveLoading && !selectedProject ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
              <div className="spinner" style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading projects...</span>
            </div>
          ) : selectedProject ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selectedProject.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Subfolders ready
                </div>
              </div>
              <button
                className="btn btn--sm btn--secondary"
                onClick={() => {
                  setSelectedProject(null);
                  setProjectSubfolders(null);
                  setCameraJson(null);
                  setFileName('');
                  setCameraFileStatus('idle');
                  setCameraFileError('');
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Project list */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', margin: '0 -4px' }}>
                {filteredProjects.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '20px',
                    color: 'var(--text-muted)', fontSize: '0.85rem',
                  }}>
                    {projectFolders.length === 0 ? 'No project folders found' : 'No matches'}
                  </div>
                ) : (
                  filteredProjects.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => handleSelectProject(folder)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', margin: '2px 4px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span style={{ fontSize: '0.85rem' }}>{folder.name}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Camera Placements — auto-loaded from GDrive */}
      {selectedProject && (
        <div className="card animate-in">
          <div className="card__label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <StepNumber n={3} done={cameraFileStatus === 'loaded'} />
              Camera Placements
            </span>
          </div>

          {cameraFileStatus === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
              <div className="spinner" style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Looking for camera placements...
              </span>
            </div>
          )}

          {cameraFileStatus === 'loaded' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{fileName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {cameraJson.cameras.length} camera{cameraJson.cameras.length !== 1 ? 's' : ''} loaded from Google Drive
                </div>
              </div>
              <span className="badge badge--success">Ready</span>
            </div>
          )}

          {cameraFileStatus === 'not-found' && (
            <div>
              <div style={{
                padding: '14px 16px',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--warning)' }}>
                    No camera placement file found
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Please ask the presales team to upload a camera placement JSON file to:
                </div>
                <div style={{
                  fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)', marginTop: '6px',
                  padding: '6px 10px', background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  {selectedProject.name}/Camera Placements/
                </div>
              </div>
              <button
                className="btn btn--secondary btn--block"
                onClick={handleRetryLoadCamera}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Check again
              </button>
            </div>
          )}

          {cameraFileStatus === 'error' && (
            <div>
              <div style={{
                padding: '10px 14px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                marginBottom: '12px',
              }}>
                {cameraFileError}
              </div>
              <button
                className="btn btn--secondary btn--block"
                onClick={handleRetryLoadCamera}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 (alt): Manual upload — only when NOT connected to GDrive */}
      {!googleUser && (
        <div className="card">
          <div className="card__label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <StepNumber n={2} done={!!cameraJson} />
              Camera Placements
            </span>
          </div>

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
      )}

      {/* Step 4 (or 3 without GDrive): MappedIn Credentials */}
      <div className="card">
        <div className="card__label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StepNumber n={googleUser ? 4 : 3} done={!!(key && secret && mapId)} />
            MappedIn Credentials
          </span>
        </div>

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

      {/* Site Name — only when NOT using GDrive */}
      {!selectedProject && (
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
      )}

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

/** Small numbered step indicator */
function StepNumber({ n, done }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: '50%',
      fontSize: '0.7rem', fontWeight: 700,
      background: done ? 'var(--success)' : 'var(--bg-input)',
      color: done ? '#fff' : 'var(--text-muted)',
      border: done ? 'none' : '1.5px solid var(--border)',
      transition: 'all 0.2s',
    }}>
      {done ? '✓' : n}
    </span>
  );
}
