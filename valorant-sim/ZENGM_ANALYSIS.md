# Zengm Branch Analysis & Port Map (Valorant Sim)

This document summarizes the zengm/moba patterns available in this branch and how they are being adapted into the Valorant sim codebase.

## 1) Reference projects scanned

- `moba/src/js/worker/views/schedule.js`
  - Split "upcoming" and "completed" game list flows.
  - Incremental update behavior on sim ticks.
- `moba/src/js/worker/views/bansPicks2.js`
  - Phase/state-oriented sequencing pattern (draft analog).
- Existing Valorant modules already using similar patterns:
  - `src/ui/tableUtils.js` (shared sort/pagination utilities)
  - `src/core/matchSimBo3.js` (phased veto + map progression)
  - `src/ui/pages/career.js` (table shells and partial rerendering)

## 2) Core zengm elements merged/adapted

- **Stateful sortable/paginated tables**
  - Reused generic table-state pattern with persistent sort/page state and body-only rerender.
- **Phase-based pregame flow**
  - BO3 veto represented as explicit phases and legal action list.
- **Schedule UX split**
  - Distinct schedule views for team-centric matches vs event/tournament listing.
- **Player-page tab structure**
  - Summary-first tab flow with grouped sub-sections.

## 3) Ratings data externalization (requested)

- Added JSON-driven per-player ratings override file:
  - `src/data/playerRatings.json`
- Wired import path so seed players can be edited by name without code edits:
  - `src/core/database.js` maps overrides onto parsed seed players.
  - `src/core/generator.js` applies override values into generated attributes.

## 4) Database archive note

- Requested source `correct database.rar` was not found in the workspace.
- Current implementation keeps using the in-branch seed text DB and now layers JSON overrides on top.
- If you add that archive to the repo, we can wire an importer to consume it directly.

## 5) Next-step integration plan (if desired)

1. Add/import the actual `correct database.rar` payload (or extracted JSON/CSV).
2. Replace inline player text source with file-based loader.
3. Keep `playerRatings.json` as hot-edit override layer for balancing.
4. Continue migrating standings/history pages toward zengm parity components.
