import React, { useState } from 'react';
import { exportSurveyPayload } from '../utils/storage';
import { uploadJsonFile, uploadPhoto } from '../utils/googleDrive';
import { isSignedIn } from '../utils/googleAuth';

export default function ReviewScreen({ config, surveyItems, onBack, onGoToRoom, onReset }) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const completed = surveyItems.filter((i) => i.survey.completed).length;
  const total = surveyItems.length;
  const totalPhotos = surveyItems.reduce((s, i) => s + i.survey.photos.length, 0);
  const repositioned = surveyItems.reduce(
    (s, i) => s + i.cameras.filter((c) => c.repositioned).length,
    0
  );
  const totalCameras = surveyItems.reduce((s, i) => s + i.cameras.length, 0);
  const incompleteItems = surveyItems.filter((i) => !i.survey.completed);

  const hasGdrive = !!config.gdriveProject;
  const signedIn = isSignedIn();

  const handleExportJSON = () => {
    const payload = exportSurveyPayload(surveyItems, {
      surveyId: `survey_${Date.now()}`,
      mapId: config.credentials.mapId,
      siteName: config.siteName,
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-survey_${config.siteName.replace(/\s+/g, '-').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  const handleUploadToGDrive = async () => {
    if (!hasGdrive || !signedIn) return;

    setUploading(true);
    setUploadError('');
    setUploadProgress('Preparing survey data...');

    try {
      const { subfolders } = config.gdriveProject;
      const dateStr = new Date().toISOString().slice(0, 10);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // 1. Upload survey JSON
      setUploadProgress('Uploading survey data...');
      const payload = exportSurveyPayload(surveyItems, {
        surveyId: `survey_${Date.now()}`,
        mapId: config.credentials.mapId,
        siteName: config.siteName,
      });

      const jsonFilename = `survey_${dateStr}_${timestamp}.json`;
      await uploadJsonFile(jsonFilename, payload, subfolders.surveys);

      // 2. Upload photos
      let photoCount = 0;
      for (const item of surveyItems) {
        for (let i = 0; i < item.survey.photos.length; i++) {
          const photo = item.survey.photos[i];
          photoCount++;
          setUploadProgress(`Uploading photo ${photoCount} of ${totalPhotos}...`);

          const roomSlug = item.roomName.replace(/\s+/g, '-').toLowerCase();
          const photoFilename = `${dateStr}_${roomSlug}_${photo.label || 'photo'}_${i + 1}.jpg`;

          await uploadPhoto(photoFilename, photo.dataUrl, subfolders.photos);
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

  return (
    <div className="screen animate-in">
      <h1 className="screen__title">Survey Review</h1>
      <p className="screen__subtitle">{config.siteName}</p>

      {/* Summary Stats */}
      <div className="card">
        <div className="card__label">Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <StatBlock
            label="Rooms Surveyed"
            value={`${completed}/${total}`}
            status={completed === total ? 'success' : 'warning'}
          />
          <StatBlock
            label="Total Photos"
            value={totalPhotos}
            status={totalPhotos > 0 ? 'success' : 'pending'}
          />
          <StatBlock
            label="Cameras"
            value={totalCameras}
            status="success"
          />
          <StatBlock
            label="Repositioned"
            value={repositioned}
            status={repositioned > 0 ? 'warning' : 'pending'}
          />
        </div>
      </div>

      {/* Incomplete Rooms Warning + clickable list */}
      {incompleteItems.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--warning)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '12px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--warning)' }}>
              {incompleteItems.length} room{incompleteItems.length !== 1 ? 's' : ''} incomplete
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Tap a room to go back and complete the survey:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {incompleteItems.map((item) => (
              <button
                key={item.id}
                className="btn btn--secondary"
                style={{
                  justifyContent: 'flex-start', gap: '10px',
                  padding: '10px 14px',
                }}
                onClick={() => onGoToRoom(item.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span style={{ flex: 1, textAlign: 'left' }}>{item.roomName}</span>
                <span style={{
                  fontSize: '0.7rem', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {item.cameras.length} cam · {item.survey.photos.length} photos
                </span>
              </button>
            ))}
          </div>
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

        {/* Google Drive Upload — primary action if connected */}
        {hasGdrive && signedIn ? (
          <button
            className={`btn btn--lg btn--block ${uploaded ? 'btn--success' : 'btn--primary'}`}
            onClick={handleUploadToGDrive}
            disabled={uploading || uploaded}
          >
            {uploaded ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Uploaded to Google Drive
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
                Upload to Google Drive
              </>
            )}
          </button>
        ) : null}

        {/* Upload destination info */}
        {hasGdrive && signedIn && !uploaded && !uploading && (
          <div style={{
            fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center',
            fontFamily: 'var(--font-mono)', padding: '0 8px',
          }}>
            → {config.gdriveProject.projectName}/Surveys/
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
          className={`btn btn--block ${hasGdrive && signedIn ? 'btn--secondary' : 'btn--primary btn--lg'}`}
          onClick={handleExportJSON}
        >
          {exported ? '✓ JSON Downloaded' : 'Download JSON'}
        </button>

        {/* Back to survey — prominent */}
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
