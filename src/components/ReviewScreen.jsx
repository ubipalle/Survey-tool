import React, { useState } from 'react';
import { exportSurveyPayload, queuePendingUpload } from '../utils/storage';
import { uploadJsonFile, uploadPhoto as uploadPhotoGDrive } from '../utils/googleDrive';
import { isSignedIn } from '../utils/googleAuth';
import {
  saveSurveyData as saveSurveyDataApi,
  saveFinalPlacements as saveFinalPlacementsApi,
  uploadPhoto as uploadPhotoApi,
  hasToken,
} from '../utils/surveyApi';

/**
 * Calculate approximate distance between two lat/lng points in meters.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build the updated camera placements JSON.
 */
function buildUpdatedPlacements(originalCameraJson, surveyItems) {
  if (!originalCameraJson?.cameras) return null;

  const cameraUpdates = {};
  for (const item of surveyItems) {
    for (const cam of item.cameras) {
      if (cam.repositioned) {
        cameraUpdates[cam.id] = cam;
      }
    }
  }

  const updatedCameras = originalCameraJson.cameras.map((cam) => {
    const update = cameraUpdates[cam.id];
    if (!update) return { ...cam };
    return {
      ...cam,
      latitude: update.newLatitude,
      longitude: update.newLongitude,
    };
  });

  return { ...originalCameraJson, cameras: updatedCameras };
}

/**
 * Build the camera changes array.
 */
function buildCameraChanges(originalCameraJson, surveyItems) {
  if (!originalCameraJson?.cameras) return [];

  const originalMap = {};
  for (const cam of originalCameraJson.cameras) {
    originalMap[cam.id] = cam;
  }

  const changes = [];
  for (const item of surveyItems) {
    for (const cam of item.cameras) {
      if (cam.repositioned) {
        const orig = originalMap[cam.id];
        const distance = orig
          ? haversineDistance(orig.latitude, orig.longitude, cam.newLatitude, cam.newLongitude)
          : null;

        changes.push({
          id: cam.id,
          name: cam.name || cam.id,
          room: item.roomName,
          reason: cam.repositionReason || null,
          original: orig
            ? { latitude: orig.latitude, longitude: orig.longitude }
            : null,
          new: { latitude: cam.newLatitude, longitude: cam.newLongitude },
          distanceMeters: distance !== null ? Math.round(distance * 10) / 10 : null,
        });
      }
    }
  }

  return changes;
}

export default function ReviewScreen({ config, surveyItems, onBack, onGoToRoom, onReset, isOnline }) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [queued, setQueued] = useState(false);

  const completed = surveyItems.filter((i) => i.survey.completed).length;
  const total = surveyItems.length;
  const totalPhotos = surveyItems.reduce((s, i) => s + i.survey.photos.length, 0);
  const repositioned = surveyItems.reduce(
    (s, i) => s + i.cameras.filter((c) => c.repositioned).length,
    0
  );
  const totalCameras = surveyItems.reduce((s, i) => s + i.cameras.length, 0);
  const incompleteItems = surveyItems.filter((i) => !i.survey.completed);

  // Determine which upload flow to use
  const isLinkFlow = !!config.isLinkFlow;
  const hasGdrive = !!config.gdriveProject;
  const signedIn = isSignedIn();
  const hasApiToken = hasToken();

  // Can upload if: link flow with token, or classic flow with GDrive + signed in
  const canUpload = (isLinkFlow && hasApiToken) || (!isLinkFlow && hasGdrive && signedIn);

  const cameraChanges = buildCameraChanges(config.cameraJson, surveyItems);

  const buildPayload = () => {
    return {
      ...exportSurveyPayload(surveyItems, {
        surveyId: `survey_${Date.now()}`,
        mapId: config.credentials.mapId,
        siteName: config.siteName,
      }),
      cameraChanges: {
        totalCameras,
        repositioned,
        unchanged: totalCameras - repositioned,
        changes: cameraChanges,
      },
    };
  };

  const handleExportJSON = () => {
    const payload = buildPayload();

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-survey_${config.siteName.replace(/\s+/g, '-').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  const handleQueueUpload = async () => {
    const payload = buildPayload();
    const success = await queuePendingUpload({
      payload,
      surveyItems,
      config: {
        siteName: config.siteName,
        gdriveProject: config.gdriveProject,
        cameraJson: config.cameraJson,
        credentials: { mapId: config.credentials.mapId },
      },
      repositioned,
      totalPhotos,
    });
    if (success) {
      setQueued(true);
    }
  };

  /**
   * Upload via survey API (link flow) — uses backend proxy to GDrive.
   */
  const handleUploadViaApi = async () => {
    setUploading(true);
    setUploadError('');
    setUploadProgress('Preparing survey data...');

    try {
      const projectCode = config.projectCode;
      const dateStr = new Date().toISOString().slice(0, 10);

      // 1. Build photo filename map (so we can reference them in the JSON)
      const photoFilenames = [];
      for (const item of surveyItems) {
        for (let i = 0; i < item.survey.photos.length; i++) {
          const photo = item.survey.photos[i];
          const roomSlug = item.roomName.replace(/\s+/g, '-').toLowerCase();
          const filename = `${dateStr}_${roomSlug}_${photo.label || 'photo'}_${i + 1}.jpg`;
          photoFilenames.push({ roomId: item.id, photoIndex: i, filename });
        }
      }

      // 2. Upload survey JSON (with photo filenames instead of base64 data)
      setUploadProgress('Uploading survey data...');
      const payload = buildPayload();
      // Replace photo data URLs with filenames
      let filenameIdx = 0;
      for (const room of payload.rooms) {
        room.survey.photos = room.survey.photos.map((p) => {
          const entry = photoFilenames[filenameIdx++];
          return {
            label: p.label,
            timestamp: p.timestamp,
            filename: entry?.filename || null,
          };
        });
      }
      await saveSurveyDataApi(projectCode, payload);

      // 3. Upload final camera placements (if any cameras moved)
      if (repositioned > 0) {
        setUploadProgress('Uploading final camera placements...');
        const updatedPlacements = buildUpdatedPlacements(config.cameraJson, surveyItems);
        if (updatedPlacements) {
          await saveFinalPlacementsApi(projectCode, updatedPlacements);
        }
      }

      // 4. Upload photos
      let photoCount = 0;
      for (const item of surveyItems) {
        for (let i = 0; i < item.survey.photos.length; i++) {
          const photo = item.survey.photos[i];
          photoCount++;
          setUploadProgress(`Uploading photo ${photoCount} of ${totalPhotos}...`);

          const roomSlug = item.roomName.replace(/\s+/g, '-').toLowerCase();
          const photoFilename = `${dateStr}_${roomSlug}_${photo.label || 'photo'}_${i + 1}.jpg`;

          await uploadPhotoApi(projectCode, photo.dataUrl, photoFilename);
        }
      }

      setUploadProgress('');
      setUploaded(true);
    } catch (err) {
      console.error('API upload error:', err);
      setUploadError(err.message);
      setUploadProgress('');
    }
    setUploading(false);
  };

  /**
   * Upload via Google Drive directly (classic flow).
   * Updated placements now go to "Final Placements" folder.
   */
  const handleUploadToGDrive = async () => {
    if (!hasGdrive || !signedIn) return;

    setUploading(true);
    setUploadError('');
    setUploadProgress('Preparing survey data...');

    try {
      const { subfolders } = config.gdriveProject;
      const dateStr = new Date().toISOString().slice(0, 10);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // 1. Upload survey JSON (strip photo base64 data, keep filenames)
      setUploadProgress('Uploading survey data...');
      const payload = buildPayload();
      let photoIdx = 0;
      for (const room of payload.rooms) {
        room.survey.photos = room.survey.photos.map((p, i) => {
          const roomSlug = room.roomName.replace(/\s+/g, '-').toLowerCase();
          const filename = `${dateStr}_${roomSlug}_${p.label || 'photo'}_${i + 1}.jpg`;
          return {
            label: p.label,
            timestamp: p.timestamp,
            filename,
          };
        });
      }
      const jsonFilename = `survey_${dateStr}_${timestamp}.json`;
      await uploadJsonFile(jsonFilename, payload, subfolders.surveys);

      // 2. Upload updated camera placements to Final Placements
      if (repositioned > 0) {
        setUploadProgress('Uploading final camera placements...');
        const updatedPlacements = buildUpdatedPlacements(config.cameraJson, surveyItems);
        if (updatedPlacements) {
          const placementsFilename = `camera-placements-final_${dateStr}.json`;
          await uploadJsonFile(
            placementsFilename,
            updatedPlacements,
            subfolders.finalPlacements
          );
        }
      }

      // 3. Upload photos
      let photoCount = 0;
      for (const item of surveyItems) {
        for (let i = 0; i < item.survey.photos.length; i++) {
          const photo = item.survey.photos[i];
          photoCount++;
          setUploadProgress(`Uploading photo ${photoCount} of ${totalPhotos}...`);

          const roomSlug = item.roomName.replace(/\s+/g, '-').toLowerCase();
          const photoFilename = `${dateStr}_${roomSlug}_${photo.label || 'photo'}_${i + 1}.jpg`;

          await uploadPhotoGDrive(photoFilename, photo.dataUrl, subfolders.photos);
        }
      }

      setUploadProgress('');
      setUploaded(true);
    } catch (err) {
      console.error('GDrive upload error:', err);
      setUploadError(err.message);
      setUploadProgress('');
    }
    setUploading(false);
  };

  const handleUpload = isLinkFlow ? handleUploadViaApi : handleUploadToGDrive;

  return (
    <div className="screen animate-in">
      <h1 className="screen__title">Survey Review</h1>
      <p className="screen__subtitle">{config.siteName}</p>

      {/* Offline Banner */}
      {!isOnline && (
        <div style={{
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          </svg>
          <span style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>
            You're offline. Data is saved locally.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="card" style={{
        display: 'flex', justifyContent: 'space-around', textAlign: 'center',
      }}>
        <StatBlock label="Rooms" value={`${completed}/${total}`} status={completed === total ? 'success' : 'warning'} />
        <StatBlock label="Photos" value={totalPhotos} status={totalPhotos > 0 ? 'success' : 'pending'} />
        <StatBlock label="Repositioned" value={repositioned} status={repositioned > 0 ? 'warning' : 'success'} />
      </div>

      {/* Incomplete rooms warning */}
      {incompleteItems.length > 0 && (
        <div className="card">
          <div className="card__label" style={{ color: 'var(--warning)' }}>
            Incomplete Rooms ({incompleteItems.length})
          </div>
          {incompleteItems.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer',
              }}
              onClick={() => onGoToRoom(item.id)}
            >
              <div className="room-item__status room-item__status--pending">
                {item.cameras.length}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.85rem' }}>{item.roomName}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Camera Changes */}
      {cameraChanges.length > 0 && (
        <div className="card">
          <div className="card__label">Camera Repositioning Log</div>
          {cameraChanges.map((change) => (
            <div
              key={change.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--teal)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: '2px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{change.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {change.room}
                  {change.distanceMeters !== null && ` · moved ${change.distanceMeters}m`}
                </div>
                {change.reason && (
                  <div style={{
                    fontSize: '0.7rem', color: 'var(--text-secondary)',
                    marginTop: '2px', fontStyle: 'italic',
                  }}>
                    {change.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Room Breakdown */}
      {completed > 0 && (
        <div className="card">
          <div className="card__label">Completed Rooms</div>
          {surveyItems.filter((i) => i.survey.completed).map((item) => (
            <div
              key={item.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
              }}
              onClick={() => onGoToRoom(item.id)}
            >
              <div className="room-item__status room-item__status--complete">✓</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.roomName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {item.cameras.length} cam · {item.survey.photos.length} photo{item.survey.photos.length !== 1 ? 's' : ''}
                  {item.survey.ceilingHeight && ` · ${item.survey.ceilingHeight}${item.survey.ceilingHeightUnit === 'meters' ? 'm' : 'ft'}`}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>

        {/* Upload — online with available method */}
        {canUpload && isOnline ? (
          <button
            className={`btn btn--lg btn--block ${uploaded ? 'btn--success' : 'btn--primary'}`}
            onClick={handleUpload}
            disabled={uploading || uploaded}
          >
            {uploaded ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Uploaded Successfully
              </>
            ) : uploading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                {uploadProgress}
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Submit Survey
              </>
            )}
          </button>
        ) : null}

        {/* Queue for upload — offline with GDrive configured (classic flow) */}
        {!isLinkFlow && hasGdrive && !isOnline && !queued && (
          <button
            className="btn btn--lg btn--block btn--primary"
            onClick={handleQueueUpload}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Save & Queue Upload for Later
          </button>
        )}

        {/* Queued confirmation */}
        {queued && (
          <button className="btn btn--lg btn--block btn--success" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Queued — Will upload when online
          </button>
        )}

        {/* Upload destination info */}
        {canUpload && isOnline && !uploaded && !uploading && (
          <div style={{
            fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center',
            fontFamily: 'var(--font-mono)', padding: '0 8px',
          }}>
            {isLinkFlow ? (
              <>
                → Surveys/
                {repositioned > 0 && (
                  <>
                    <br />→ Final Placements/ (updated positions)
                  </>
                )}
              </>
            ) : (
              <>
                → {config.gdriveProject.projectName}/Surveys/
                {repositioned > 0 && (
                  <>
                    <br />→ {config.gdriveProject.projectName}/Final Placements/ (updated positions)
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
          }}>
            Upload failed: {uploadError}
          </div>
        )}

        {/* JSON download — always available */}
        <button
          className={`btn btn--block ${canUpload && isOnline ? 'btn--secondary' : !queued ? 'btn--primary btn--lg' : 'btn--secondary'}`}
          onClick={handleExportJSON}
        >
          {exported ? '✓ JSON Downloaded' : 'Download JSON'}
        </button>

        {/* Back to survey */}
        <button className="btn btn--secondary btn--block" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Room List
        </button>

        <button
          className="btn btn--danger btn--sm"
          style={{ marginTop: '16px', alignSelf: 'center' }}
          onClick={() => {
            if (window.confirm('Start a new survey? All current progress will be lost.')) {
              onReset();
            }
          }}
        >
          Start New Survey
        </button>
      </div>
    </div>
  );
}

function StatBlock({ label, value, status }) {
  const colors = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    pending: 'var(--text-muted)',
  };

  return (
    <div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: colors[status], fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}
