# ODIN Teams Bot — Integration Guide

## Architektur-Übersicht

```
┌──────────┐   /api/internal/*    ┌──────────────┐   card.action   ┌───────────┐
│  ODIN    │  ──────────────────> │  Teams Bot    │ <────────────── │  MS Teams │
│  Backend │ <────────────────── │  (Express +   │  ─────────────> │  Client   │
│          │  /api/teams/callback │   SDK v2)     │   Adaptive Card │           │
└──────────┘                      └──────────────┘                  └───────────┘
```

### Datenfluss

1. **ODIN → Bot** (Proactive Notify): ODIN ruft `POST /api/internal/notify/*` auf → Bot baut Adaptive Card → sendet via SDK an Teams-User
2. **Teams → Bot** (User Action): User klickt Button → `card.action` Event → Bot parsed Payload → `POST /api/teams/callback/*` an ODIN zurück
3. **Conversation References**: Bei jeder Nachricht speichert der Bot die ConversationReference für späteren proaktiven Versand

---

## Projektstruktur

```
teams-bot/odin/
├── app.ts                    # App-Factory (createApp) mit Echo-Handlers + ConvRef-Capture
├── index.ts                  # Bootstrap: Config → Repos → Services → Routes → Start
├── config.ts                 # Microsoft-Auth-Config (bestehend)
├── .env.example              # Umgebungsvariablen-Template
├── src/
│   ├── config/index.ts       # Zentrale Bot-Konfiguration (Env-basiert)
│   ├── utils/logger.ts       # Strukturiertes Logging mit Level-Filter & Redaction
│   ├── models/
│   │   ├── actions.ts        # ACTION_TYPES, Card/Callback/Notify-Payloads
│   │   ├── conversation-ref.ts  # StoredConversationRef, ConversationScope
│   │   └── user-mapping.ts   # UserMapping (ODIN ↔ Teams Identität)
│   ├── repositories/
│   │   ├── conversation-ref.repository.ts  # Interface + InMemory-Impl
│   │   └── user-mapping.repository.ts      # Interface + InMemory-Impl + Seed-Daten
│   ├── services/
│   │   ├── notification.service.ts    # Proaktive Nachrichten (Bot → Teams)
│   │   ├── callback.service.ts        # Aktions-Callback (Bot → ODIN)
│   │   └── conversation-ref.service.ts  # ConvRef-Capture & -Lookup
│   ├── bot/
│   │   └── action-handler.ts          # Adaptive Card Action.Execute Handler
│   ├── cards/
│   │   ├── ticket-assignment.card.ts  # Ticket-Zuweisung Adaptive Card
│   │   ├── shift-open.card.ts         # Unterbesetzung/Schicht-Card
│   │   └── supervisor-approval.card.ts  # Supervisor-Freigabe-Card
│   └── routes/
│       ├── auth.middleware.ts          # API-Key-Auth für interne Endpoints
│       └── internal.routes.ts          # POST /notify/* Endpunkte
```

---

## Umgebungsvariablen

| Variable | Pflicht | Default | Beschreibung |
|----------|---------|---------|--------------|
| `PORT` | Nein | `3978` | Bot-HTTP-Port |
| `NODE_ENV` | Nein | `development` | Umgebung |
| `CLIENT_ID` | Ja | — | Microsoft App ID |
| `CLIENT_PASSWORD` | Ja | — | Microsoft App Password |
| `CLIENT_SECRET` | Nein | — | Bevorzugter Alias für `CLIENT_PASSWORD` |
| `TENANT_ID` | Ja | — | Azure AD Tenant ID |
| `BOT_TYPE` | Nein | `MultiTenant` | Bot-Typ |
| `BOT_INTERNAL_API_KEY` | Ja | — | API-Key für ODIN → Bot Kommunikation |
| `ODIN_CALLBACK_BASE_URL` | Ja | — | ODIN-Backend-URL (z.B. `http://localhost:3001`) |
| `ODIN_SHARED_SECRET` | Ja | — | Shared Secret für Bot → ODIN Callbacks |
| `ENABLE_DIRECT_NOTIFICATIONS` | Nein | `true` | Ticket-Benachrichtigungen aktiviert |
| `ENABLE_GROUP_NOTIFICATIONS` | Nein | `true` | Gruppen-Benachrichtigungen aktiviert |
| `ENABLE_SUPERVISOR_APPROVAL` | Nein | `true` | Supervisor-Freigabe aktiviert |
| `LOG_LEVEL` | Nein | `info` | Log-Level (debug/info/warn/error) |

> Hinweis zur aktuellen Graph-Fallback-Implementierung: Der app-only Pfad braucht fuer `GET /users/{id|upn}` mindestens `User.Read.All`, fuer App-Installationszugriffe `TeamsAppInstallation.ReadWriteForUser.All` und fuer `POST /chats/{chat-id}/messages` app-only `Teamwork.Migrate.All`. `ChatMessage.Send` ist delegiert und `Chat.Create` wird im aktuellen GraphService-Pfad nicht verwendet.

---

## Lokale Entwicklung

```bash
# 1. Abhängigkeiten installieren
cd teams-bot/odin
npm install

# 2. .env konfigurieren
cp .env.example .env
# → Werte eintragen (BOT_INTERNAL_API_KEY, ODIN_CALLBACK_BASE_URL, etc.)

# 3. Bot starten (Dev-Modus)
npm run dev:teamsfx:playground
# oder direkt:
npm run dev
```

---

## API-Endpunkte (Intern)

Alle internen Endpunkte erfordern den Header:
```
X-Bot-Api-Key: <BOT_INTERNAL_API_KEY>
```

### POST /api/internal/notify/ticket

Ticket-Zuweisung an einen Mitarbeiter senden.

```bash
curl -X POST http://localhost:3978/api/internal/notify/ticket \
  -H "Content-Type: application/json" \
  -H "X-Bot-Api-Key: YOUR_API_KEY" \
  -d '{
    "employeeId": "emp-001",
    "ticketId": "TKT-12345",
    "ticketType": "Incident",
    "priority": "high",
    "systemName": "SAP-PROD",
    "accountName": "Kunde A",
    "remainingMinutes": 45,
    "reason": "Automatische Zuweisung durch ODIN"
  }'
```

### POST /api/internal/notify/shift-open

Unterbesetzungs-Benachrichtigung an Kanal/Gruppe senden.

```bash
curl -X POST http://localhost:3978/api/internal/notify/shift-open \
  -H "Content-Type: application/json" \
  -H "X-Bot-Api-Key: YOUR_API_KEY" \
  -d '{
    "shiftId": "SHIFT-2025-06-02-N",
    "title": "Nachtschicht unterbesetzt",
    "startAt": "2025-06-02T22:00:00Z",
    "endAt": "2025-06-03T06:00:00Z",
    "location": "DC-Frankfurt",
    "requiresSupervisorApproval": true
  }'
```

### POST /api/internal/notify/supervisor-approval

Supervisor-Freigabe-Anfrage senden.

```bash
curl -X POST http://localhost:3978/api/internal/notify/supervisor-approval \
  -H "Content-Type: application/json" \
  -H "X-Bot-Api-Key: YOUR_API_KEY" \
  -d '{
    "entityId": "SWAP-001",
    "entityType": "shift_swap",
    "employeeName": "Max Mustermann",
    "shiftLabel": "Nachtschicht",
    "startAt": "2025-06-03T22:00:00Z",
    "endAt": "2025-06-04T06:00:00Z",
    "supervisorEmployeeId": "emp-003",
    "reason": "Familiärer Termin"
  }'
```

### GET /api/internal/health

Health-Check (kein API-Key erforderlich).

```bash
curl http://localhost:3978/api/internal/health
```

Antwort:
```json
{
  "status": "ok",
  "service": "odin-teams-bot",
  "timestamp": "2025-06-02T12:00:00.000Z",
  "features": {
    "directNotifications": true,
    "groupNotifications": true,
    "supervisorApproval": true
  }
}
```

---

## Callback-Endpunkte (ODIN-seitig zu implementieren)

Der Bot sendet User-Aktionen als POST-Requests an ODIN:

| Endpoint | Header | Trigger |
|----------|--------|---------|
| `POST /api/teams/callback/ticket-action` | `X-ODIN-Bot-Secret` | User klickt Übernehmen/Ablehnen/Rückfrage |
| `POST /api/teams/callback/shift-action` | `X-ODIN-Bot-Secret` | User klickt Schicht übernehmen/ablehnen |
| `POST /api/teams/callback/supervisor-action` | `X-ODIN-Bot-Secret` | Supervisor klickt Freigeben/Ablehnen |

### Beispiel Callback-Payload (Ticket-Aktion)

```json
{
  "action": "ticket.accept",
  "ticketId": "TKT-12345",
  "employeeId": "emp-001",
  "teamsUserId": "29:1abc...",
  "aadObjectId": "aad-001",
  "displayName": "Max Mustermann",
  "timestamp": "2025-06-02T12:05:00.000Z"
}
```

---

## Adaptive Card Actions

| Verb | Aktion | Kontext |
|------|--------|---------|
| `ticket.accept` | Ticket übernehmen | Ticket-Zuweisung |
| `ticket.reject` | Ticket ablehnen | Ticket-Zuweisung |
| `ticket.question` | Rückfrage stellen | Ticket-Zuweisung |
| `shift.accept` | Schicht übernehmen | Unterbesetzung |
| `shift.reject` | Schicht ablehnen | Unterbesetzung |
| `supervisor.approve` | Freigabe erteilen | Supervisor-Freigabe |
| `supervisor.reject` | Freigabe ablehnen | Supervisor-Freigabe |

---

## Conversation Reference Handling

- **Automatisch**: Bei jeder Nachricht an den Bot wird die `ConversationReference` gespeichert
- **Scope-Erkennung**: `personal`, `groupChat`, `channel` — automatisch aus der Activity abgeleitet
- **Proaktiv**: Für proaktive Nachrichten wird die gespeicherte Referenz genutzt
- **Voraussetzung**: User muss mindestens einmal mit dem Bot interagiert haben, bevor proaktive Nachrichten zugestellt werden können

---

## Migration auf PostgreSQL

Die Repositories sind als Interfaces (`IConversationRefRepository`, `IUserMappingRepository`) definiert. Für Produktionsbetrieb:

1. Implementiere `PgConversationRefRepository` und `PgUserMappingRepository`
2. Ersetze die `InMemory*`-Instanzen in `index.ts`
3. Tabellen-Schema:

```sql
CREATE TABLE bot_conversation_refs (
  key          TEXT PRIMARY KEY,
  aad_object_id TEXT,
  upn          TEXT,
  display_name TEXT,
  scope        TEXT NOT NULL CHECK (scope IN ('personal', 'groupChat', 'channel')),
  reference    JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bot_user_mappings (
  employee_id  TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email        TEXT NOT NULL,
  teams_user_id TEXT,
  aad_object_id TEXT,
  upn          TEXT,
  enabled      BOOLEAN DEFAULT true
);

CREATE INDEX idx_conv_ref_aad ON bot_conversation_refs(aad_object_id);
CREATE INDEX idx_conv_ref_scope ON bot_conversation_refs(scope);
CREATE INDEX idx_user_map_aad ON bot_user_mappings(aad_object_id);
CREATE INDEX idx_user_map_email ON bot_user_mappings(email);
```

---

## Fehlerbehebung

| Problem | Mögliche Ursache | Lösung |
|---------|-------------------|--------|
| `401` auf `/api/internal/*` | Falscher oder fehlender API-Key | `X-Bot-Api-Key` Header prüfen |
| `422` auf `/notify/ticket` | Kein User-Mapping oder fehlende ConvRef | User muss Bot zuerst anschreiben |
| Callback an ODIN schlägt fehl | ODIN nicht erreichbar oder falsches Secret | `ODIN_CALLBACK_BASE_URL` und `ODIN_SHARED_SECRET` prüfen |
| Bot antwortet nicht | Port-Konflikt oder fehlende Env-Vars | Logs prüfen, `.env` validieren |
| Card-Buttons ohne Reaktion | `card.action` Handler nicht registriert | Neustart, Logs auf Fehler prüfen |
