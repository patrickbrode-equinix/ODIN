# Repository Cleanup Report

As part of reducing technical debt and removing unused files, the following cleanup actions were taken. All deletions were verified against Dockerfiles, `compose` configs, `package.json` scripts, and source imports to ensure no breaking changes.

## Deleted Items

| Path | Description | Reason & Verification |
| :--- | :--- | :--- |
| `frontend/dist/` | Vite build output directory. | **Reason:** Generated artifact. Recreated on `npm run build`.<br>**Verified:** `dist` is already ignored in `.gitignore`. |
| `node_modules/` (Root) | Dependencies for root `package.json`. | **Reason:** Generated artifact. Recreated via `npm ci`. Not pushed to Git anyway. |
| `frontend/node_modules/` | Frontend dependencies. | **Reason:** Generated artifact. Recreated via `npm ci` before building. |
| `backend/node_modules/` | Backend dependencies. | **Reason:** Generated artifact. Recreated via `npm ci`. |
| `scripts/apply_schema.js` | Helper script to apply the DB schema. | **Reason:** Never referenced by any other script, `package.json`, or Compose file. Redundant since `server.js` automatically calls `initSchema.js`. |
| `scripts/` (Folder) | Directory containing helper scripts. | **Reason:** Became empty after removing `apply_schema.js`. |
| `backend/test.js`, `backend/test_*.js` | Miscellaneous test scripts (`test_api_internal.js`, `test_fallback.js`, `test_tt.js`). | **Reason:** Ad-hoc scripts that are completely unreferenced in the application code, Tests or Compose setup. |
| `backend/test_payload.json` | Local JSON dump for testing. | **Reason:** Unused static artifact. |
| `backend/fix_db.js` | One-off script to manually execute a SQL update statement. | **Reason:** Unused script that hardcodes an obsolete SQL update. Not imported or used in the lifecycle. |

## .gitignore Status
The root `.gitignore` was reviewed. Standard Node/React artifacts (`dist`, `node_modules`, `*.log`, `coverage`, `.env`) are already included in the ignore rules securely. No changes to `.gitignore` were necessary.

## Validation Performed
The cleanup was validated by running the following processes:
1. `npm ci && npm run build` in `frontend/`
2. `npm ci` in `backend/`
3. `docker compose build` at the root directory to confirm Docker context is intact.
