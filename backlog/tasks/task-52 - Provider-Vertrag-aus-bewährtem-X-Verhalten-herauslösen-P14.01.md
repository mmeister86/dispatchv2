---
id: TASK-52
title: Provider-Vertrag aus bewährtem X-Verhalten herauslösen (P14.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p14
  - r7
milestone: m-7
dependencies:
  - TASK-40
  - TASK-41
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P14.01.
Phase: P14 – Multi-Channel Publishing und plattformspezifische Intelligence.

**Abhängigkeit:** stabiles P10, P11-Metrikvertrag. **Dateien:** `convex/integrations/providerContract.ts`, `convex/content/packages.ts`, `convex/content/variants.ts`, `convex/publishing/providerRegistry.ts`; Test `convex/integrations/providerContract.test.ts`.

- Fähigkeiten für Auth, Formate, Textgrenzen, Medien, Threads, Planung, Messwerte und Löschung explizit modellieren.
- Eine gemeinsame Idee mit getrennten Plattform-Drafts, Versionen, Freigaben und Terminen verbinden.
- X auf den Vertrag umstellen, ohne funktionierendes Publishing oder gespeicherte externe IDs zu verlieren.
- Nicht unterstützte Features früh in der UI und Domain-Validierung kenntlich machen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Adapter kann eine Fähigkeit ausdrücklich nicht anbieten.
- [ ] #2 Ein Fehler auf Kanal A verändert keinen erfolgreichen Status auf Kanal B.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
