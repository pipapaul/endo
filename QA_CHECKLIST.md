# QA-Checkliste

- [x] Writes/Reads auf IndexedDB migriert und lokale Migration von `localStorage` implementiert.
- [x] Einmalige Migration kopiert vorhandene `localStorage`-Daten in IndexedDB und leert Altbestand.
- [x] Persistent Storage wird via `navigator.storage.persisted()` geprüft und bei Bedarf mit `persist()` angefordert.
- [x] UI zeigt Speicherstatus inkl. "dauerhaft aktiv" nur bei erfolgreicher Persistierung sowie Warnungen bei Fallbacks.
- [x] Web App Manifest hinterlegt und Service Worker mit App-Shell-Caching ergänzt.
- [x] Installierbarkeit geprüft und Hinweis "Zum Home-Bildschirm hinzufügen" integriert (inkl. Button für `beforeinstallprompt`).
- [x] Vollständiger Daten-Export als JSON-Backup inklusive Importpfad mit Validierung nach IndexedDB.
- [x] Keepalive-Schreibzug (`lastActiveAt`) bei Nutzerinteraktionen umgesetzt.
- [x] Fehlerbehandlung für IndexedDB-Fälle inkl. sichtbarer Warnung bei fehlendem Persist/IDB.
- [x] Daten bleiben über App-Neustarts, Offline-Modus, iOS Safari & Home-Screen bestehen (durch IndexedDB + Persist-Request).
- [x] Nach „Website-Daten löschen“ initialisiert die App sauber neu (Default-State + Migration).
- [x] Migration verursacht keinen Datenverlust (Validierung vor Persistierung).
