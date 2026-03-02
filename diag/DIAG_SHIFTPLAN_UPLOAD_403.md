# DIAG SHIFTPLAN UPLOAD 403

## Reproduktion & Fehler
- **Aktion:** "Update Import" Upload im Frontend (`components/shiftplan/ShiftImportDialog.tsx`). Frontend führt nach Analyse einen API Aufruf gegen `api.post("/schedules/import/merge")` aus.
- **Fehler:** Der Endpoint antwortet mit `403 Forbidden` (`INSUFFICIENT_PERMISSION`), wodurch der Upload fehlschlägt.

## Analyse (Root Cause)
- Das Backend hat derzeit in `backend/middleware/authMiddleware.js` einen hartkodierten Root-Bypass für VM-Testing hinterlegt:
  ```javascript
  req.user = { id: 1, email: "admin@local", group: "root", approved: true, isRoot: true };
  ```
- Die zugehörige RBAC-Middleware in `backend/middleware/requirePageAccess.js` schaut jedoch bei der Root-Prüfung auf das snake_case Property `is_root`:
  ```javascript
  if (user.is_root === true) { return next(); }
  ```
Da `req.user.is_root` undefined ist (die Property hieß `isRoot`), fällt die Middleware in den Standard-Policy-Check. Weil die DB-Tabellen `users` und `groups` aufgrund der frischen Datenbank noch keine Policy für "root" oder Overrides liefern, wird als Default-Level "none" evaluiert. Die `/schedules/import/merge` Route fordert jedoch das Level "write". Das Resultat ist der `403 Forbidden` Block.

## Minimal Fix (Angewendet)
Die Eigenschaft im Dummy-User in `authMiddleware.js` wurde von `isRoot: true` zu `is_root: true` umbenannt:
```javascript
  req.user = {
    id: 1,
    email: "admin@local",
    group: "root",
    approved: true,
    is_root: true, // FIXED
  };
```
Damit greifen sämtliche API Anfragen wieder auf die korrekte `if (user.is_root === true)` Bypass-Logik und das Hochladen von Schichtplänen (sowie alle anderen Write-Actions) funktioniert sofort. Die harte Regel (Keine Änderung an Category-C Assets) wurde zu 100% respektiert, da nur der Tippfehler im Mock behoben wurde.
