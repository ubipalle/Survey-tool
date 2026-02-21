import React, { useRef, useEffect, useState } from 'react';

/**
 * RepositionModal — Full-screen map overlay for repositioning a camera.
 * Opens centered on the camera's current position, tap to set new location.
 * Includes optional reason field for documenting why the camera was moved.
 */
export default function RepositionModal({ credentials, floorId, camera, onConfirm, onCancel }) {
  const containerRef = useRef(null);
  const mapViewRef = useRef(null);
  const markerRef = useRef(null);
  const newPositionRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPosition, setNewPosition] = useState(null);
  const [reason, setReason] = useState(camera.repositionReason || '');

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const { getMapData, show3dMap } = await import('@mappedin/mappedin-js');

        const mapData = await getMapData({
          key: credentials.key,
          secret: credentials.secret,
          mapId: credentials.mapId,
        });

        if (cancelled) return;

        containerRef.current.innerHTML = '';

        const mapView = await show3dMap(containerRef.current, mapData, {
          pitch: 0,
        });

        if (cancelled) return;
        mapViewRef.current = mapView;

        // Lock to 2D
        try {
          mapView.Camera.set({ pitch: 0, bearing: 0 });
          mapView.Camera.interactions = {
            ...mapView.Camera.interactions,
            tilt: false,
            rotate: false,
          };
        } catch {}

        // Find correct floor
        const floors = mapData.getByType('floor');
        let targetFloor = floors.find((f) => f.id === floorId);
        if (!targetFloor) {
          targetFloor = floors.find((f) => f.id.endsWith(floorId) || floorId.endsWith(f.id));
        }
        if (!targetFloor && floors.length > 0) {
          targetFloor = floors[0];
        }

        if (targetFloor) {
          mapView.setFloor(targetFloor);
        }

        // Place current camera marker (accent gold)
        const currentLat = camera.newLatitude || camera.latitude;
        const currentLng = camera.newLongitude || camera.longitude;
        const coord = mapView.createCoordinate(currentLat, currentLng, targetFloor);

        const currentMarkerHTML = `
          <div style="
            display: flex; flex-direction: column; align-items: center; gap: 4px;
          ">
            <div style="
              width: 40px; height: 40px;
              background: #d4a843;
              border: 3px solid #fff;
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div style="
              background: rgba(0,0,0,0.65); color: #fff;
              padding: 2px 8px; border-radius: 4px;
              font-size: 11px; font-family: sans-serif; white-space: nowrap;
            ">Current position</div>
          </div>
        `;

        mapView.Markers.add(coord, currentMarkerHTML, {
          anchor: 'center',
        });

        // Focus on camera location
        try {
          mapView.Camera.focusOn(coord, {
            duration: 500,
            pitch: 0,
            bearing: 0,
            zoomLevel: 21,
          });
        } catch {
          mapView.Camera.set({
            center: { latitude: currentLat, longitude: currentLng },
            zoomLevel: 21,
            pitch: 0,
          });
        }

        // Listen for taps to place new position
        mapView.on('click', (event) => {
          if (!event.coordinate) return;

          const lat = event.coordinate.latitude;
          const lng = event.coordinate.longitude;

          // Remove previous "new position" marker if any
          if (markerRef.current) {
            try { mapView.Markers.remove(markerRef.current); } catch {}
          }

          // Place new marker (teal)
          const newCoord = mapView.createCoordinate(lat, lng, targetFloor);
          const newMarkerHTML = `
            <div style="
              display: flex; flex-direction: column; align-items: center; gap: 4px;
            ">
              <div style="
                width: 40px; height: 40px;
                background: #26a69a;
                border: 3px solid #fff;
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div style="
                background: #26a69a; color: #fff;
                padding: 2px 8px; border-radius: 4px;
                font-size: 11px; font-family: sans-serif; white-space: nowrap;
                font-weight: 600;
              ">New position</div>
            </div>
          `;

          const newMarker = mapView.Markers.add(newCoord, newMarkerHTML, {
            anchor: 'center',
          });

          markerRef.current = newMarker;
          newPositionRef.current = { latitude: lat, longitude: lng };
          setNewPosition({ latitude: lat, longitude: lng });
        });

        setLoading(false);
      } catch (err) {
        console.error('[RepositionModal] Error:', err);
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [credentials, floorId, camera]);

  const handleConfirm = () => {
    if (newPositionRef.current) {
      onConfirm(
        camera.id,
        newPositionRef.current.latitude,
        newPositionRef.current.longitude,
        reason.trim() || null
      );
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button className="btn btn--sm btn--secondary" onClick={onCancel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Cancel
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Reposition Camera</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {(camera.name || camera.id).slice(0, 30)}
          </div>
        </div>
        <button
          className="btn btn--sm btn--primary"
          disabled={!newPosition}
          onClick={handleConfirm}
          style={{ opacity: newPosition ? 1 : 0.4 }}
        >
          Confirm
        </button>
      </div>

      {/* Instruction banner */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--accent-light)',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.8rem',
        color: 'var(--accent-hover)',
        textAlign: 'center',
        fontWeight: 600,
      }}>
        {newPosition
          ? '✓ New position selected — tap elsewhere to change, or confirm above'
          : 'Tap the map where the camera should be placed'}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', background: 'var(--bg-primary)',
          }}>
            <div className="spinner" />
            <div className="loading-text" style={{ marginTop: '12px' }}>Loading map...</div>
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', textAlign: 'center',
          }}>
            <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>
          </div>
        )}

        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Reason field + legend */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
      }}>
        {/* Reason input — shown after placing a new position */}
        {newPosition && (
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Reason for moving (optional, e.g. obstructed by pillar)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ fontSize: '0.8rem' }}
            />
          </div>
        )}

        {/* Legend */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '24px',
          fontSize: '0.75rem', color: 'var(--text-secondary)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: '#d4a843', border: '2px solid #fff',
              display: 'inline-block', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }} />
            Current
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: '#26a69a', border: '2px solid #fff',
              display: 'inline-block', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }} />
            New position
          </span>
        </div>
      </div>
    </div>
  );
}
