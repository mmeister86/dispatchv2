---
id: TASK-36
title: 'Deployment, Migrationen und Recovery abnehmen (P09.06)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 14:10'
labels:
  - p09
  - r3
  - arbeitspaket
milestone: m-3
dependencies:
  - TASK-4
  - TASK-29
  - TASK-30
  - TASK-31
  - TASK-32
  - TASK-33
  - TASK-34
  - TASK-35
  - TASK-36.1
  - TASK-36.2
  - TASK-36.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.06.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** P01.01 und alle produktiven Module. **Dateien:** Cloudflare-Konfiguration, CI-Konfiguration, `.docs/runbooks/deployment.md`, `.docs/runbooks/recovery.md`, `tests/e2e/release-smoke.spec.ts`.

- Staging und Produktion mit getrennten Secrets, Domains, OAuth-Callbacks und Webhook-Zielen ausrollen.
- R2-Buckets, Zugangsdaten, CORS-Regeln und Lifecycle-Konfiguration je Umgebung trennen. Restore muss Convex-Asset-Referenzen mit vorhandenen R2-Objekten abgleichen; ein Datenbank-Backup enthält nicht automatisch die Medienbytes.
- Additive Schemaänderungen, wiederaufnehmbare Backfills und spätere Entfernung alter Felder als Migrationsmuster festlegen.
- Laufende Workflow-Versionen bei Deployments berücksichtigen: alte Läufe kontrolliert auslaufen lassen oder nachvollziehbar migrieren.
- Backup-/Exportfähigkeit, Restore und anschließenden Abgleich externer Veröffentlichungen praktisch prüfen.
- Rollback, Feature Flags und schrittweise Freigabe neuer Provider/Agent-Prompts einrichten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D15: Pilot-/Restore-Messungen als Grundlage späterer RPO/RTO und Retention liefern.

Abgrenzung: Alle produktiven Module meint für diese Beta-Abnahme P01–P09. P10–P16 ergänzen ihre Deployment-, Export-, Lösch- und Recovery-Verträge bei Einführung; sie sind keine Vorbedingungen dieser Aufgabe.

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine Wiederherstellungsübung produziert keine erneuten Posts aus alten Scheduler-Daten.
- [ ] #2 Deployment bricht keine aktiven Threads oder Freigaben ab.
- [ ] #3 Produktion besteht die Release-Smokes über die echten Domains.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Restore-Referenzgraph Intelligence/Kalibrierung bei Source43.3 582ecf0 dokumentiert in .docs/decisions/data-inventory.md: Originalprofile/Assessments/Usage/NumericReceipts/PurposeGenerationen/Horizonte und immutable Veröffentlichungspins konsistent erhalten; keine Rechte-/Fristverlängerung/Backfill oder neuen Posts aus Restore. Verbrauchte scoped Monitoring-IDs dürfen bei noch gültigem Originalkandidaten nicht durch Teilrestore verschwinden. Dokumentiert/native localCleanup geprüft, keine tatsächliche Backup-/Restore-/Production-Domain-Abnahme; Status unverändertTo Do.44 und45 ergänzen neueGraphEdges erst verifiziert.
<!-- SECTION:NOTES:END -->
