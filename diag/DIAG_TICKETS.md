# DIAG TICKETS (Herkunft der Daten)

## Untersuchung der Datenbank (PostgreSQL)
Ein direkter SQL-Query auf die relevanten Tabellen im Backend lieferte folgendes Ergebnis:
- `SELECT count(*) FROM queue_items;` -> **0**
- `SELECT count(*) FROM commit_imports;` -> **0**
Die Datenbank ist bezüglich der Tickets und des Ingest-States **vollständig leer**.

## Untersuchung des Backends (Seeding & Startup)
Das Skript `backend/db/initSchema.js` wurde geprüft. Es legt die Tabellenstruktur an und seedet lediglich essenzielle Stammdaten:
- `employee_groups` (e.g. `dispatcher-console`)
- `rbac_policies`

Es findet **kein** Seeding von Demo-Tickets oder Pseudo-Mitarbeitern beim Backend-Startup statt. Der `X-OES-INGEST-KEY` geschützte Ingest-Endpunkt wurde ebenfalls nicht automatisch aufgerufen.

## Untersuchung des Frontends (Caching / Zustand)
Ein Scan der Frontend-Sourcen (`frontend/src/store`) zeigt intensiven Gebrauch der `zustand/middleware` -> `persist`:
- `shiftStore.ts` (Persistiert globale Schichtpläne)
- `dispatcherStore.ts` (Persistiert `dispatcher.week.v1` State inkl. zugewiesener Tickets)

## Fazit: Hypothese H4 bestätigt
Die im UI sichtbaren Tickets und Zuweisungen stammen **ausschließlich aus dem lokalen Caching (localStorage)** des Browsers des Nutzers, welches vom Zustand-Store (via `persist`) nach dem Page-Reload rehydriert wird. Die eigentliche Applikations-Datenbank (Postgres Volume) ist im frischen Zustand leer.

Eine Leerung der Tickets würde einen manuellen Clear des LocalStorage (`localStorage.clear()`) im Browser des Nutzers verlangen. (Gemäß der harten Regeln wird an den Persist-Keys keine Änderung vorgenommen).
