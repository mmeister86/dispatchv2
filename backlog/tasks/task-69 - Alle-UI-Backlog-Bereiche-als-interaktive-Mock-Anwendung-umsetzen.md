---
id: TASK-69
title: Alle UI-Backlog-Bereiche als interaktive Mock-Anwendung umsetzen
status: In Progress
assignee: []
created_date: '2026-10-04 18:27'
updated_date: '2026-10-04 19:38'
labels: []
dependencies: []
priority: high
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Milestone-unabhängige Umsetzung sämtlicher UI-Anteile vorhandener Tasks. React/TypeScript, pnpm und shadcn/ui; lokale Mock-Daten statt echter Recherche, Publishing, KI, Auth-, Zahlungs- oder Provider-Integrationen. Vorhandene uncommittete Dateien bewahren; ausschließlich dieses Repository bearbeiten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Alle UI-relevanten Backlog-Tasks sind einer erreichbaren Ansicht und einem prüfbaren Mock-Ablauf zugeordnet
- [x] #2 Composer, versionierte Freigabe, selektive Planung und Kalender erhalten getrennte und persistente Mock-Zustände
- [x] #3 Onboarding, Research, Signale, Chat, Analytics, Team, Medien, Kanäle und Einstellungen sind interaktiv mit Mock-Daten umgesetzt
- [x] #4 Responsive UI, Tastaturbedienung, Build, Typprüfung und zentrale Ablauf-Tests sind geprüft
- [x] #5 Dokumentation benennt Startbefehle, Mock-Grenzen, Task-Abdeckung und manuelle Abnahmefälle
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. UI-Anteile aller Tasks inventarisieren und Domain-Verträge auswerten. 2. React/Vite/shadcn-Grundlage und lokale Mock-Zustände erstellen. 3. Redaktionelle Kernabläufe, ergänzende Produktansichten und Verwaltungsoberflächen umsetzen. 4. Spec- und Qualitätsreviews, Typprüfung, Build und Browser-Ablauftests ausführen. 5. UI-Abdeckung in Ursprungstasks dokumentieren; Status bis zur expliziten Nutzerabnahme In Progress belassen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
UI-Umsetzung direkt auf master zur manuellen Abnahme bereit. 75 von 89 Ursprungstasks besitzen UI-Anteile; alle 75 wurden per CLI mit konkreter Oberflächenzuordnung dokumentiert und bleiben In Progress. 14 Backend-/Provider-/Release-Tasks sind ausdrücklich außerhalb des UI-Scope. React/TypeScript/Vite/Tailwind mit shadcn/ui und lokal persistierten Mock-Daten; keine echten Recherche-, KI-, Publishing-, Auth-, Zahlungs- oder Provider-Aufrufe. Endgültige Verifikation: pnpm test 17/17, pnpm test:e2e 31/31 (gemeinsamer Lauf), pnpm build und strikte Typprüfung erfolgreich, Prettier und git diff --check sauber. 35 direkte URLs, Axe auf 32 Hauptansichten und sechs Dark-Mode-Ansichten, mobile Navigation/Layouts, versions- und accountgebundene Freigaben/Snapshots, selektive Planung, Teilthread-Recovery, Review-Stufen, Rollen, Speicherfehler und Modul-Workflows geprüft. Start/Scope: README.md. Vollständige Zuordnung und manuelle Prüffälle: .docs/ui-backlog-coverage.md. QA-Nachweis und Verzeichnis-/Cache-Hinweise: .docs/reviews/task-69-ui-validation.md. Nutzerabnahme steht aus; keine Done-Statusänderung, keine zusätzlichen Branches, keine Commits oder Pushes.
<!-- SECTION:NOTES:END -->
