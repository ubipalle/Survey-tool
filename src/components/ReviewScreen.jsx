import React, { useState } from 'react';
import { exportSurveyPayload } from '../utils/storage';

export default function ReviewScreen({ config, surveyItems, onBack, onReset }) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const completed = surveyItems.filter((i) => i.survey.completed).length;
  const total = surveyItems.length;
  const totalPhotos = surveyItems.reduce((s, i) => s + i.survey.photos.length, 0);
  const repositioned = surveyItems.reduce(
    (s, i) => s + i.cameras.filter((c) => c.repositioned).length,
    0
  );
  const totalCameras = surveyItems.reduce((s, i) => s + i.cameras.length, 0);

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

  const handleSubmitToHubSpot = async () => {
    setExporting(true);

    // TODO: Phase 2 — Implement HubSpot API integration
    // 1. Upload photos to S3 with presigned URLs
    // 2. Create HubSpot custom object records
    // 3. Associate with deal/company

    // For now, simulate
    await new Promise((r) => setTimeout(r, 1500));
    setExporting(false);
    alert(
      'HubSpot integration coming in Phase 2!\n\n' +
        'For now, use "Export JSON" to download your survey data.'
    );
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

      {/* Incomplete Rooms Warning */}
      {completed < total && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--warning)', fontWeight: 600 }}>
              {total - completed} room{total - completed !== 1 ? 's' : ''} incomplete
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              You can still export, but these rooms won't have survey data.
            </div>
          </div>
        </div>
      )}

      {/* Room-by-Room Breakdown */}
      <div className="card">
        <div className="card__label">Room Details</div>
        {surveyItems.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              className={`room-item__status ${
                item.survey.completed ? 'room-item__status--complete' : 'room-item__status--pending'
              }`}
            >
              {item.survey.completed ? '✓' : '—'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.roomName}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {item.cameras.length} cam · {item.survey.photos.length} photo{item.survey.photos.length !== 1 ? 's' : ''}
                {item.survey.ceilingHeight && ` · ${item.survey.ceilingHeight}${item.survey.ceilingHeightUnit === 'meters' ? 'm' : 'ft'}`}
              </div>
            </div>
            {item.survey.completed ? (
              <span className="badge badge--success">Complete</span>
            ) : (
              <span className="badge badge--pending">Incomplete</span>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
        <button className="btn btn--primary btn--lg btn--block" onClick={handleExportJSON}>
          {exported ? '✓ Downloaded' : 'Export as JSON'}
        </button>

        <button
          className="btn btn--secondary btn--lg btn--block"
          onClick={handleSubmitToHubSpot}
          disabled={exporting}
        >
          {exporting ? 'Submitting...' : 'Submit to HubSpot (Phase 2)'}
        </button>

        <button className="btn btn--secondary btn--block" onClick={onBack}>
          ← Back to Survey
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
