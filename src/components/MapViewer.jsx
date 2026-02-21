import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * MapViewer — Renders a MappedIn map in 2D mode with camera markers.
 *
 * Uses the @mappedin/mappedin-js SDK (v6+).
 * Key SDK facts:
 * - Markers.add() takes a Coordinate + HTML string (not DOM element)
 * - Coordinates must be created via mapView.createCoordinate(lat, lng, floor)
 * - setFloor() takes a Floor object or floor ID string
 * - show3dMap() auto-injects CSS — no import needed
 */
export default function MapViewer({ credentials, floorId, cameras, center, onCameraReposition }) {
  const containerRef = useRef(null);
  const mapViewRef = useRef(null);
  const mapDataRef = useRef(null);
  const markersRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [repositionMode, setRepositionMode] = useState(null); // cameraId or null
  const [mapModule, setMapModule] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  // Track current floorId to debug
  const [debugInfo, setDebugInfo] = useState('');

  // Load MappedIn SDK dynamically
  useEffect(() => {
    let cancelled = false;

    async function loadSDK() {
      try {
        const mod = await import('@mappedin/mappedin-js');
        if (!cancelled) setMapModule(mod);
      } catch (err) {
        console.error('Failed to load MappedIn SDK:', err);
        if (!cancelled) setError('Failed to load MappedIn SDK. Make sure @mappedin/mappedin-js is installed.');
      }
    }

    loadSDK();
    return () => { cancelled = true; };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapModule || !containerRef.current) return;

    let cancelled = false;
    const { getMapData, show3dMap } = mapModule;

    async function initMap() {
      try {
        setLoading(true);
        setMapReady(false);
        setError(null);

        // Fetch map data using Maker credentials (key starts with mik_)
        const mapData = await getMapData({
          key: credentials.key,
          secret: credentials.secret,
          mapId: credentials.mapId,
        });

        if (cancelled) return;
        mapDataRef.current = mapData;

        // Log available floors for debugging
        const floors = mapData.getByType('floor');
        console.log('[MapViewer] Available floors:', floors.map((f) => ({
          id: f.id,
          name: f.name,
          elevation: f.elevation,
        })));

        // Clear container before rendering
        containerRef.current.innerHTML = '';

        // Create map view — show3dMap auto-injects CSS
        const mapView = await show3dMap(containerRef.current, mapData, {
          pitch: 0, // Start in top-down 2D view
        });

        if (cancelled) return;
        mapViewRef.current = mapView;

        // Lock to 2D: disable tilt and rotation
        try {
          mapView.Camera.set({ pitch: 0, bearing: 0 });
          mapView.Camera.interactions = {
            ...mapView.Camera.interactions,
            tilt: false,
            rotate: false,
          };
        } catch (err) {
          console.warn('[MapViewer] Could not lock 2D mode:', err);
        }

        setLoading(false);
        setMapReady(true);
      } catch (err) {
        console.error('[MapViewer] Initialization error:', err);
        if (!cancelled) {
          setError(`Map load failed: ${err.message}`);
          setLoading(false);
        }
      }
    }

    initMap();

    return () => {
      cancelled = true;
      markersRef.current = [];
    };
  }, [mapModule, credentials]);

  // Switch floor and place markers when floorId or cameras change
  useEffect(() => {
    const mapView = mapViewRef.current;
    const mapData = mapDataRef.current;
    if (!mapView || !mapData || !mapReady) return;

    async function updateView() {
      try {
        // === FLOOR SWITCHING ===
        const floors = mapData.getByType('floor');
        console.log('[MapViewer] Looking for floorId:', floorId);
        console.log('[MapViewer] Available floor IDs:', floors.map((f) => f.id));

        // Try exact ID match first, then partial match on name
        let targetFloor = floors.find((f) => f.id === floorId);
        if (!targetFloor) {
          targetFloor = floors.find((f) => f.name && f.name.includes(floorId));
        }
        if (!targetFloor) {
          // Try matching the last part of the ID (camera JSON might have shortened IDs)
          targetFloor = floors.find((f) => f.id.endsWith(floorId) || floorId.endsWith(f.id));
        }
        if (!targetFloor && floors.length > 0) {
          // Fallback: use first floor
          targetFloor = floors[0];
          console.warn('[MapViewer] Floor not found, using first floor:', targetFloor.id);
        }

        if (targetFloor) {
          console.log('[MapViewer] Switching to floor:', targetFloor.id, targetFloor.name);
          mapView.setFloor(targetFloor);
        }

        // === CLEAR EXISTING MARKERS ===
        try {
          mapView.Markers.removeAll();
        } catch {
          // Fallback: remove individually
          markersRef.current.forEach((m) => {
            try { mapView.Markers.remove(m); } catch { /* ignore */ }
          });
        }
        markersRef.current = [];

        // === PLACE CAMERA MARKERS ===
        for (const cam of cameras) {
          const lat = cam.newLatitude || cam.latitude;
          const lng = cam.newLongitude || cam.longitude;

          try {
            // Create a proper SDK Coordinate using mapView.createCoordinate()
            const coordinate = mapView.createCoordinate(lat, lng, targetFloor);

            // Build marker HTML string (SDK requires string, not DOM element)
            const isRepositioned = cam.repositioned;
            const markerHTML = `
              <div style="
                width: 36px;
                height: 36px;
                background: ${isRepositioned ? '#fbbf24' : '#5b8def'};
                border: 3px solid #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                cursor: pointer;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            `;

            const marker = mapView.Markers.add(coordinate, markerHTML, {
              anchor: 'center',
              interactive: true,
            });

            if (marker) {
              markersRef.current.push(marker);
              console.log('[MapViewer] Placed marker for:', cam.name, 'at', lat, lng);
            } else {
              console.warn('[MapViewer] Markers.add returned undefined for:', cam.name);
            }
          } catch (err) {
            console.warn('[MapViewer] Failed to place marker for camera:', cam.id, cam.name, err);
          }
        }

        setDebugInfo(`Floor: ${targetFloor?.name || targetFloor?.id || '?'} | ${markersRef.current.length}/${cameras.length} markers placed`);

        // === FOCUS CAMERA ON ROOM ===
        if (center && targetFloor) {
          try {
            const centerCoord = mapView.createCoordinate(center.latitude, center.longitude, targetFloor);
            mapView.Camera.focusOn(centerCoord, {
              duration: 500,
              pitch: 0,
              bearing: 0,
              zoomLevel: 21,
            });
          } catch (focusErr) {
            console.warn('[MapViewer] focusOn failed, trying Camera.set:', focusErr);
            try {
              mapView.Camera.set({
                center: { latitude: center.latitude, longitude: center.longitude },
                zoomLevel: 21,
                pitch: 0,
                bearing: 0,
              });
            } catch {
              // Centering failed, but markers should still be visible
            }
          }
        }
      } catch (err) {
        console.error('[MapViewer] updateView error:', err);
      }
    }

    updateView();
  }, [floorId, cameras, center, mapReady]);

  // Handle click-to-reposition
  useEffect(() => {
    const mapView = mapViewRef.current;
    if (!mapView || !repositionMode) return;

    const handleClick = (event) => {
      if (event.coordinate) {
        console.log('[MapViewer] Reposition click:', event.coordinate.latitude, event.coordinate.longitude);
        onCameraReposition(
          repositionMode,
          event.coordinate.latitude,
          event.coordinate.longitude
        );
        setRepositionMode(null);
      }
    };

    mapView.on('click', handleClick);
    return () => {
      mapView.off('click', handleClick);
    };
  }, [repositionMode, onCameraReposition]);

  if (error) {
    return (
      <div className="survey-map-container__inner" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '20px', textAlign: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '8px' }}>
          {error}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          Check your credentials and map ID
        </div>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: 'var(--bg-secondary)',
        }}>
          <div className="spinner" />
          <div className="loading-text" style={{ marginTop: '12px' }}>Loading map...</div>
        </div>
      )}

      <div ref={containerRef} className="survey-map-container__inner" />

      {/* Debug info overlay */}
      {debugInfo && (
        <div style={{
          position: 'absolute', bottom: '40px', left: '12px',
          padding: '4px 8px', background: 'rgba(0,0,0,0.7)',
          borderRadius: '4px', fontSize: '0.65rem',
          fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
          zIndex: 15,
        }}>
          {debugInfo}
        </div>
      )}

      {/* Reposition mode indicator */}
      {repositionMode && (
        <div style={{
          position: 'absolute', top: '12px', left: '12px', right: '12px',
          padding: '10px 14px', background: 'var(--warning-bg)',
          border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 20,
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>
            Tap the map to place camera
          </span>
          <button
            className="btn btn--sm btn--secondary"
            onClick={() => setRepositionMode(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Camera list mini-panel for repositioning */}
      {!loading && cameras.length > 0 && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 15,
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {cameras.map((cam) => (
            <button
              key={cam.id}
              className="btn btn--sm btn--secondary"
              style={{ fontSize: '0.7rem', padding: '4px 8px' }}
              onClick={() => setRepositionMode(cam.id)}
              title={`Reposition: ${cam.name}`}
            >
              📷 {cam.repositioned ? '✏️' : ''} {(cam.name || cam.id).slice(0, 20)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}