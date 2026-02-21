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

  // Camera data — manual upload
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
  const [cameraFiles, setCameraFiles] = useState([]);
  const [loadingCameraFile, setLoadingCameraFile] = useState(false);
  const [cameraSource, setCameraSource] = useState(''); // 'gdrive' or 'upload'
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

    try {
      // Ensure subfolder structure exists
      const subfolders = await ensureSurveyFolders(folder.id, sharedDrive.id);
      setProjectSubfolders(subfolders);

      // Check for camera placement files
      const files = await listFiles(subfolders.cameraPlacementsFolder, sharedDrive.id);
      const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
      setCameraFiles(jsonFiles);

      // If there's exactly one JSON file, auto-load it
      if (jsonFiles.length === 1) {
        await handleLoadCameraFile(jsonFiles[0]);
      }
    } catch (err) {
      console.error('Project load error:', err);
      setDriveError(err.message);
    }
    setDriveLoading(false);
  };

  const handleLoadCameraFile = async (file) => {
    setLoadingCameraFile(true);
    try {
      const json = await downloadJsonFile(file.id);
      if (!json.cameras || !Array.isArray(json.cameras)) {
        setError('Invalid camera JSON: missing "cameras" array');
        setCameraJson(null);
        setLoadingCameraFile(false);
        return;
      }
      setCameraJson(json);
      setFileName(file.name);
      setCameraSource('gdrive');
      setError('');
    } catch (err) {
      setError('Failed to load camera file: ' + err.message);
    }
    setLoadingCameraFile(false);
  };

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
        setCameraSource('upload');
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
        Connect to Google Drive, select a project, and load camera placements.
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
                  Subfolders created
                </div>
              </div>
              <button
                className="btn btn--sm btn--secondary"
                onClick={() => {
                  setSelectedProject(null);
                  setProjectSubfolders(null);
                  setCameraFiles([]);
                  setCameraJson(null);
                  setFileName('');
                  setCameraSource('');
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
                        ':hover': { background: 'var(--bg-hover)' },
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

      {/* Step 3: MappedIn Credentials */}
      <div className="card">
        <div className="card__label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StepNumber n={3} done={!!(key && secret && mapId)} />
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

      {/* Step 4: Camera Placements */}
      <div className="card">
        <div className="card__label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StepNumber n={4} done={!!cameraJson} />
            Camera Placements
          </span>
        </div>

        {/* Camera files from GDrive */}
        {cameraFiles.length > 0 && !cameraJson && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Found in Google Drive:
            </div>
            {cameraFiles.map((file) => (
              <button
                key={file.id}
                className="btn btn--secondary btn--block"
                style={{ marginBottom: '4px', justifyContent: 'flex-start' }}
                disabled={loadingCameraFile}
                onClick={() => handleLoadCameraFile(file)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {file.name}
              </button>
            ))}
            <div style={{
              textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)',
              margin: '10px 0 4px',
            }}>
              — or upload manually —
            </div>
          </div>
        )}

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
                {cameraSource === 'gdrive' && (
                  <span style={{ color: 'var(--accent)' }}> · from Google Drive</span>
                )}
              </div>
            </div>
            <button
              className="btn btn--sm btn--secondary"
              onClick={() => {
                setCameraJson(null);
                setFileName('');
                setCameraSource('');
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* Site Name (only if not auto-filled from GDrive) */}
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
