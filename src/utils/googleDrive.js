/**
 * Google Drive API utility.
 * Handles listing shared drives, browsing folders, creating subfolders, and uploading files.
 */

import { getAccessToken } from './googleAuth';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Make an authenticated Drive API request.
 */
async function driveRequest(url, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('Not signed in to Google');

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Drive API error: ${res.status}`);
  }

  return res.json();
}

// ─── SHARED DRIVES ───

/**
 * List all shared drives the user has access to.
 */
export async function listSharedDrives() {
  const data = await driveRequest(`${DRIVE_API}/drives?pageSize=100`);
  return data.drives || [];
}

/**
 * Find the "Customer projects" shared drive (or similar name).
 */
export async function findCustomerProjectsDrive(name = 'Customer projects') {
  const drives = await listSharedDrives();
  const match = drives.find(
    (d) => d.name.toLowerCase() === name.toLowerCase()
  );
  return match || null;
}

// ─── FOLDERS ───

/**
 * List ALL folders inside a parent folder on a shared drive.
 * Handles pagination to retrieve every folder.
 * @param {string} parentId - The parent folder ID (or shared drive ID for root)
 * @param {string} driveId - The shared drive ID
 */
export async function listFolders(parentId, driveId) {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  let allFiles = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken,files(id,name,createdTime)',
      orderBy: 'name',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      corpora: 'drive',
      driveId,
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const data = await driveRequest(`${DRIVE_API}/files?${params}`);
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return allFiles;
}

/**
 * List project folders from the shared drive root.
 */
export async function listProjectFolders(driveId) {
  const folders = await listFolders(driveId, driveId);
  return folders;
}

/**
 * Get or create a subfolder inside a parent folder.
 * Returns the folder's ID.
 */
export async function getOrCreateFolder(name, parentId, driveId) {
  // Check if it exists
  const q = `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'drive',
    driveId,
  });

  const data = await driveRequest(`${DRIVE_API}/files?${params}`);

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create it
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };

  const created = await driveRequest(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });

  return created.id;
}

/**
 * Ensure the standard survey subfolder structure exists inside a project folder.
 * Returns an object with all folder IDs.
 */
export async function ensureSurveyFolders(projectFolderId, driveId) {
  const folders = {};

  folders.floorPlans = await getOrCreateFolder('Floor Plans', projectFolderId, driveId);
  folders.mappedInMaps = await getOrCreateFolder('MappedIn Maps', projectFolderId, driveId);
  folders.cameraPlacementsFolder = await getOrCreateFolder('Camera Placements', projectFolderId, driveId);
  folders.surveys = await getOrCreateFolder('Surveys', projectFolderId, driveId);
  folders.photos = await getOrCreateFolder('photos', folders.surveys, driveId);
  folders.finalPlacements = await getOrCreateFolder('Final Placements', projectFolderId, driveId);

  return folders;
}

// ─── FILES ───

/**
 * List files (non-folders) inside a parent folder.
 */
export async function listFiles(parentId, driveId, mimeTypeFilter) {
  let q = `'${parentId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  if (mimeTypeFilter) {
    q += ` and mimeType='${mimeTypeFilter}'`;
  }

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,size,createdTime)',
    orderBy: 'name',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'drive',
    driveId,
  });

  const data = await driveRequest(`${DRIVE_API}/files?${params}`);
  return data.files || [];
}

/**
 * Download a JSON file from Drive.
 */
export async function downloadJsonFile(fileId) {
  const token = getAccessToken();
  if (!token) throw new Error('Not signed in to Google');

  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return res.json();
}

/**
 * Upload a JSON file to a folder on the shared drive.
 * Uses multipart upload for simplicity.
 */
export async function uploadJsonFile(filename, jsonData, parentId) {
  const token = getAccessToken();
  if (!token) throw new Error('Not signed in to Google');

  const metadata = {
    name: filename,
    parents: [parentId],
  };

  const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([jsonString], { type: 'application/json' })
  );

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Upload a photo (base64 data URL) to a folder.
 * Converts the data URL to a blob for upload.
 */
export async function uploadPhoto(filename, dataUrl, parentId) {
  const token = getAccessToken();
  if (!token) throw new Error('Not signed in to Google');

  // Convert data URL to blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  const metadata = {
    name: filename,
    parents: [parentId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob);

  const uploadRes = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Photo upload failed: ${uploadRes.status}`);
  }

  return uploadRes.json();
}
