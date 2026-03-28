# django-qlab v0.3.0

## Highlights

- Added a packaged React + TypeScript QLab UI that ships inside the Django app
- Added saved queries, query history and per-user QLab settings models
- Added bundled API endpoints for bootstrap, metadata, query execution, saved queries and history
- Added a local consumer test project for package-level integration testing
- Improved metadata performance for large model graphs through caching and lighter query-builder metadata

## Frontend

- Query builder with nested filter groups
- CSV export and JSON copy from query results
- Models browser with field and relation inspection
- Saved queries management and replay flows
- History tab with replay and save-from-history actions
- Light/dark mode and packaged docs/settings views

## Backend

- New persistence models:
  - `QLabUserSettings`
  - `SavedQuery`
  - `QueryRunHistory`
- Packaged API endpoints exposed under `qlab.urls`
- Caching for metadata and bootstrap model index
- Safer metadata defaults for large, highly connected apps

## Packaging

- Bundled frontend assets are included in the Python package
- Added release scripts for preparing GitHub/PyPI releases
- Added pre-commit with Python and frontend checks

## Upgrade notes

- Consumers should install the finished package and mount `qlab.urls`
- No separate frontend dev server is required for consumers
- If you subclass QLab views or API viewsets for auth/scoping, re-test those integrations against the new packaged endpoints
