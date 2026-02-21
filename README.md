# Site Survey Tool

A mobile-first Progressive Web App for conducting on-site camera placement surveys, integrating MappedIn indoor maps with survey data collection.

## Overview

This tool allows field technicians to:
1. View indoor maps with pre-placed camera positions (via MappedIn)
2. Walk room-by-room through a building
3. Verify and adjust camera placements directly on the map
4. Capture survey data (ceiling height, power outlets, mounting surface, etc.)
5. Take photos documenting each camera location
6. Export the completed survey for review

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Setup

### MappedIn Credentials
You'll need:
- **API Key** (starts with `mik_` for Maker accounts)
- **API Secret** (starts with `mis_`)
- **Map ID** — found in MappedIn Maker under the Developers tab

### Camera Placement JSON
Upload a JSON file with the following structure:

```json
{
  "cameras": [
    {
      "id": "camera_001",
      "name": "Lobby Camera 1",
      "room": "Main Lobby",
      "mountType": "wall-mount-wide",
      "latitude": 50.8532,
      "longitude": 4.3542,
      "rotation": 330,
      "fieldOfView": 84,
      "range": 20,
      "height": 2.5,
      "tilt": -30,
      "floorId": "m_9be42638b45b80e8"
    }
  ]
}
```

**Important:** Add a `"room"` field to each camera to group cameras by room.

## Architecture

```
src/
├── App.jsx                  # Main app state & screen routing
├── main.jsx                 # Entry point
├── styles.css               # Global styles
├── components/
│   ├── SetupScreen.jsx      # Credentials & camera JSON upload
│   ├── SurveyShell.jsx      # Floor tabs + room list + navigation
│   ├── SurveyView.jsx       # Map + form for a single room
│   ├── MapViewer.jsx         # MappedIn SDK integration
│   ├── SurveyForm.jsx        # Survey data fields
│   ├── PhotoCapture.jsx      # Camera/gallery photo capture
│   └── ReviewScreen.jsx      # Review & export
└── utils/
    ├── cameraData.js         # Parse & group camera JSON
    └── storage.js            # Local storage + export utilities
```

## Workflow

1. **Setup** — Enter MappedIn credentials, upload camera placement JSON, name the site
2. **Survey** — Select floor → Select room → View map with camera(s) → Fill survey form → Capture photos → Mark complete → Next room
3. **Review** — See summary stats, room-by-room breakdown, export JSON

## Phase 2 (Planned)

- **AWS S3 Integration** — Upload photos via presigned URLs
- **HubSpot Custom Objects** — Push survey data as custom object records linked to deals/companies
- **Offline Support** — Full PWA with service worker for offline-first operation
- **PDF Report Generation** — Auto-generate PDF survey reports

## Tech Stack

- **React 18** + Vite
- **MappedIn JS SDK v6** — Indoor map rendering
- **LocalStorage** — Survey progress persistence (IndexedDB in production)

## Browser Support

Optimized for mobile browsers (Chrome, Safari) on iOS and Android.
Works on desktop browsers for office review.
