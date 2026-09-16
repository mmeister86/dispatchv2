---
id: TASK-33
title: 'Export, Löschung und Retention umsetzen (P09.03)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p09
  - r3
  - arbeitspaket
milestone: m-3
dependencies:
  - TASK-26
  - TASK-29
  - TASK-30
  - TASK-33.1
  - TASK-33.2
  - TASK-33.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.03.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** P01–P08-Datenmodell. **Dateien:** `convex/operations/export.ts`, `convex/operations/deletion.ts`, `convex/operations/retention.ts`, `src/features/settings/data-controls.tsx`, `.docs/decisions/data-inventory.md`; Test `convex/operations/deletion.test.ts`.

- Dateninventar mit Zweck, Besitzer, Provider-Weitergabe, Aufbewahrung und Löschweg erstellen.
- Account-/Workspace-Export mit Inhalten, Quellenbezügen, Planungen und relevanten Präferenzen bereitstellen.
- Wiederaufnehmbare Löschung bauen: Workspace sperren, Jobs stoppen, Tokens entfernen, Storage, Agent-Memory, Embeddings und abgeleitete Modelle bereinigen.
- Abgeschlossene Workflow-Journale und Agent-Komponentendaten ausdrücklich in Retention, Export und Löschung aufnehmen; nicht automatisch verschwindende Komponenten-Daten nach dem Diagnose-/Abgleichfenster bereinigen. Benötigte Publishing-Nachweise zuvor in der Domain sichern.
- Temporäre Uploads und finale R2-Objekte mit dem Convex-Löschfortschritt abgleichen; Metadaten nicht vor gesichertem Objektverweis/Löschauftrag entfernen. Bereits fehlende Objekte als idempotenten Erfolg behandeln und verwaiste Dateien nach Unterbrechungen bereinigen.
- Provider-seitige Entfernungen und Sperrungen aus P06 ebenso wie Nutzerlöschungen bis in gespeicherte Quellenkopien, Caches und Agent-Kontexte verfolgen; veraltete Evidenz nicht erneut aus Backups oder Wiederholungen aktivieren.
- Bei Account-Löschung persönliche Mitgliedschaften und Identität entfernen; gemeinsame Workspaces nicht ohne deren eigene Berechtigung löschen. Für alleinige Eigentümer zuvor Übergabe oder bewusste Workspace-Löschung anbieten.
- Provider-seitige Datenkopien, Backups und gegebenenfalls rechtlich aufzubewahrende Abrechnungsdaten getrennt behandeln und verständlich erklären.
- Das Entfernen einer Integration von der Löschung bereits öffentlicher Posts unterscheiden.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Löschung während laufender Recherche/Publikation verhindert neue Arbeit.
- [ ] #2 Wiederholungen reaktivieren den Workspace nicht.
- [ ] #3 Export enthält keine Provider-Secrets.
- [ ] #4 Der Betreiber kann den Abschluss nachweisen, ohne Inhalte unnötig zu behalten.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
