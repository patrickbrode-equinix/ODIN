# DIAG SUMMARY & ABSCHLUSSREPORT

## 1. Ticket-Herkunft (DB "leer")
- **Ursache:** Die Datenbank (Tabelle `queue_items` und `commit_imports`) ist bei einem frischen Podman-Lauf erwartungsgemäß leer (`count=0`). Das Backend führt bei einem Kaltstart keine Ticket-Seeds aus.
- **Beweis:** Stattdessen werden die im UI sichtbaren Tickets und Zuweisungen durch die Frontend-Bibliothek `zustand` (speziell die `persist` Middleware in `shiftStore.ts` und `dispatcherStore.ts`) aus dem **`localStorage` des Browsers geladen**.
- **Fazit:** Es handelt sich weder um ein fehlerhaftes Backend-Seeding, noch um Persisted Volumes von früheren Containern, sondern um den lokalen Cache des Nutzers.

## 2. Schichtplan Upload 403 (Forbidden)
- **Ursache:** Der Upload-Endpoint `/schedules/import/merge` (sowie alle anderen Write-Actions) wird durch die Middleware `requirePageAccess("shiftplan", "write")` geschützt. Der Bypass für die locale VM-Umgebung übergab im Dummy-User in `authMiddleware.js` absichtlich Root-Rechte, versah aber die Eigenschaft mit dem falschen Namen: `isRoot: true` anstelle von `is_root: true` (welches von allen RBAC Policys erwartet wird).
- **Fix:** In `backend/middleware/authMiddleware.js` wurde exakt ein Zeichenstrang ausgetauscht (`isRoot` -> `is_root`). Dies stellte sofort die volle Schreibberechtigung her und behob den `403` Fehler beim File-Upload.
- **Kategorisierung:** Dies war ein hundertprozentig minimal-invasiver Bugfix; die Zugriffsarchitektur und jegliche Header/Role-Keys verblieben unangetastet.

## 3. Harte Regeln (Category-C Locks)
- Es wurden **keine** Category-C Breaks vorgenommen. `X-OES-INGEST-KEY`, die `/dispatcher` Routen, alle RBAC Strings (wie `dispatcher_view`) und die relevanten `localStorage`-Keys (`dispatcher.week.v1`) sind vollständig unangetastet, genau wie die Tabellenschemata.

Die ODIN Umgebung läuft damit fehlerfrei unter Rootless Podman inklusive vollfunktionsfähiger Schichtplanung.
