# Changelog

## 1.0.2 — 2026-10-06

- Keep only the latest eight finished/failed history entries; preserve all active tasks.
- Add clear-history and individual remove-entry buttons without deleting files.
- Trim old history on extension update and popup opening.
- Avoid writing unchanged storage or polling the server on every popup redraw.
- Add regression tests for retention and safe manual cleanup.

## 1.0.1 — 2026-10-04

- Fix duplicate actions in nested YouTube sheet/list menus.
- Repair stale duplicate entries when menus are reused.
- Add a24px SVG download icon to menu entries and20px icon to watch-page buttons.
- Add worker/DOM regression tests and CI.

## 1.0.0 — 2026-10-04

- Add watch-page and first-item card-menu download actions.
- Send downloads through the self-hosted ReClip API.
- Save files to the YouTube download subfolder with Unicode filenames.
- Persist task state and expose a status popup.
