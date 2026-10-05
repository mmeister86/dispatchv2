# Dispatch · interaktive UI-Demo

Lokale redaktionelle Anwendung für sämtliche UI-Anteile des Dispatch-Backlogs, unabhängig von Milestones. Implementiert direkt auf `master` (TASK-69). React, TypeScript, Vite, Tailwind und shadcn/ui.

## Starten

```sh
pnpm install
pnpm dev
```

Öffne http://127.0.0.1:5173. Die Anwendung startet mit zwei getrennten Workspaces, Kanal-Accounts, Ideen, Entwürfen, geplanten Beiträgen und bewusst demonstrierbaren Fehlerfällen. Einstellungen → Daten → Demo zurücksetzen stellt die zentralen Ausgangsdaten wieder her. Ergänzende Modul-Einstellungen bleiben dabei erhalten; für einen vollständig frischen Durchlauf die `dispatch-*`-Einträge im lokalen Browserspeicher löschen.

## Ausprobieren

- Übersicht, Entwürfe und Composer: Einzelbeiträge und Threads, Medien/Alttext, Versionen, Kommentare, explizite Account-Freigaben, Änderungsvergleich und Kanalvarianten.
- Kalender: Woche, Monat und Agenda; Terminwahl mit Zeitzone und Zeitumstellung; Snapshot-Wechsel, Storno, Teilthread-Recovery und Abgleich unbekannter Ergebnisse.
- Signale, Ideen, Recherche und Agent: feste Beispieldaten, editierbare Profile, lokale Verläufe, Abbruch/Wiederaufnahme und idempotente Übergabe in ungeprüfte Entwürfe.
- Planvorschläge: unabhängige Reviews/Freigaben und ausschließlich ausgewählte Slots übernehmen.
- Analytics, Medien und Studio: bekannte/unbekannte Messwerte, Scope/Zeitraum, Beispielimport, lokale Uploads, referenzierte Medienversionen, feste Bild-/Video-Workflows.
- Experimente, Repurpose und Trends: Rechtebestätigung, kanalspezifische Übergaben, Review, Schwellenwerte, Backtest und Unsicherheit.
- Team, Workspaces, Einstellungen und Betrieb: Rollen und Review-Stufen, lokale Integrationen und Quellen, Strategiehistorie, Budgets/Billing, Benachrichtigungen, Datenexport/Löschung, Stop-Schalter, Kalibrierung/Algorithmusreview und Rollback.
- Öffentliche Demo-Seiten: Landingpage, Login, Signup, Verifikation, Passwort-Reset, Onboarding, Hilfe und Rechtstexte.

⌘K/Ctrl+K öffnet die Suche; ⌘S/Ctrl+S speichert im Composer. Desktop und mobile Navigation, helles/dunkles Design sowie reduzierte Bewegung werden unterstützt.

## Scope und Daten

Alle Provider, Rechercheergebnisse, Analysen, Agent-Antworten, Messwerte, Abrechnungen und Veröffentlichungsereignisse sind ausdrücklich simuliert. Es gibt keine echte Recherche, KI-Aufrufe, OAuth-Verbindungen, Mails, Social-Posts, Zahlungen oder Hintergrundjobs. Externe URLs in Eingaben werden nicht abgerufen. Auth- und Rollenwechsel sind Demo-Zustände und kein Sicherheitsbackend. Hilfs- und Rechtstexte sind gekennzeichnete Entwürfe.

Zustände und kleine hochgeladene Dateien werden im `localStorage` des jeweiligen Browsers gespeichert. Fehler beim Speichern werden angezeigt; der gemeinsame Zustand wird erst nach erfolgreicher Speicherung übernommen. Workspace-Daten sind getrennt. Bereits geplante Texte und Medien bleiben als versionierte Snapshots erhalten; neue Texte, Medien oder Ziel-Accounts benötigen eigene Freigaben. Wiederaufnahme betrifft ausschließlich explizit geprüfte offene Snapshot-Beiträge.

Weitere Installationsläufe verwenden Projekt-Caches und pnpm-Store im Repository (`.cache`, `.pnpm-store`); beide sind ignoriert. Der erste Installationslauf nutzte wegen einer ignorierten alten `.npmrc`-Einstellung den übergeordneten Standard-Store; siehe QA-Nachweis. Es werden keine bestehenden Provider-Zugangsdaten verwendet. Für eine echte Anwendung müssen Backend, Identität, Zugriffsschutz, Provider-Verträge und reale Datenpipelines separat umgesetzt werden.

## Prüfen

```sh
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Die Browserprüfungen nutzen auf macOS vorhandenes Google Chrome. Alternativ `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` auf eine vorhandene Chromium-Binary setzen. Sie prüfen direkte URLs, Kernabläufe, Rechte/Reviews, lokale Persistenz, Mock-Module, Mobilansichten und Axe/WCAG. Screenshots liegen unter `.docs/reviews/evidence/task-69/`.

Details: [Backlog-Abdeckung](.docs/ui-backlog-coverage.md), [UI-Kernabläufe](.docs/design/core-flows.md), [Implementierungsplan](.docs/design/ui-implementation-plan.md) und [QA-Nachweis](.docs/reviews/task-69-ui-validation.md).

Ursprungstasks und TASK-69 bleiben bis zur ausdrücklichen manuellen Nutzerabnahme **In Progress**; gemischte Backend-Aufgaben werden durch diese UI-Demo nicht geschlossen.
