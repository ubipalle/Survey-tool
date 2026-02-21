import React, { useRef, useState } from 'react';

const PHOTO_LABELS = [
  'Camera mount location',
  'Field of view',
  'Power outlet',
  'Network point',
  'Obstruction',
  'General',
];

export default function PhotoCapture({ photos, onAdd, onRemove }) {
  const fileRef = useRef();
  const [selectedLabel, setSelectedLabel] = useState(PHOTO_LABELS[0]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const promises = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            resolve({
              dataUrl: ev.target.result,
              label: selectedLabel,
              timestamp: new Date().toISOString(),
              fileName: file.name,
            });
          };
          reader.readAsDataURL(file);
        })
    );

    Promise.all(promises).then((newPhotos) => {
      onAdd(newPhotos);
    });

    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="animate-in">
      {/* Label Selector */}
      <div className="form-group">
        <label className="form-label">Photo Category</label>
        <select
          className="form-select"
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value)}
        >
          {PHOTO_LABELS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <div className="form-hint">Select a category before taking/uploading photos</div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className="btn btn--primary"
          style={{ flex: 1 }}
          onClick={() => {
            // Set capture mode for camera
            if (fileRef.current) {
              fileRef.current.setAttribute('capture', 'environment');
              fileRef.current.click();
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Take Photo
        </button>
        <button
          className="btn btn--secondary"
          style={{ flex: 1 }}
          onClick={() => {
            // Remove capture to allow gallery
            if (fileRef.current) {
              fileRef.current.removeAttribute('capture');
              fileRef.current.click();
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Upload
        </button>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <div key={index} className="photo-grid__item">
              <img src={photo.dataUrl} alt={photo.label} />
              <button
                className="photo-grid__remove"
                onClick={() => onRemove(index)}
                title="Remove photo"
              >
                ✕
              </button>
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '3px 6px',
                  background: 'rgba(0,0,0,0.7)',
                  fontSize: '0.6rem',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {photo.label}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: '30px 20px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <div style={{ fontSize: '0.85rem' }}>No photos yet</div>
          <div style={{ fontSize: '0.75rem' }}>
            Take photos of the camera mount location and field of view
          </div>
        </div>
      )}
    </div>
  );
}
