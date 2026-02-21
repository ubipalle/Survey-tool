# Site Survey Tool — Backlog

Prioritized list of features, improvements, and bugs.
Status: `[ ]` = to do, `[x]` = done, `[~]` = in progress

---

## ✅ Completed

- [x] Project scaffolding (React + Vite)
- [x] MappedIn SDK integration (Maker credentials, map loading)
- [x] Camera marker placement from JSON
- [x] Room-by-room survey flow (floor tabs, room list, navigation)
- [x] Survey form (ceiling height, power outlets, mounting surface, network, obstructions, notes)
- [x] Photo capture (camera + gallery upload, categorized labels)
- [x] Camera repositioning via full-screen map modal
- [x] Survey progress tracking (completed/pending per room)
- [x] Local JSON export of survey data
- [x] Mobile-first form layout
- [x] UI redesign — light theme matching main application design system
- [x] Google Drive authentication (OAuth2, browser-based, Workspace internal)
- [x] Browse & select customer project folder from shared drive
- [x] Auto-create subfolder structure (Floor Plans, Camera Placements, Surveys, etc.)
- [x] Auto-load camera placement JSON from GDrive project folder
- [x] Upload survey results (JSON + photos) to GDrive
- [x] Paginated folder listing (supports 200+ project folders)
- [x] Camera repositioning reason field (optional)
- [x] Upload updated camera placements file to GDrive (preserves camera IDs)
- [x] Camera changes tracking in survey JSON (original/new coords, distance, reason)
- [x] Clickable incomplete rooms in review screen to jump back and complete
- [x] Camera repositioning log in review screen

---

## 🔜 Up Next

### P0 — Core Functionality

- [ ] **Clean up unused MapViewer.jsx**
  RepositionModal now handles all map rendering. Remove or archive MapViewer.

- [ ] **Form validation**
  Require minimum fields before allowing mark-as-complete.

- [ ] **Multi-floor / multi-room testing**
  Test with a realistic dataset (50+ cameras, multiple floors).
  Verify floor switching and room grouping work correctly.

- [ ] **Floor tab labels**
  Show human-readable floor names instead of raw floorId suffixes.

### P1 — HubSpot Ticket Integration

- [ ] **HubSpot authentication**
  Set up private app token or OAuth for HubSpot API access.

- [ ] **Create HubSpot ticket on survey completion**
  When a survey is uploaded to GDrive, auto-create a ticket for the
  customer success team containing:
  - Customer/site name
  - Link to survey results in GDrive
  - Summary stats (rooms surveyed, cameras repositioned, photos)
  - Assigned to CS pipeline

- [ ] **Update ticket with GDrive links**
  Attach direct links to the survey JSON and photo folder
  so CS team can access everything from the ticket.

### P2 — Mobile & Offline

- [ ] **PWA manifest + service worker**
  Make app installable on mobile home screens.
  Cache app shell for offline loading.

- [ ] **Offline data persistence**
  Switch from localStorage to IndexedDB (via localforage) for large photo storage.
  Queue submissions for when connectivity returns.

- [ ] **Auto-save indicator**
  Show save status in the UI (Saved / Saving / Offline).

### P3 — Reporting & Polish

- [ ] **PDF survey report generation**
  Auto-generate a per-site PDF with room photos, survey data, camera positions.

- [ ] **Survey resume / load previous**
  Allow technicians to resume an incomplete survey from a previous session.

- [ ] **Camera field-of-view overlay on map**
  Show FOV cone on the reposition modal using camera rotation + fieldOfView data.

- [ ] **Technician identification**
  Capture who performed the survey (name, email) for attribution.
  Could auto-fill from Google account when signed in.

- [ ] **Map caching**
  Cache mapData when RepositionModal opens to avoid reloading from scratch each time.

---

## 🔮 Future — Agent Pipeline (Placeholders)

These items describe the eventual automated end-to-end pipeline.
They are not yet scoped for implementation.

- [ ] **Agent: Detect new floor plans in GDrive**
  Watch for new files in a customer's `Floor Plans/` folder.
  Trigger map creation workflow.

- [ ] **Agent: Auto-create MappedIn maps from floor plans**
  Use MappedIn API (TBD — needs research into available endpoints)
  to programmatically create maps from uploaded floor plans.

- [ ] **Agent: Notify presales for camera placement**
  After maps are created, notify the presales team
  (via email/Slack/Google Chat) to perform initial camera placement.

- [ ] **Agent: Generate survey for site**
  Once camera placement is complete, auto-configure the survey tool
  with the correct map ID and camera JSON.

- [ ] **Agent: Notify CS team for final review**
  After survey is uploaded, trigger notification to customer success
  to finalize camera placements before installation.

- [ ] **Final placement review tool**
  A separate application for the CS team to review survey data
  alongside the MappedIn map and adjust camera placements.

---

## 🐛 Known Issues

- [ ] Map reloads from scratch each time RepositionModal opens (could cache mapData)
- [ ] Floor tab labels show raw floorId suffix — should show human-readable names
- [ ] No validation on survey form — technician can mark complete without filling anything
- [ ] Google token expires after 1 hour — no automatic refresh (user must sign in again)

---

## 💡 Ideas

- Barcode/QR scanning for room identification
- Voice-to-text for notes field
- Automatic room detection via MappedIn spaces
- Bulk photo upload from camera roll after survey
- Comparison view: before/after camera repositioning
- Google Sheets summary dashboard per customer
- Slack/Google Chat notifications when survey is uploaded
- Dark mode toggle for low-light conditions on site
