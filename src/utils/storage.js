/**
 * Simple localStorage wrapper for saving survey progress.
 * In production, swap this for localforage for IndexedDB support
 * (better for large binary data like photos).
 */

const STORAGE_KEY = 'site_survey_progress';
const CREDENTIALS_KEY = 'site_survey_credentials';

export function saveSurveyProgress(surveyId, data) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[surveyId] = {
      ...data,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    console.error('Failed to save survey progress:', e);
    return false;
  }
}

export function loadSurveyProgress(surveyId) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return all[surveyId] || null;
  } catch {
    return null;
  }
}

export function clearSurveyProgress(surveyId) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete all[surveyId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

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
        // In production, photos would be S3 URLs instead of data URLs
        photos: item.survey.photos.map((p) => ({
          label: p.label,
          timestamp: p.timestamp,
          // dataUrl excluded for JSON export — would be S3 URL in production
          url: p.s3Url || p.dataUrl,
        })),
        completed: item.survey.completed,
        completedAt: item.survey.completedAt,
      },
    })),
  };

  return payload;
}
