/**
 * Parse camera placement JSON and group by floor and room.
 */

export function parseCameraData(json) {
  const cameras = json.cameras || [];

  // Group cameras by floorId
  const byFloor = {};
  cameras.forEach((cam) => {
    const floorId = cam.floorId || 'unknown';
    if (!byFloor[floorId]) {
      byFloor[floorId] = {
        cameras: [],
        // Use floorName from camera data if available
        floorName: cam.floorName || null,
      };
    }
    byFloor[floorId].cameras.push(cam);
    // Take the first non-null floorName we find
    if (cam.floorName && !byFloor[floorId].floorName) {
      byFloor[floorId].floorName = cam.floorName;
    }
  });

  // Within each floor, group by room
  const floorEntries = Object.entries(byFloor);
  const floors = floorEntries.map(([floorId, { cameras: floorCameras, floorName }], index) => {
    const byRoom = {};
    floorCameras.forEach((cam) => {
      const room = cam.room || cam.name || `Camera ${cam.id}`;
      if (!byRoom[room]) {
        byRoom[room] = [];
      }
      byRoom[room].push(cam);
    });

    const rooms = Object.entries(byRoom).map(([roomName, roomCameras]) => ({
      name: roomName,
      cameras: roomCameras,
      // Use the first camera's coordinates as room center
      center: {
        latitude: roomCameras[0].latitude,
        longitude: roomCameras[0].longitude,
      },
    }));

    // Derive a human-readable floor name:
    // 1. Use floorName from camera data if provided
    // 2. If only one floor, just "All Rooms"
    // 3. Otherwise "Floor 1", "Floor 2", etc.
    const displayName =
      floorName ||
      (floorEntries.length === 1 ? 'All Rooms' : `Floor ${index + 1}`);

    return {
      floorId,
      floorName: displayName,
      rooms,
      cameraCount: floorCameras.length,
    };
  });

  return {
    floors,
    totalCameras: cameras.length,
    totalRooms: floors.reduce((sum, f) => sum + f.rooms.length, 0),
  };
}

/**
 * Build a flat list of survey items (one per room)
 * Each item contains the room info + empty survey fields
 */
export function buildSurveyItems(parsedData) {
  const items = [];
  let index = 0;

  parsedData.floors.forEach((floor) => {
    floor.rooms.forEach((room) => {
      items.push({
        id: `${floor.floorId}__${room.name}`,
        index: index++,
        floorId: floor.floorId,
        floorName: floor.floorName,
        roomName: room.name,
        cameras: room.cameras.map((cam) => ({
          ...cam,
          // These will be updated by the technician
          newLatitude: null,
          newLongitude: null,
          repositioned: false,
          repositionReason: null,
        })),
        center: room.center,
        // Survey fields
        survey: {
          ceilingHeight: '',
          ceilingHeightUnit: 'meters',
          powerOutletLocation: '',
          mountingSurface: '',
          networkConnectivity: '',
          obstructions: '',
          notes: '',
          photos: [], // Array of { dataUrl, label, timestamp }
          completed: false,
          completedAt: null,
        },
      });
    });
  });

  return items;
}
