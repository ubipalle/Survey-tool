# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2025-02-21

### Added
- Camera repositioning now includes optional reason field
- Upload `camera-placements-updated_{date}.json` to GDrive with updated coordinates
- Camera changes section in survey JSON (original/new coords, distance moved, reason)
- Camera Repositioning Log card in review screen

## [0.3.0] - 2025-02-21

### Added
- Google Drive integration (OAuth2, browser-based, Workspace internal)
- Browse and select customer project from "Customer projects" shared drive
- Auto-create subfolder structure (Floor Plans, MappedIn Maps, Camera Placements, Surveys, Final Placements)
- Auto-load camera placement JSON from project's Camera Placements folder
- Warning with retry when no camera file found in project folder
- Upload survey JSON + photos to GDrive on submission
- Paginated folder listing supporting 200+ projects
- Project search/filter in setup screen
- Step indicators (numbered circles with checkmarks) in setup flow
- Clickable incomplete rooms in review screen — jump directly to room survey
- Clickable completed rooms in review screen for editing
- Prominent "Back to Room List" button in review screen
- Google user avatar and sign-out in header

### Changed
- Setup flow restructured: Sign in → Select project → Auto-load cameras → Enter MappedIn creds → Start
- Review screen: GDrive upload is now primary action, JSON download is secondary
- Manual camera JSON upload only shown when not connected to GDrive

## [0.2.0] - 2025-02-21

### Changed
- Redesigned survey view for mobile — removed split map/form layout
- Survey is now form-first with full-screen scrollable content
- Camera repositioning moved to a dedicated full-screen modal
- UI redesigned to light theme matching main application design system
- Font switched to Plus Jakarta Sans
- Accent color updated to warm gold (#d4a843)

### Added
- `RepositionModal.jsx` — full-screen map overlay for repositioning cameras
- Camera cards in survey view showing mount type, height, and reposition button

### Fixed
- Camera markers now visible on MappedIn map (using correct SDK APIs)
- `mapView.createCoordinate()` used instead of plain objects
- `Markers.add()` now receives HTML string instead of DOM element
- Floor matching with fallback logic (exact → partial → suffix → first floor)

## [0.1.0] - 2025-02-21

### Added
- Initial project scaffolding (React + Vite)
- MappedIn JS SDK v6 integration with Maker credentials
- Setup screen: API key, secret, map ID, camera JSON upload
- Camera JSON parsing and grouping by floor/room
- Room list with floor tabs and progress tracking
- Survey form: ceiling height, power outlets, mounting surface, network, obstructions, notes
- Photo capture with camera/gallery support and category labels
- Review screen with summary stats and JSON export
- Auto-save to localStorage
- Dark theme, mobile-first responsive design
