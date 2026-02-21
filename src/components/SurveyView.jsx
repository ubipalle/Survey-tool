import React, { useState, useCallback } from 'react';
import SurveyForm from './SurveyForm';
import PhotoCapture from './PhotoCapture';
import RepositionModal from './RepositionModal';

export default function SurveyView({
  item,
  config,
  onUpdate,
  onUpdateCamera,
  onBack,
  onNext,
  currentIndex,
  totalRooms,
}) {
  const [activeTab, setActiveTab] = useState('form'); // 'form' or 'photos'
  const [repositionCamera, setRepositionCamera] = useState(null); // camera object or null

  const handleSurveyChange = useCallback(
    (field, value) => {
      onUpdate({
        survey: {
          ...item.survey,
          [field]: value,
        },
      });
    },
    [item.survey, onUpdate]
  );

  const handleMarkComplete = useCallback(() => {
    onUpdate({
      survey: {
        ...item.survey,
        completed: !item.survey.completed,
        completedAt: !item.survey.completed ? new Date().toISOString() : null,
      },
    });
  }, [item.survey, onUpdate]);

  const handleAddPhotos = useCallback(
    (newPhotos) => {
      onUpdate({
        survey: {
          ...item.survey,
          photos: [...item.survey.photos, ...newPhotos],
        },
      });
    },
    [item.survey, onUpdate]
  );

  const handleRemovePhoto = useCallback(
    (index) => {
      onUpdate({
        survey: {
          ...item.survey,
          photos: item.survey.photos.filter((_, i) => i !== index),
        },
      });
    },
    [item.survey, onUpdate]
  );

  const handleRepositionConfirm = useCallback(
    (cameraId, latitude, longitude, reason) => {
      onUpdateCamera(cameraId, {
        newLatitude: latitude,
        newLongitude: longitude,
        repositioned: true,
        repositionReason: reason || null,
      });
      setRepositionCamera(null);
    },
    [onUpdateCamera]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header bar */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button
          className="btn btn--sm btn--secondary btn--icon"
          onClick={onBack}
          style={{ flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            color: 'var(--text-primary)',
          }}>
            {item.roomName}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Room {currentIndex} of {totalRooms} · {item.cameras.length} camera{item.cameras.length !== 1 ? 's' : ''}
          </div>
        </div>
        {item.survey.completed && (
          <span className="badge badge--success">Done</span>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Camera Cards */}
        <div className="card">
          <div className="card__label">Cameras in this room</div>
          {item.cameras.map((cam) => (
            <div
              key={cam.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {/* Camera icon */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: cam.repositioned ? 'var(--teal)' : 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '2px',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>

              {/* Camera info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {cam.name || cam.id}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {cam.mountType} · {cam.height}m
                  {cam.repositioned && (
                    <span style={{ color: 'var(--teal)', marginLeft: '6px' }}>· Moved</span>
                  )}
                </div>
                {cam.repositioned && cam.repositionReason && (
                  <div style={{
                    fontSize: '0.7rem', color: 'var(--text-secondary)',
                    marginTop: '4px', fontStyle: 'italic',
                  }}>
                    Reason: {cam.repositionReason}
                  </div>
                )}
              </div>

              {/* Reposition button */}
              <button
                className="btn btn--sm btn--secondary"
                onClick={() => setRepositionCamera(cam)}
                style={{ flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {cam.repositioned ? 'Adjust' : 'Reposition'}
              </button>
            </div>
          ))}
        </div>

        {/* Tabs: Form / Photos */}
        <div className="floor-tabs" style={{ marginBottom: '16px' }}>
          <button
            className={`floor-tab ${activeTab === 'form' ? 'floor-tab--active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            Survey Details
          </button>
          <button
            className={`floor-tab ${activeTab === 'photos' ? 'floor-tab--active' : ''}`}
            onClick={() => setActiveTab('photos')}
          >
            Photos ({item.survey.photos.length})
          </button>
        </div>

        {activeTab === 'form' ? (
          <SurveyForm survey={item.survey} onChange={handleSurveyChange} />
        ) : (
          <PhotoCapture
            photos={item.survey.photos}
            onAdd={handleAddPhotos}
            onRemove={handleRemovePhoto}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="nav-buttons">
        <button
          className={`btn ${item.survey.completed ? 'btn--success' : 'btn--secondary'}`}
          onClick={handleMarkComplete}
        >
          {item.survey.completed ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Completed
            </>
          ) : (
            'Mark Complete'
          )}
        </button>
        <button className="btn btn--primary" onClick={onNext}>
          Next Room
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Reposition Modal */}
      {repositionCamera && (
        <RepositionModal
          credentials={config.credentials}
          floorId={item.floorId}
          camera={repositionCamera}
          onConfirm={handleRepositionConfirm}
          onCancel={() => setRepositionCamera(null)}
        />
      )}
    </div>
  );
}
