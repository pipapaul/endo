# EndoTrack – Endometriose Tagebuch

Mobil-first Next.js-App für ein validiertes, offline-fähiges Endometriose-Tracking. Alle Daten bleiben lokal (IndexedDB, optional AES-GCM). Die App unterstützt Schnell- und Detailmodus, PDF-Exporte, PWA-Installation sowie deutschsprachige Mikrocopy.

## Schnellstart

```bash
npm install
npm run dev
```

Die Anwendung läuft anschließend unter http://localhost:3000. Für den Produktionsbuild:

```bash
npm run build
npm run start
```

Da `next.config.mjs` weiterhin `output: 'export'` nutzt, kann alternativ `npm run export` verwendet werden, um eine statische Variante im Ordner `out/` zu generieren.

## Architektur

- **App Router (Next.js 14)** mit clientseitiger State-Maschine (XState) für die Flow-Steuerung.
- **Dexie** als IndexedDB-Abstraktion inkl. Migrationen und optionaler AES-GCM-Verschlüsselung via WebCrypto.
- **React-Komponenten** für NRS, PBAC, Body-Map, Symptome, Medikation, Schlaf, Bristol, EHP-5, Trend-Charts, PDF-Export u. v. m.
- **PWA**: Manifest, Service Worker, Offline-Cache & Installierbarkeit.
- **Charts** via Recharts (Sparkline, Heatmap, Zyklus-Overlay, Radar).
- **PDF**-Generierung mit `pdf-lib` (Arzt-Kurzbrief, PBAC-Blatt, Timeline 6 Monate).
- **Tests** (Vitest + Testing Library) für Kernlogik (PBAC, NRS-A11y, EHP-5, Korrelationen).

## Datenschutz & Sicherheit

- Daten bleiben lokal (Standard: unverschlüsselt, optional AES-GCM mit Passphrase/PIN).
- "Panik-Löschen" leert die Datenbank und lädt die App neu.
- FSFI-Consent wird explizit abgefragt und kann in den Einstellungen deaktiviert werden.

## Feature-Flags

| Flag            | Beschreibung                          | Default |
|-----------------|----------------------------------------|---------|
| `quickMode`     | Schnellmodus in der Tagesansicht       | `true`  |
| `fsfiOptIn`     | Aktiviert FSFI-Fragebogen              | `false` |
| `encryption`    | Lokale AES-GCM-Verschlüsselung         | `false` |

Weitere Einstellungen lassen sich im Tab **Einträge → Daten & Schutz** vornehmen.

## Tests

```bash
npm run test
```

Vitest nutzt eine jsdom-Umgebung. Die wichtigsten Assertions:

- PBAC-Berechnung (Komponente `PbacMini`)
- ARIA-Konformität des NRS-Sliders
- EHP-5-State-Handling
- Korrelationen erscheinen erst ab `n ≥ 14`

## Hinweise

- Touch-Ziele ≥48px, Tastaturbedienung, sichtbarer Fokus.
- Lighthouse mobil: Zielwerte ≥90 Performance, ≥95 Accessibility.
- Icons in `public/` dienen als Platzhalter und sollten für Produktion ersetzt werden.
