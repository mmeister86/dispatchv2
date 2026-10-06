---
id: TASK-45.2
title: 'Exakten Stilkontext im bestehenden Draft-Generator sichern (P12.01, Teil 2)'
status: To Do
assignee: []
created_date: '2026-10-06 14:00'
updated_date: '2026-10-06 14:41'
labels: []
dependencies:
  - TASK-45.1
references:
  - .docs/style-profile-contract.md
parent_task_id: TASK-45
priority: medium
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Folgepaket gemäß .docs/style-profile-contract.md nach Teil1: serverseitiger immutable Stil-Pin im bestehenden funded Draft-Agent, aktuelle Nutzung versus historische Quellenproofs und tatsächliche Prompt-/Idea-/Draft-Copy-Cleanup-Kanten. Vor Writerstart genaue Source-Ownership aus akzeptiertem Teil1 finalisieren. Keine zusätzlichen Modelle, Zwecke, Budgets oder Provideraktivierung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Echte Draft-Generierung bindet serverseitig exakte Stilversion und getrennte Behauptungs-/Tonlabels; Retry und Legacy recapturen keine neue Auswahl.
- [ ] #2 Gemeinsame aktuelle Gates stoppen Stilwechsel/Quellenverlust vor Tool/Provider/Commit, ohne exakte späte oder unbekannte Kostenabrechnung zu verlieren.
- [ ] #3 Historische Ergebnisse behalten ursprüngliche Stilreferenzen; Quellenverlust maskiert und entfernt tatsächliche Agent-/Idea-/Draft-Ableitungen einschließlich editierter/veröffentlichter Linien und bewahrt bestätigte Publishing-/Finanzbelege.
- [ ] #4 Native Provider-Interception, betroffene reale Browser, Source-Freeze und separate frische SPEC/QUALITY sind dokumentiert; natürliche Modellfaktizität und manuelle Abnahme bleiben offen.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root hat tatsächliche ai/fields.policyFields und runs.validPolicy gelesen: aiPolicies kennt purpose/processingEvidence/pricingEvidence/EU-model/three-budget scopes, keine dataCategories-Liste. Stilvertrag korrigiert diese ehemalige Kurzbezeichnung. Auswahl ist keine ProcessingPermission; echte ProcessingEvidence muss weitergegebenen deklarierten Autor/Stil-Kontext abdecken, bevor tatsächliche Providerverwendung. Kein erfundenes vorhandenes CategoryGate und keine tatsächliche Freigabe durch Implementierung.
<!-- SECTION:NOTES:END -->
