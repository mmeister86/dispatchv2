---
id: TASK-33.1.3
title: Exportiere berechtigte Workspace-Versionsinhalte in begrenzten Seiten
status: To Do
assignee: []
created_date: '2026-10-07 23:23'
updated_date: '2026-10-07 23:23'
labels: []
dependencies: []
parent_task_id: TASK-33.1
priority: high
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ergänze den tatsächlichen Workspace-Export um paginierte gemeinsame Draft-Versionsinhalte mit einem tenant-first Index. Jede Seite prüft aktuelle Owner/Admin- und Quellenrechte; keine privaten Ursprungsgraphen, Secrets oder Medienbytes. Begrenzte Scan-Fortsetzung ist kein vollständiger atomarer Workspace-Export. Umsetzung erst nach konkreter Sourcefreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Native selektierte Workspace-Pagination verwendet genau einen begründeten Versionsindex, aktuelle verifizierte Own-Scope/Owner-Admin-Rechte und native Cursor; kein fremder Workspace oder Account gelangt vor Kandidatenfenster und Payload.
- [ ] #2 Exportierter Inhalt ist explizit allowlisted und durch aktuellen Draft-Root sowie retained Quellenbeweis gedeckt; bekannte unexportierbare Inhalte geben keine Skeletons, Gründe oder Auslassungszahlen zurück. Unerwartete DB-, Ressourcen-, Ancestry- und Wirefehler brechen die Seite ab.
- [ ] #3 Gemeinsame native Lese-/Byte-/DTO-Budgets einschließlich Auth und Quellenarbeit sind gemessen und erzwungen; echte Fortsetzung, Creation-Time-Auswahlgrenze und pro-Seite-Beobachtung werden von Vollständigkeit und atomarem Snapshot getrennt.
- [ ] #4 Reale native Isolation/Quelle/Rootless/Cap/mehrseitige und ZeroIO-Kontrollen erhalten den eigenen Profil-Export; eingeführter UI-Download ist bounded und Scope-fenced. Frische Reviews, Root-Gates, Commit und exaktes EUDev sind belegt; übrige Familien und Komponenten bleiben explizit offen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Nach akzeptierter32.4 Quellenbestand, tatsächliche Export- und Root/Account-Proof-Seams gegen konkrete freigegebene Version abgleichen.
2. Genau einen Workspace-Index und native finite Seitenschnittstelle mit explizitem Feldumfang, aktuellen Quellenrechten und gemessenen Gesamtbudgets freigeben.
3. Ehrliche Scan-Fortsetzung ohne Auslassungszahlen und ohne Vollständigkeits-/Snapshotbehauptung; vorhandenen eigenen Profil-Export erhalten.
4. Registered reale Mehrseiten-/Isolation-/Quellen-/Rootless-/Ressourcen-Kontrollen, gegebenenfalls konkreter bounded Download; frische SPEC und getrennte QUALITY, Root-Gates, Commit und exaktes EUDev.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only Vorbereitung /tmp/dispatch-33.1-workspace-export-next-audit.md und /tmp/dispatch-33.1-workspace-export-index-clarification.md auf immutable cb5f5ef. Root bevorzugt direkte Workspace-Version-Pagination statt temporärem Named-Draft-Endpoint. Bekannte Verluste dürfen nur unter explizit freigegebener tenant-business-progress-Grenze ohne Payload/Skeleton/Auslassungszahl übersprungen werden; keine strict-hidden-count-invariance behaupten. Native Geschichte zeigt bereits redigierte gemeinsame Versionsmetadaten, Rootless-Inhalte benötigen trotzdem expliziten Rootbeweis. Aktuelle offizielle Convex-Dokumentation per Context7 library +2docs eingeholt: Indexreihenfolge und QueryCtx/MutationCtx same snapshot; ActionCtx und separate Seiten haben separate Transaktionen. Creation-Time-Auswahlgrenze ist kein Commit-Order-Snapshot. Noch keine Sourcefreigabe oder Umsetzung.
<!-- SECTION:NOTES:END -->
