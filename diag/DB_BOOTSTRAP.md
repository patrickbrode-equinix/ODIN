# DB BOOTSTRAP RELIABILITY

Die Analyse des Backend-Startup-Flows (`server.js` + `initSchema.js`) und der Compose Files zeigt ein extrem robustes Design:

## 1. Vermeidung von Race Conditions (Compose Ebene)
Sowohl `docker-compose.yml` als auch `podman-compose.yml` deklarieren einen starken Healthcheck auf der Postgres-Datenbank (`pg_isready -U postgres -d odin`).
Das Backend hat in `depends_on` die Direktive:
```yaml
    depends_on:
      postgres:
        condition: service_healthy
```
**Dadurch ist garantiert:** Das Backend wird von der Container-Runtime erst dann hochgefahren, wenn der Postgres-Container nicht nur "running", sondern fertig initialisiert und verbindungsbereit ist. Eine Race Condition beim Kaltstart mit einem leeren Volume (Fresh Start) ist somit ausgeschlossen.

## 2. Abgesichertes `initSchema` (Applikations-Ebene)
In `server.js` wird vor dem Call von `initSchema()` explizit die Methode `testConnection()` angerufen.
```javascript
  const dbOk = await testConnection();

  if (!dbOk) {
    console.error("!! [STARTUP] DB Connection Failed. Server starting in DEGRADED mode.");
  } else {
    // 2. Init Schema only if DB ok
    await initSchema();
  }
```
Selbst wenn die Datenbank asynchron nicht erreichbar wäre, stürzt das Backend nicht ab, sondern startet im "DEGRADED" Modus. Die Schema-Erstellung mittels `initSchema.js` enthält durchgehend `IF NOT EXISTS` Blöcke, was bedeutet, dass sie jederzeit völlig idempotent und gefahrlos mehrfach ausgeführt werden kann.

**Fazit:** Der Bootstrap-Fluss ist bereit für Production und benötigt keine weiteren künstlichen "Sleeps" oder Retry-Loops innerhalb von Node.js.
