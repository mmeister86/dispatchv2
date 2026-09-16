---
id: TASK-12
title: Publisher mit Einzelpost-Checkpoints und Abgleich bauen (P03.03)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p03
  - r1
  - arbeitspaket
milestone: m-1
dependencies:
  - TASK-11
  - TASK-9
  - TASK-12.1
  - TASK-12.2
  - TASK-12.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P03.03.
Phase: P03 – X-Verbindung, zuverlässiges Publishing und Kalender.

**Abhängigkeit:** P03.02, P02.03. **Dateien:** `convex/publishing/workflows.ts`, `convex/publishing/attempts.ts`, `convex/publishing/reconcile.ts`, `convex/integrations/x/publish.ts`; Test `convex/publishing/workflows.test.ts`.

- Medien vorbereiten, Verarbeitung abwarten, exakte Version laden und Account unmittelbar vor Versand validieren.
- Finalisierte R2-Assets unmittelbar vor dem X-Upload autorisiert abrufen; Objektidentität und erwarteten Inhalt prüfen. Kurzlebige Abruf-URLs bei Wiederaufnahme neu erzeugen. Notwendiger Transfer über eine Convex Action bleibt in der Kostenrechnung enthalten und wird nicht als durch R2 automatisch kostenlos behandelt.
- Jeden Thread-Beitrag als eigene nachvollziehbare Operation veröffentlichen und die externe ID unmittelbar persistieren.
- Wiederholbare, permanente und unklare Fehler trennen; begrenzte Backoffs mit Provider-Hinweisen verwenden.
- Für nicht idempotente Veröffentlichungs-Actions automatische Workflow-/SDK-Retries explizit deaktivieren; Wiederaufnahme nur über Versuchsstatus und Abgleich. Medien-Verarbeitungswartezeiten als dauerhafte Schritte modellieren. Große Medien block-/streamweise übertragen; gewählte Runtime und Speicherbedarf im P00-Durchstich messen.
- Sichtbare Wiederaufnahme für Teilthreads sowie einen Abgleichpfad für unklare Schreibausgänge implementieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prozessabbruch nach Beitrag 2 eines Threads wiederholt Beitrag 1 und 2 nicht.
- [ ] #2 Timeout nach möglichem Provider-Erfolg löst keinen automatischen Blind-Retry aus.
- [ ] #3 Endergebnis enthält Inhaltssnapshot und externe Links.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
