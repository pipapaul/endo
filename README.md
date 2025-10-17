# EndoTrack

EndoTrack ist eine statisch exportierbare Next.js-App zum lokalen Tracking von Endometriose-Symptomen.

## Entwicklung

1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
2. Entwicklungsserver starten:
   ```bash
   npm run dev
   ```
   Die App ist anschließend unter http://localhost:3000 erreichbar.

## Statischer Export für FTP-Hosting

Da das Projekt in `next.config.mjs` auf `output: 'export'` konfiguriert ist, erstellt Next.js beim Exporten eine komplett statische Version der Seite. Diese kann direkt per FTP auf einen beliebigen Webspace geladen werden.

```bash
npm run export
```

Der Befehl legt die fertigen Dateien im Verzeichnis `out/` ab. Der gesamte Ordner kann ohne zusätzliche Build-Schritte hochgeladen werden. Eine Server-seitige Laufzeitumgebung ist nicht erforderlich.

## Technologien

- Next.js 14 mit App Router
- React 18
- Tailwind CSS für das Styling
- Recharts für Diagramme
- Lokale Persistenz via IndexedDB (Offline-First)
- Service Worker für App-Shell-Caching
- PWA Manifest & Installierbarkeit

## Migration auf IndexedDB

Bestehende Installationen, die bislang `localStorage` genutzt haben, migrieren die Daten beim ersten Start automatisch in die neue IndexedDB-Datenbank. Nach erfolgreicher Migration werden die alten `localStorage`-Einträge entfernt. Sollte der Browser keinen Zugriff auf IndexedDB erlauben (z. B. in sehr restriktiven Umgebungen), arbeitet die App weiter mit einem temporären Speicher und blendet einen Warnhinweis ein.
