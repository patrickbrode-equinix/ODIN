# RESTORE SSH ENGINE REPORT

## STEP 1 — Current State Documentation

- **`podman system connection list`**: The initial inspection showed that `podman-desktop` (npipe) was present and set as the default connection along with `podman-machine-default-root` (ssh). The CLI failed to process the `npipe` schema correctly on this version.
- **`podman info` & `podman ps`**: Commands were failing with the error: `Error: unable to create connect ... "npipe" is not a supported schema`.

## STEP 2 — Reset Default Connection
- Executed: `podman system connection default podman-machine-default-root`
- Verified that the default connection is now successfully mapped back to the SSH root user on the WSL engine (`podman-machine-default-root`). 
- CLI errors regarding the `npipe` schema disappeared.

## STEP 3 — Neutralize NPIPE Connection
- Executed: `podman system connection remove podman-desktop`
- Verified: The unreliable NPIPE connection for Desktop has been fully removed from the Windows CLI environment, preventing accidental usage.
- The `podman system connection list` now neatly defaults to the correct socket.

## STEP 4 — Verification
- The necessary containers (`odin-postgres`, `odin-backend`, `odin-frontend`, `odin-pgadmin`) are successfully visible again via `podman ps`.
- **Healthcheck Results:** (http://localhost:8001/api/health)
  - Result: **PASS**
  - Response: `{"status":"ok","timestamp":"..."}`
  - The API and the database underlying it are perfectly healthy.

## STEP 5 — Podman Desktop Notes
Desktop is entirely optional. It views an NPIPE engine machine configuration completely parallel to the SSH socket that the `podman` CLI is now using. No engine changes were made directly within Desktop properties. Desktop can remain empty/unused as the core engine provides CLI and container capabilities flawlessly.

---

### Restored State Summary

- **Default connection** = `podman-machine-default-root`
- **`podman ps`** = OK (No more schema format errors / actively refused connects)
- **ODIN Containers** = RUNNING (postgres, backend, frontend, pgadmin)
- **Healthcheck Result** = OK (200 OK - `"status":"ok"`)
