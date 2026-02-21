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
      byFloor[floorId] = [];
    }
    byFloor[floorId].push(cam);
  });

  // Within each floor, group by room
  const floors = Object.entries(byFloor).map(([floorId, floorCameras]) => {
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

    return {
      floorId,
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
        roomName: room.name,
        cameras: room.cameras.map((cam) => ({
          ...cam,
          // These will be updated by the technician
          newLatitude: null,
          newLongitude: null,
          repositioned: false,
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
