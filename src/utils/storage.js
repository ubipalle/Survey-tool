/**
 * Storage utilities using localforage (IndexedDB) for offline-capable
 * storage of large data like photos.
 *
 * Falls back to localStorage for credentials (small data, sync access needed).
 */

import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'site-survey-tool',
  storeName: 'surveys',
  description: 'Site survey data and photos',
});

const CREDENTIALS_KEY = 'site_survey_credentials';

// ── Survey Progress (async, IndexedDB) ──────────────────────────────

export async function saveSurveyProgress(surveyId, data) {
  try {
    const all = (await localforage.getItem('survey_progress')) || {};
    all[surveyId] = {
      ...data,
      lastSaved: new Date().toISOString(),
    };
    await localforage.setItem('survey_progress', all);
    return true;
  } catch (e) {
    console.error('Failed to save survey progress:', e);
    return false;
  }
}

export async function loadSurveyProgress(surveyId) {
  try {
    const all = (await localforage.getItem('survey_progress')) || {};
    return all[surveyId] || null;
  } catch {
    return null;
  }
}

export async function clearSurveyProgress(surveyId) {
  try {
    const all = (await localforage.getItem('survey_progress')) || {};
    delete all[surveyId];
    await localforage.setItem('survey_progress', all);
  } catch {
    // ignore
  }
}

// ── Credentials (sync, localStorage — small data) ──────────────────

export function saveCredentials(creds) {
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
  } catch {
    // ignore
  }
}

export function loadCredentials() {
  try {
    return JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || 'null');
  } catch {
    return null;
  }
}

// ── Pending Uploads Queue (IndexedDB) ───────────────────────────────

/**
 * Queue a survey upload for when connectivity returns.
 * Stores the full payload + photos so they survive app restarts.
 */
export async function queuePendingUpload(uploadData) {
  try {
    const queue = (await localforage.getItem('pending_uploads')) || [];
    queue.push({
      ...uploadData,
      queuedAt: new Date().toISOString(),
      id: `upload_${Date.now()}`,
    });
    await localforage.setItem('pending_uploads', queue);
    return true;
  } catch (e) {
    console.error('Failed to queue upload:', e);
    return false;
  }
}

export async function getPendingUploads() {
  try {
    return (await localforage.getItem('pending_uploads')) || [];
  } catch {
    return [];
  }
}

export async function removePendingUpload(uploadId) {
  try {
    const queue = (await localforage.getItem('pending_uploads')) || [];
    const filtered = queue.filter((u) => u.id !== uploadId);
    await localforage.setItem('pending_uploads', filtered);
  } catch {
    // ignore
  }
}

export async function clearPendingUploads() {
  try {
    await localforage.setItem('pending_uploads', []);
  } catch {
    // ignore
  }
}

// ── Export Payload (unchanged) ──────────────────────────────────────

/**
 * Export the full survey as a JSON blob for download or API submission
 */
export function exportSurveyPayload(surveyItems, metadata) {
  const payload = {
    surveyId: metadata.surveyId,
    mapId: metadata.mapId,
    siteName: metadata.siteName,
    exportedAt: new Date().toISOString(),
    summary: {
      totalRooms: surveyItems.length,
      completedRooms: surveyItems.filter((i) => i.survey.completed).length,
      totalCameras: surveyItems.reduce((s, i) => s + i.cameras.length, 0),
      repositionedCameras: surveyItems.reduce(
        (s, i) => s + i.cameras.filter((c) => c.repositioned).length,
        0
      ),
    },
    rooms: surveyItems.map((item) => ({
      floorId: item.floorId,
      roomName: item.roomName,
      cameras: item.cameras.map((cam) => ({
        id: cam.id,
        name: cam.name,
        mountType: cam.mountType,
        originalPosition: {
          latitude: cam.latitude,
          longitude: cam.longitude,
        },
        newPosition: cam.repositioned
          ? {
              latitude: cam.newLatitude,
              longitude: cam.newLongitude,
            }
          : null,
        repositioned: cam.repositioned,
        repositionReason: cam.repositionReason || null,
        height: cam.height,
        rotation: cam.rotation,
        fieldOfView: cam.fieldOfView,
        range: cam.range,
        tilt: cam.tilt,
      })),
      survey: {
        ceilingHeight: item.survey.ceilingHeight,
        ceilingHeightUnit: item.survey.ceilingHeightUnit,
        powerOutletLocation: item.survey.powerOutletLocation,
        mountingSurface: item.survey.mountingSurface,
        networkConnectivity: item.survey.networkConnectivity,
        obstructions: item.survey.obstructions,
        notes: item.survey.notes,
        photoCount: item.survey.photos.length,
        photos: item.survey.photos.map((p) => ({
          label: p.label,
          timestamp: p.timestamp,
          url: p.s3Url || p.dataUrl,
        })),
        completed: item.survey.completed,
        completedAt: item.survey.completedAt,
      },
    })),
  };

  return payload;
}
