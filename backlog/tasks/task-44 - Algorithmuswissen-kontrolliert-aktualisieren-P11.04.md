---
id: TASK-44
title: Algorithmuswissen kontrolliert aktualisieren (P11.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 13:34'
labels:
  - p11
  - r5
milestone: m-5
dependencies:
  - TASK-27
  - TASK-28
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P11.04.
Phase: P11 – Performance Feedback und Account Intelligence.

**Abhängigkeit:** P08.01–P08.02 für Quellen-/Profilpflege; P11.03 zusätzlich nur bei Änderungen bereits kalibrierter Modelle. **Dateien:** `convex/intelligence/profileUpdates.ts`, interne Review-Oberfläche, `.docs/runbooks/algorithm-updates.md`.

- Änderungen öffentlich verwendeter Quellen erkennen und als internen Review-Vorschlag erfassen.
- Quelländerung, Interpretation und mögliche Auswirkung auf Dispatch-Regeln nebeneinanderstellen.
- Referenzfälle erneut evaluieren und Profil aktivieren oder verwerfen.
- Alte Profil- und Modellstände für historische Nachvollziehbarkeit erhalten, bis deren Retention endet.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Bedingte Abhängigkeit: P11.03 wird nur für Änderungen bereits kalibrierter Modelle benötigt. Reine Quellen-/Profilpflege darf vorher beginnen.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein fremder Repository-Commit verändert keine produktive Bewertung ohne interne Prüfung.
- [ ] #2 Eine fehlerhafte Aktivierung kann rückgängig gemacht werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-43.3 einfrieren und separate frische SPEC/QUALITY abschließen; danach erst denselben Quellgraph erweitern.
2. Den bestehenden Profil-/Jev-/Kalibrierungs-/Publishingpfad und offizielle GitHub-Verträge gemäß .docs/algorithm-source-update-contract.md verwenden.
3. Begrenzten manuellen öffentlichen Quellencheck mit aktuellen Rollen, Scope, reserviertem Versuch, exaktem Replay, Cooldown und sichtbaren Fehler-/Teilergebnissen implementieren; weder Profilwahl noch ihre Revision verändern.
4. Unveränderliche Änderungsvorschläge oder vollständige Same-SHA-Neubeobachtung, getrennte menschliche Interpretation und serverseitige reine Referenzprüfung aufnehmen. Bestehende Varianten/Formel unverändert lassen.
5. Neues Draft-Profil aus exakten Belegen erstellen, native Review-Sperre und separate Auswahl verwenden; gültigen historischen Rollback und historische Score-/Cache-/Modell-/Publishing-Invarianz prüfen.
6. Reale Operations-Oberfläche mit Desktop/390px/Demo prüfen; vollständige native Tests, Typen, scoped Format/Lint, Build/Bundle/Codegen und vorhandenes EU Dev. Quellen einfrieren, frische SPEC dann QUALITY, lokale master-Commits.
7. Neue Datenreferenzen im TASK-33/36-Inventar dokumentieren; tatsächliche Rechte, empirische Qualität und manuelle Done-Abnahme bleiben offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Algorithmusprofile. Mock before/after source statement, interpretation, affected rule, review/evaluation, activate/discard/rollback and version log. Grenze: No actual source monitoring, verified algorithm knowledge or production assessment changes. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Vorbereitung: Öffentliche X-Quellen wurden schreibgeschützt geprüft (2026-10-05). Aktueller Primärquellen-Pin xai-org/x-algorithm b412112d03f27acbfd668e0cc040abcafa1080c1 vom 2026-10-03. Report /tmp/dispatch-algorithm-source-review.md enthält unveränderliche Quellenlinks, 13 Datei-SHA256-Prüfsummen und Update-/Rollback-Vertrag. Der öffentliche Code beweist weder aktuelle Produktionskonfiguration noch Reichweitenvorhersagen; dispatch-score-v1 bleibt getrennte redaktionelle Heuristik. Noch kein Profil aktiviert, keine Aufgabe geschlossen.

Root hat den öffentlichen Quellenbericht geprüft und unter übertragener Entscheidungsfreiheit den Snapshot x-public-context-v1 als Informationskontext ausgewählt: public_code, productionState unknown, scoringInfluence none. Dauerhafter Bericht .docs/reviews/task-27-44-public-x-source-review.md; Entscheidung .docs/decisions/analysis-contract.md. Keine technische Profilaktivierung, kein Analyzer-/Datenpfad-Tor geöffnet; Source-Update-Implementierung bleibt offen.

Fortsetzungsdesign 2026-10-06: .docs/algorithm-source-update-contract.md. Read-only Explorer-Seammap /tmp/dispatch-continuation-44-design.md durch Root geprüft. Context7 GitHub REST resolve + zwei Docs-Fetches und offizielle fehlende Limitdetails geprüft. 13 öffentliche Dateien am ursprünglichen immutable SHA erneut gelesen: alle HTTP200, SHA256 exakt unverändert, 233297 Bytes insgesamt, Maximum55021. Kein Profil/Deadline/Revision verändert. Quellbeobachtung darf profiles.finish nicht aufrufen; echte Jev-Zulassung prüft die Auswahlrevision. Implementation wartet auf den einzigen TASK43.3-Writer und frische unabhängige Reviews.

Neue reale read-only Beobachtung: öffentlicher HEAD e62790c99484b51424c2eccc488ed4e7517e8778 (2026-10-06T04:59:30Z),103 changed paths, sieben von13 bestehenden Nachweishashes geändert, alle13 HTTP200. Bericht .docs/reviews/task-44-source-observation-2026-10-06.md. Compare574391 Bytes; Link nur first, kein next; ein echter vollständiger Quellenvergleich passt in Transportlimits, nicht in alle UI-Ausschnitte. Vertrag trennt deshalb strukturelle Vollständigkeit von bewusst begrenzten Ausschnitten und expliziter menschlicher Prüfung vollständiger immutable Links. Strukturelle Lücken bleiben nicht übersteuerbar. Kein tatsächliches Profil/Review/Score/Deadline verändert, keine App-Prüfquittung erfunden.
<!-- SECTION:NOTES:END -->
