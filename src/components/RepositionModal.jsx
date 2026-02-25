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
  const [debugInfo, setDebugInfo] = useState('');
  const [newPosition, setNewPosition] = useState(null);
  const [reason, setReason] = useState(camera.repositionReason || '');

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);
        setDebugInfo('Loading MappedIn SDK...');

        const { getMapData, show3dMap } = await import('@mappedin/mappedin-js');

        setDebugInfo('Fetching map data...');
        const mapData = await getMapData({
          key: credentials.key,
          secret: credentials.secret,
          mapId: credentials.mapId,
        });

        if (cancelled) return;

        // Log all available floors for debugging
        const floors = mapData.getByType('floor');
        const floorInfo = floors.map((f) => ({
          id: f.id,
          name: f.name || '(unnamed)',
        }));
        console.log('[RepositionModal] Available floors:', floorInfo);
        console.log('[RepositionModal] Looking for floorId:', floorId);

        setDebugInfo(`Found ${floors.length} floors, matching "${floorId}"...`);

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
        } catch (e) {
          console.warn('[RepositionModal] Camera lock failed:', e);
        }

        // Find correct floor with multiple matching strategies
        let targetFloor = null;

        // Strategy 1: Exact ID match
        targetFloor = floors.find((f) => f.id === floorId);
        if (targetFloor) {
          console.log('[RepositionModal] Floor match: exact ID');
        }

        // Strategy 2: Case-insensitive ID match
        if (!targetFloor) {
          targetFloor = floors.find((f) => f.id.toLowerCase() === floorId.toLowerCase());
          if (targetFloor) console.log('[RepositionModal] Floor match: case-insensitive ID');
        }

        // Strategy 3: Suffix/prefix match (handles truncated IDs)
        if (!targetFloor) {
          targetFloor = floors.find(
            (f) => f.id.endsWith(floorId) || floorId.endsWith(f.id) ||
                   f.id.includes(floorId) || floorId.includes(f.id)
          );
          if (targetFloor) console.log('[RepositionModal] Floor match: partial ID');
        }

        // Strategy 4: Name match
        if (!targetFloor) {
          targetFloor = floors.find(
            (f) => f.name && (
              f.name.toLowerCase() === floorId.toLowerCase() ||
              f.name.toLowerCase().includes(floorId.toLowerCase()) ||
              floorId.toLowerCase().includes(f.name.toLowerCase())
            )
          );
          if (targetFloor) console.log('[RepositionModal] Floor match: name');
        }

        // Fallback: first floor
        if (!targetFloor && floors.length > 0) {
          targetFloor = floors[0];
          console.warn('[RepositionModal] No floor match! Falling back to first floor:', targetFloor.id, targetFloor.name);
          setDebugInfo(`⚠ Floor "${floorId}" not found — using "${targetFloor.name || targetFloor.id}"`);
        }

        if (targetFloor) {
          console.log('[RepositionModal] Using floor:', targetFloor.id, targetFloor.name);
          mapView.setFloor(targetFloor);
        }

        // Get camera coordinates
        const currentLat = camera.newLatitude || camera.latitude;
        const currentLng = camera.newLongitude || camera.longitude;
        console.log('[RepositionModal] Camera position:', currentLat, currentLng);
        console.log('[RepositionModal] Camera object:', JSON.stringify({
          id: camera.id,
          name: camera.name,
          lat: currentLat,
          lng: currentLng,
          floorId: camera.floorId,
        }));

        // Place current camera marker
        let coord;
        try {
          coord = mapView.createCoordinate(currentLat, currentLng, targetFloor);
          console.log('[RepositionModal] Coordinate created:', coord);
        } catch (e) {
          console.error('[RepositionModal] createCoordinate failed:', e);
          try {
            coord = mapView.createCoordinate(currentLat, currentLng);
            console.log('[RepositionModal] Coordinate created (no floor):', coord);
          } catch (e2) {
            console.error('[RepositionModal] createCoordinate failed (no floor):', e2);
          }
        }

        if (coord) {
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

          try {
            mapView.Markers.add(coord, currentMarkerHTML, { anchor: 'center' });
            console.log('[RepositionModal] Current marker placed');
          } catch (e) {
            console.error('[RepositionModal] Marker add failed:', e);
          }

          // Focus on camera location
          try {
            mapView.Camera.focusOn(coord, {
              duration: 500,
              pitch: 0,
              bearing: 0,
              zoomLevel: 21,
            });
            console.log('[RepositionModal] Camera focused via focusOn');
          } catch (e) {
            console.warn('[RepositionModal] focusOn failed, trying set:', e);
            try {
              mapView.Camera.set({
                center: { latitude: currentLat, longitude: currentLng },
                zoomLevel: 21,
                pitch: 0,
              });
              console.log('[RepositionModal] Camera set via set()');
            } catch (e2) {
              console.error('[RepositionModal] Camera.set also failed:', e2);
            }
          }
        } else {
          console.error('[RepositionModal] Could not create coordinate — marker not placed');
          setDebugInfo(`⚠ Could not place marker at ${currentLat}, ${currentLng}`);
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
        setDebugInfo(`Floor: ${targetFloor?.name || targetFloor?.id || 'unknown'} | Camera: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`);
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

      {/* Reason field + legend + debug */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
      }}>
        {/* Reason input */}
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

        {/* Debug info */}
        {debugInfo && (
          <div style={{
            marginTop: '8px', fontSize: '0.6rem',
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            textAlign: 'center', opacity: 0.7,
          }}>
            {debugInfo}
          </div>
        )}
      </div>
    </div>
  );
}
